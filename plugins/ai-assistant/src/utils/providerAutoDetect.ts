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
 * Sentinel value stored in config.apiKey for the azure provider
 * when it was auto-detected via `az cognitiveservices account keys list`.
 * The actual key is never persisted — it is fetched fresh from the CLI
 * at model creation time via {@link refreshAzureOpenAIKey}.
 *
 * When this sentinel is used, `config.azResourceGroup` and
 * `config.azAccountName` are also stored so the key can be re-fetched.
 */
export const AZ_CLI_AUTH_SENTINEL = '__az_cli__';

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
 * Allowlist of commands and their permitted first subcommands.
 * Prevents arbitrary command execution via the pluginRunCommand bridge.
 */
const ALLOWED_COMMANDS: Record<string, string[]> = {
  gh: ['auth'],
  az: ['account', 'cognitiveservices'],
};

/** Maximum time (ms) to wait for a CLI command before timing out. */
const DETECT_COMMAND_TIMEOUT_MS = 15_000;

/**
 * Run an allow-listed command via pluginRunCommand (Headlamp's Electron
 * bridge). Returns { stdout, exitCode }. Always resolves — never rejects.
 *
 * Only commands registered in {@link ALLOWED_COMMANDS} are executed; any
 * other command resolves immediately with an error. A hard timeout ensures
 * hung processes don't stall auto-detection indefinitely.
 */
function runDetectCommand(
  command: string,
  args: string[]
): Promise<{ stdout: string; exitCode: number }> {
  // Validate against allowlist
  const allowedSubs = ALLOWED_COMMANDS[command];
  if (!allowedSubs) {
    return Promise.resolve({ stdout: '', exitCode: 1 });
  }
  const firstSub = args[0];
  if (firstSub && !allowedSubs.includes(firstSub)) {
    return Promise.resolve({ stdout: '', exitCode: 1 });
  }

  // pluginRunCommand is a runtime global injected by Headlamp desktop.
  // eslint-disable-next-line no-undef
  const pluginRunCommand: any = (globalThis as any).pluginRunCommand;

  return new Promise(resolve => {
    try {
      if (typeof pluginRunCommand !== 'function') {
        resolve({ stdout: '', exitCode: 1 });
        return;
      }

      const cmd = pluginRunCommand(command, args, {});

      let stdout = '';
      let resolved = false;

      const done = (result: { stdout: string; exitCode: number }) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      // Hard timeout so a hanging CLI never stalls detection.
      const timer = setTimeout(() => {
        done({ stdout: '', exitCode: 1 });
      }, DETECT_COMMAND_TIMEOUT_MS);

      cmd.stdout.on('data', (data: string) => (stdout += data));
      // stderr is intentionally ignored — many CLIs (notably `az`) emit
      // warnings on stderr even on success. We key off exitCode instead.
      cmd.stderr.on('data', () => {});
      cmd.on('exit', (code: number) => {
        clearTimeout(timer);
        done({ stdout, exitCode: code });
      });
      cmd.on('error', () => {
        clearTimeout(timer);
        done({ stdout: '', exitCode: 1 });
      });
    } catch {
      resolve({ stdout: '', exitCode: 1 });
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
  const { stdout, exitCode } = await runDetectCommand('gh', ['auth', 'token']);
  if (exitCode !== 0 || !stdout) {
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });

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
  } finally {
    clearTimeout(timeoutId);
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
  const { stdout, exitCode } = await runDetectCommand('az', ['account', 'show', '-o', 'json']);
  if (exitCode !== 0 || !stdout) {
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
  const { stdout, exitCode } = await runDetectCommand('az', [
    'cognitiveservices',
    'account',
    'list',
    '--query',
    "[?kind=='OpenAI']",
    '-o',
    'json',
  ]);
  if (exitCode !== 0 || !stdout) {
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
  const { stdout, exitCode } = await runDetectCommand('az', [
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
  if (exitCode !== 0 || !stdout) {
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
  const { stdout, exitCode } = await runDetectCommand('az', [
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
  if (exitCode !== 0 || !stdout) {
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
 *
 * **Security:** The actual API key is NOT stored in the returned config.
 * Instead, a sentinel value ({@link AZ_CLI_AUTH_SENTINEL}) is stored,
 * together with `azResourceGroup` and `azAccountName` so the real key
 * can be fetched fresh via {@link refreshAzureOpenAIKey} at model
 * creation time.
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

    // Verify we can actually get an API key (validates permissions)
    const apiKey = await getAzureOpenAIKey(resourceGroup, account.name);
    if (!apiKey) {
      continue;
    }

    return {
      providerId: 'azure',
      source: 'Azure CLI',
      config: {
        // Store sentinel — never persist the real key to disk.
        apiKey: AZ_CLI_AUTH_SENTINEL,
        // Metadata needed to re-fetch the key at model creation time.
        azResourceGroup: resourceGroup,
        azAccountName: account.name,
        endpoint,
        deploymentName,
        model: modelName,
      },
      displayName: `Azure OpenAI (${account.name})`,
    };
  }

  return null;
}

/**
 * Fetch a fresh Azure OpenAI API key from the `az` CLI.
 *
 * Call this at model creation time when config.apiKey is
 * {@link AZ_CLI_AUTH_SENTINEL}. Returns the key string, or null
 * if `az` is unavailable / permissions are insufficient.
 */
export async function refreshAzureOpenAIKey(
  resourceGroup: string,
  accountName: string
): Promise<string | null> {
  return getAzureOpenAIKey(resourceGroup, accountName);
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
