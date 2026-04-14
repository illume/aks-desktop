import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DetectedProvider } from './providerAutoDetect';

// Mock globals before importing the module
const mockPluginRunCommand = vi.fn();

beforeEach(() => {
  (globalThis as any).pluginRunCommand = mockPluginRunCommand;
});

afterEach(() => {
  delete (globalThis as any).pluginRunCommand;
  vi.restoreAllMocks();
});

describe('providerAutoDetect', () => {
  describe('detectGitHubToken', () => {
    it('returns token when gh auth token succeeds', async () => {
      const fakeToken = 'ghp_' + 'a'.repeat(36);
      mockPluginRunCommand.mockReturnValue({
        stdout: { on: (evt: string, cb: (data: string) => void) => evt === 'data' && cb(fakeToken) },
        stderr: { on: vi.fn() },
        on: (evt: string, cb: (code: number) => void) => evt === 'exit' && cb(0),
      });

      const { detectGitHubToken } = await import('./providerAutoDetect');
      const token = await detectGitHubToken();
      expect(token).toBe(fakeToken);
    });

    it('returns null when gh is not available', async () => {
      // pluginRunCommand not a function
      (globalThis as any).pluginRunCommand = undefined;

      const { detectGitHubToken } = await import('./providerAutoDetect');
      const token = await detectGitHubToken();
      expect(token).toBeNull();
    });

    it('returns null when gh auth token fails', async () => {
      mockPluginRunCommand.mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: {
          on: (evt: string, cb: (data: string) => void) =>
            evt === 'data' && cb('not logged in'),
        },
        on: (evt: string, cb: (code: number) => void) => evt === 'exit' && cb(1),
      });

      const { detectGitHubToken } = await import('./providerAutoDetect');
      const token = await detectGitHubToken();
      expect(token).toBeNull();
    });

    it('returns null for short tokens', async () => {
      mockPluginRunCommand.mockReturnValue({
        stdout: { on: (evt: string, cb: (data: string) => void) => evt === 'data' && cb('short') },
        stderr: { on: vi.fn() },
        on: (evt: string, cb: (code: number) => void) => evt === 'exit' && cb(0),
      });

      const { detectGitHubToken } = await import('./providerAutoDetect');
      const token = await detectGitHubToken();
      expect(token).toBeNull();
    });
  });

  describe('validateGitHubToken', () => {
    it('returns username on valid token', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ login: 'testuser' }),
      } as Response);

      const { validateGitHubToken } = await import('./providerAutoDetect');
      const username = await validateGitHubToken('ghp_valid');
      expect(username).toBe('testuser');
      expect(fetchSpy).toHaveBeenCalledWith('https://api.github.com/user', expect.any(Object));
    });

    it('returns null on invalid token', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const { validateGitHubToken } = await import('./providerAutoDetect');
      const username = await validateGitHubToken('ghp_invalid');
      expect(username).toBeNull();
    });

    it('returns null on network error', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network error'));

      const { validateGitHubToken } = await import('./providerAutoDetect');
      const username = await validateGitHubToken('ghp_err');
      expect(username).toBeNull();
    });
  });

  describe('detectOllamaProvider', () => {
    it('returns provider when Ollama is running with models', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3' }, { name: 'mistral' }],
        }),
      } as Response);

      const { detectOllamaProvider } = await import('./providerAutoDetect');
      const provider = await detectOllamaProvider();
      expect(provider).not.toBeNull();
      expect(provider!.providerId).toBe('local');
      expect(provider!.config.model).toBe('llama3');
      expect(provider!.source).toBe('Ollama');
    });

    it('returns null when Ollama is not running', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const { detectOllamaProvider } = await import('./providerAutoDetect');
      const provider = await detectOllamaProvider();
      expect(provider).toBeNull();
    });

    it('returns null when Ollama has no models', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] }),
      } as Response);

      const { detectOllamaProvider } = await import('./providerAutoDetect');
      const provider = await detectOllamaProvider();
      expect(provider).toBeNull();
    });
  });

  describe('detectProviders', () => {
    it('skips providers that are already configured', async () => {
      // Mock that gh auth succeeds
      const fakeToken = 'ghp_' + 'a'.repeat(36);
      mockPluginRunCommand.mockReturnValue({
        stdout: { on: (evt: string, cb: (data: string) => void) => evt === 'data' && cb(fakeToken) },
        stderr: { on: vi.fn() },
        on: (evt: string, cb: (code: number) => void) => evt === 'exit' && cb(0),
      });

      // Mock fetch for both GitHub API validation and Ollama
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        if (String(url).includes('api.github.com')) {
          return { ok: true, json: async () => ({ login: 'testuser' }) } as Response;
        }
        // Ollama not running
        throw new Error('ECONNREFUSED');
      });

      const { detectProviders } = await import('./providerAutoDetect');

      // copilot already configured — should be skipped
      const result = await detectProviders([
        { providerId: 'copilot', config: { apiKey: 'existing' } },
      ]);

      // copilot should not be in results since it's already configured
      expect(result.find((p: DetectedProvider) => p.providerId === 'copilot')).toBeUndefined();
    });

    it('returns empty array when nothing is detected', async () => {
      // pluginRunCommand fails
      mockPluginRunCommand.mockImplementation(() => {
        throw new Error('not available');
      });

      // Ollama not running
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));

      const { detectProviders } = await import('./providerAutoDetect');
      const result = await detectProviders([]);

      expect(result).toEqual([]);
    });
  });
});
