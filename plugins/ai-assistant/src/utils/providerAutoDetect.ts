import { getDefaultConfig } from '../config/modelConfig';
import type { StoredProviderConfig } from './ProviderConfigManager';

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
      apiKey: token,
    },
    displayName: `GitHub Copilot (${username})`,
  };
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
  const [copilot, ollama] = await Promise.all([
    hasProvider('copilot') ? Promise.resolve(null) : detectCopilotProvider(),
    hasProvider('local') ? Promise.resolve(null) : detectOllamaProvider(),
  ]);

  if (copilot) detected.push(copilot);
  if (ollama) detected.push(ollama);

  return detected;
}
