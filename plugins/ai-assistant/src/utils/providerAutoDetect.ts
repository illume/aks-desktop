import { getDefaultConfig } from '../config/modelConfig';
import type { StoredProviderConfig } from './ProviderConfigManager';

/**
 * Sentinel value stored in config.apiKey for the copilot provider
 * when it was auto-detected via `gh auth token`. The actual token
 * is never persisted — it is fetched fresh from the CLI at model
 * creation time via {@link refreshGitHubToken}.
 */
export const GH_CLI_AUTH_SENTINEL = '__gh_cli__';

/**
 * Represents a detected AI provider that can be auto-configured.
 */
export interface DetectedProvider {
  /** The provider ID from modelConfig (e.g. 'copilot', 'local') */
  providerId: string;
  /** Human-readable label for the detection source */
  source: string;
  /** Pre-filled configuration for this provider */
  config: Record<string, any>;
  /** Friendly display name for this configuration */
  displayName: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Run a command via pluginRunCommand (Headlamp's Electron bridge).
 * Returns stdout/stderr. Always resolves — never rejects.
 */
function runDetectCommand(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  // pluginRunCommand is a runtime global injected by Headlamp desktop.
  // eslint-disable-next-line no-undef
  const pluginRunCommand: any = (globalThis as any).pluginRunCommand;

  return new Promise(resolve => {
    try {
      if (typeof pluginRunCommand !== 'function') {
        resolve({ stdout: '', stderr: 'pluginRunCommand is not available.' });
        return;
      }

      const cmd = pluginRunCommand(command, args, {});

      let stdout = '';
      let stderr = '';
      let resolved = false;

      const done = (result: { stdout: string; stderr: string }) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      cmd.stdout.on('data', (data: string) => (stdout += data));
      cmd.stderr.on('data', (data: string) => (stderr += data));
      cmd.on('exit', (code: number) => {
        if (code !== 0 && !stderr) {
          stderr = `Command exited with code ${code}`;
        }
        done({ stdout, stderr });
      });
      cmd.on('error', (errOrCode: unknown) => {
        const msg = errOrCode instanceof Error ? errOrCode.message : String(errOrCode);
        done({ stdout: '', stderr: `Command execution error: ${msg}` });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      resolve({ stdout: '', stderr: `Failed to execute command: ${message}` });
    }
  });
}

// ---------------------------------------------------------------------------
// GitHub CLI detection
// ---------------------------------------------------------------------------

/**
 * Attempts to retrieve a GitHub token from the `gh` CLI (`gh auth token`).
 * Returns the token string if available, or null.
 */
export async function detectGitHubToken(): Promise<string | null> {
  const { stdout, stderr } = await runDetectCommand('gh', ['auth', 'token']);
  if (stderr || !stdout) {
    return null;
  }
  const token = stdout.trim();
  // Basic sanity check — GitHub tokens are at least 30 characters
  if (token.length < 30) {
    return null;
  }
  return token;
}

/**
 * Validate a GitHub token against the GitHub API.
 * Returns the authenticated username, or null if invalid.
 */
export async function validateGitHubToken(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.login || null;
  } catch {
    return null;
  }
}

/**
 * Detects whether the GitHub CLI is authenticated and returns a
 * provider config for GitHub Copilot (GitHub Models API) if so.
 *
 * **Security:** The actual token is NOT stored in the returned config.
 * Instead, a sentinel value ({@link GH_CLI_AUTH_SENTINEL}) is stored,
 * and the real token is fetched fresh via {@link refreshGitHubToken}
 * each time the model is created.
 */
export async function detectCopilotProvider(): Promise<DetectedProvider | null> {
  const token = await detectGitHubToken();
  if (!token) {
    return null;
  }

  const username = await validateGitHubToken(token);
  if (!username) {
    return null;
  }

  const defaults = getDefaultConfig('copilot');
  return {
    providerId: 'copilot',
    source: 'GitHub CLI',
    config: {
      ...defaults,
      // Store a sentinel — never persist the real token to disk.
      apiKey: GH_CLI_AUTH_SENTINEL,
    },
    displayName: `GitHub Copilot (${username})`,
  };
}

/**
 * Fetch a fresh GitHub CLI token for the copilot provider.
 *
 * Call this at model creation time instead of using a stored token.
 * Returns the token string, or null if `gh` is unavailable / not logged in.
 */
export async function refreshGitHubToken(): Promise<string | null> {
  return detectGitHubToken();
}

// ---------------------------------------------------------------------------
// Ollama (local model) detection
// ---------------------------------------------------------------------------

interface OllamaModel {
  name: string;
}

/**
 * Detects whether Ollama is running locally and returns available models.
 */
export async function detectOllamaProvider(): Promise<DetectedProvider | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const models: OllamaModel[] = data.models || [];
    if (models.length === 0) {
      return null;
    }

    // Pick the first available model as default
    const firstModel = models[0].name;

    return {
      providerId: 'local',
      source: 'Ollama',
      config: {
        baseUrl: 'http://localhost:11434',
        model: firstModel,
      },
      displayName: `Ollama (${firstModel})`,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Azure OpenAI detection via `az` CLI
// ---------------------------------------------------------------------------

interface AzureOpenAIAccount {
  name: string;
  properties?: {
    endpoint?: string;
  };
  resourceGroup?: string;
}

interface AzureOpenAIDeployment {
  name: string;
  properties?: {
    model?: {
      name?: string;
    };
  };
}

/**
 * Check whether the Azure CLI is logged in by running `az account show`.
 * Returns the subscription display name, or null if not logged in.
 */
async function checkAzureLogin(): Promise<string | null> {
  const { stdout, stderr } = await runDetectCommand('az', ['account', 'show', '-o', 'json']);
  if (stderr || !stdout) {
    return null;
  }
  try {
    const account = JSON.parse(stdout);
    return account.name || account.user?.name || 'Azure';
  } catch {
    return null;
  }
}

/**
 * List Azure OpenAI (Cognitive Services) accounts in the current subscription.
 * Uses `az cognitiveservices account list` filtered to `kind == OpenAI`.
 */
async function listAzureOpenAIAccounts(): Promise<AzureOpenAIAccount[]> {
  const { stdout, stderr } = await runDetectCommand('az', [
    'cognitiveservices',
    'account',
    'list',
    '--query',
    "[?kind=='OpenAI']",
    '-o',
    'json',
  ]);
  if (stderr || !stdout) {
    return [];
  }
  try {
    const accounts: AzureOpenAIAccount[] = JSON.parse(stdout);
    return Array.isArray(accounts) ? accounts : [];
  } catch {
    return [];
  }
}

/**
 * List model deployments for a specific Azure OpenAI resource.
 */
async function listAzureOpenAIDeployments(
  resourceGroup: string,
  accountName: string
): Promise<AzureOpenAIDeployment[]> {
  const { stdout, stderr } = await runDetectCommand('az', [
    'cognitiveservices',
    'account',
    'deployment',
    'list',
    '-g',
    resourceGroup,
    '-n',
    accountName,
    '-o',
    'json',
  ]);
  if (stderr || !stdout) {
    return [];
  }
  try {
    const deployments: AzureOpenAIDeployment[] = JSON.parse(stdout);
    return Array.isArray(deployments) ? deployments : [];
  } catch {
    return [];
  }
}

/**
 * Retrieve an API key for an Azure OpenAI resource.
 */
async function getAzureOpenAIKey(
  resourceGroup: string,
  accountName: string
): Promise<string | null> {
  const { stdout, stderr } = await runDetectCommand('az', [
    'cognitiveservices',
    'account',
    'keys',
    'list',
    '-g',
    resourceGroup,
    '-n',
    accountName,
    '-o',
    'json',
  ]);
  if (stderr || !stdout) {
    return null;
  }
  try {
    const keys = JSON.parse(stdout);
    return keys.key1 || keys.key2 || null;
  } catch {
    return null;
  }
}

/**
 * Detects whether the Azure CLI is logged in and finds Azure OpenAI
 * resources with deployments. Returns a provider config for the first
 * resource found, or null if none available.
 */
export async function detectAzureOpenAIProvider(): Promise<DetectedProvider | null> {
  const subscriptionName = await checkAzureLogin();
  if (!subscriptionName) {
    return null;
  }

  const accounts = await listAzureOpenAIAccounts();
  if (accounts.length === 0) {
    return null;
  }

  // Use the first account that has an endpoint and a resource group
  for (const account of accounts) {
    const endpoint = account.properties?.endpoint;
    const resourceGroup = account.resourceGroup;
    if (!endpoint || !resourceGroup) {
      continue;
    }

    // Get deployments for this account
    const deployments = await listAzureOpenAIDeployments(resourceGroup, account.name);
    if (deployments.length === 0) {
      continue;
    }

    // Pick the first deployment
    const deployment = deployments[0];
    const deploymentName = deployment.name;
    const modelName = deployment.properties?.model?.name || 'gpt-4';

    // Get an API key
    const apiKey = await getAzureOpenAIKey(resourceGroup, account.name);
    if (!apiKey) {
      continue;
    }

    return {
      providerId: 'azure',
      source: 'Azure CLI',
      config: {
        apiKey,
        endpoint,
        deploymentName,
        model: modelName,
      },
      displayName: `Azure OpenAI (${account.name})`,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all provider auto-detection checks.
 * Only returns providers that are not already configured.
 */
export async function detectProviders(
  existingProviders: StoredProviderConfig[]
): Promise<DetectedProvider[]> {
  const detected: DetectedProvider[] = [];

  // Check if a provider type is already configured
  const hasProvider = (providerId: string) =>
    existingProviders.some(p => p.providerId === providerId);

  // Run detections in parallel
  const [copilot, ollama, azure] = await Promise.all([
    hasProvider('copilot') ? Promise.resolve(null) : detectCopilotProvider(),
    hasProvider('local') ? Promise.resolve(null) : detectOllamaProvider(),
    hasProvider('azure') ? Promise.resolve(null) : detectAzureOpenAIProvider(),
  ]);

  if (copilot) detected.push(copilot);
  if (azure) detected.push(azure);
  if (ollama) detected.push(ollama);

  return detected;
}
