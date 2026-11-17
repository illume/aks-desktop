// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  execCommand: vi.fn(),
  getAzCommand: vi.fn(() => '/bundled/az'),
  native: vi.fn<
    () =>
      | { username?: string; tenantId: string; subscriptionId: string; environmentName: string }
      | undefined
  >(() => undefined),
  generation: vi.fn(() => 0),
  nativeSession: vi.fn(() => false),
  nativeError: vi.fn<() => string | undefined>(() => undefined),
  signedOut: vi.fn(() => false),
}));

vi.mock('../shared/runCommandAsync', () => ({
  runCommandAsync: mocks.execCommand,
}));

vi.mock('./az-cli-path', () => ({
  getAzCommand: mocks.getAzCommand,
}));

vi.mock('./native-auth', () => ({
  getNativeAccount: mocks.native,
  getNativeAuthGeneration: mocks.generation,
  getNativeLoginError: mocks.nativeError,
  hasNativeSession: mocks.nativeSession,
  isAzureExplicitlySignedOut: mocks.signedOut,
}));

import {
  getErrorMessage,
  isAzCliInstalled,
  isAzCliLoggedIn,
  isAzError,
  isCliNotFoundError,
  isValidGuid,
  needsRelogin,
  registerNativeSubscriptionTenantLookup,
  runAzCommand,
  runCommandAsync,
} from './az-cli-core';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getAzCommand.mockReturnValue('/bundled/az');
  mocks.generation.mockReturnValue(0);
  mocks.nativeSession.mockReturnValue(false);
  mocks.signedOut.mockReturnValue(false);
  registerNativeSubscriptionTenantLookup(id => (id.toLowerCase() === 'sub' ? 'tenant' : undefined));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  mocks.native.mockReturnValue(undefined);
  mocks.execCommand.mockImplementation((_command: string, args: string[]) =>
    Promise.resolve({
      stdout: args[0] === 'login' ? '[{}]' : '{"id":"sub","tenantId":"tenant"}',
      stderr: '',
    })
  );
  await runCommandAsync('az', ['login', '--output', 'json']);
});

describe('needsRelogin', () => {
  test.each([
    'Interactive authentication is needed. Please run: az login',
    'AADSTS700082: The refresh token has expired.',
    'AADSTS50173: The provided grant has expired.',
    'Please run "az login" to setup account.',
    'ERROR: Please run az login',
  ])('recognizes Azure CLI login guidance: %s', error => {
    expect(needsRelogin(error)).toBe(true);
  });

  test('does not classify unrelated command failures as relogin guidance', () => {
    expect(needsRelogin('Command execution error: bridge disconnected')).toBe(false);
  });
});

describe('command helpers', () => {
  test('resolves Azure CLI commands through the bundled path', async () => {
    mocks.execCommand.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await expect(runCommandAsync('az', ['version'])).resolves.toEqual({
      stdout: 'ok',
      stderr: '',
    });
    expect(mocks.execCommand).toHaveBeenCalledWith('/bundled/az', ['version']);
  });

  test('passes non-Azure commands through unchanged', async () => {
    mocks.execCommand.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await runCommandAsync('kubectl', ['version']);

    expect(mocks.execCommand).toHaveBeenCalledWith('kubectl', ['version']);
  });

  test('validates GUIDs', () => {
    expect(isValidGuid('12345678-1234-1234-1234-123456789abc')).toBe(true);
    expect(isValidGuid('not-a-guid')).toBe(false);
  });

  test('classifies Azure and missing-command errors', () => {
    expect(isAzError('ERROR: command failed')).toBe(true);
    expect(isAzError('WARNING: retrying')).toBe(false);
    expect(isCliNotFoundError('az: command not found')).toBe(true);
    expect(isCliNotFoundError('Command execution error: spawn az ENOENT')).toBe(true);
    expect(
      isCliNotFoundError("'az.cmd' is not recognized as an internal or external command")
    ).toBe(true);
    expect(isCliNotFoundError('Azure CLI (az) command not found')).toBe(true);
    expect(isCliNotFoundError("ERROR: Resource group 'missing' was not found.")).toBe(false);
    expect(isCliNotFoundError('bridge disconnected')).toBe(false);
  });

  test('normalizes thrown error messages', () => {
    expect(getErrorMessage(new Error('failed'))).toBe('failed');
    expect(getErrorMessage('private value')).toBe('Unknown error');
  });
});

describe('Azure CLI status', () => {
  test.each([
    [{ stdout: '{"azure-cli":"2.78.0"}', stderr: '' }, true],
    [{ stdout: '{"extensions":[]}', stderr: '' }, false],
    [{ stdout: '{invalid', stderr: '' }, false],
    [{ stdout: '', stderr: '' }, false],
    [{ stdout: '', stderr: 'az: command not found' }, false],
  ])('reports installation status for %o', async (result, expected) => {
    mocks.execCommand.mockResolvedValue(result);

    await expect(isAzCliInstalled()).resolves.toBe(expected);
  });

  test('reports Azure CLI as unavailable when the bridge rejects', async () => {
    mocks.execCommand.mockRejectedValue(new Error('bridge failed'));

    await expect(isAzCliInstalled()).resolves.toBe(false);
  });

  test('reports a usable logged-in account', async () => {
    mocks.execCommand.mockResolvedValue({ stdout: 'user@example.com\n', stderr: '' });

    await expect(isAzCliLoggedIn()).resolves.toBe(true);
  });

  test.each([
    'az: command not found',
    'Please run "az login" to setup account.',
    'No active account',
  ])('reports logged out for stderr: %s', async stderr => {
    mocks.execCommand.mockResolvedValue({ stdout: '', stderr });

    await expect(isAzCliLoggedIn()).resolves.toBe(false);
  });

  test('reports logged out when the bridge rejects', async () => {
    mocks.execCommand.mockRejectedValue(new Error('bridge failed'));

    await expect(isAzCliLoggedIn()).resolves.toBe(false);
  });
});

describe('runAzCommand', () => {
  test('returns parsed command output', async () => {
    mocks.execCommand.mockResolvedValue({ stdout: '{"value":42}', stderr: '' });

    await expect(
      runAzCommand(['mock'], 'Running:', 'run mock', stdout => JSON.parse(stdout).value)
    ).resolves.toEqual({ success: true, data: 42 });
  });

  describe('Azure CLI identity guard', () => {
    const native = {
      username: 'User@example.com',
      tenantId: 'tenant',
      subscriptionId: 'sub',
      environmentName: 'AzureCloud',
    };
    const account = {
      id: 'sub',
      user: { name: 'user@example.com' },
      tenantId: 'TENANT',
      cloudName: 'azurecloud',
    };
    const commandResult = { stdout: 'result', stderr: '' };
    const denied = { stdout: '', stderr: expect.stringContaining('ERROR: Azure CLI identity') };

    function mockCli(currentAccount: unknown = account, cloud: unknown = { name: 'AzureCloud' }) {
      mocks.execCommand.mockImplementation((_command: string, args: string[]) => {
        if (args[0] === 'account' && args[1] === 'show') {
          return Promise.resolve({ stdout: JSON.stringify(currentAccount), stderr: '' });
        }
        if (args[0] === 'cloud' && args[1] === 'show') {
          return Promise.resolve({ stdout: JSON.stringify(cloud), stderr: '' });
        }
        return Promise.resolve(commandResult);
      });
    }

    test('allows matching identities and checks the requested subscription', async () => {
      mocks.native.mockReturnValue(native);
      mockCli();
      await expect(
        runCommandAsync('az', ['group', 'list', '--subscription', 'sub'])
      ).resolves.toEqual(commandResult);
      expect(mocks.execCommand).toHaveBeenCalledWith('/bundled/az', [
        'account',
        'show',
        '--subscription',
        'sub',
        '-o',
        'json',
      ]);
    });

    test('uses the discovered tenant for a guest subscription', async () => {
      mocks.native.mockReturnValue(native);
      registerNativeSubscriptionTenantLookup(id =>
        id.toLowerCase() === 'guest' ? 'guest-tenant' : undefined
      );
      mockCli({ ...account, id: 'guest', tenantId: 'GUEST-TENANT' });
      await expect(
        runCommandAsync('az', ['group', 'list', '--subscription', 'guest'])
      ).resolves.toEqual(commandResult);
      mockCli({ ...account, id: 'guest', tenantId: 'wrong-tenant' });
      await expect(
        runCommandAsync('az', ['group', 'list', '--subscription', 'guest'])
      ).resolves.toEqual(denied);
    });

    test('rejects subscriptions absent from native discovery', async () => {
      mocks.native.mockReturnValue(native);
      mockCli({ ...account, id: 'unknown' });
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      mockCli();
      registerNativeSubscriptionTenantLookup(() => undefined);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
    });

    test('verifies every subscription for multi-subscription commands', async () => {
      mocks.native.mockReturnValue(native);
      mocks.execCommand.mockImplementation((_command: string, args: string[]) => {
        if (args[0] === 'cloud')
          return Promise.resolve({ stdout: '{"name":"AzureCloud"}', stderr: '' });
        if (args[0] === 'account') {
          return Promise.resolve({
            stdout: JSON.stringify({ ...account, id: args[3] }),
            stderr: '',
          });
        }
        return Promise.resolve(commandResult);
      });
      await expect(
        runCommandAsync('az', ['graph', 'query', '--subscriptions', 'sub', 'unknown'])
      ).resolves.toEqual(denied);
    });

    test('does not allow an unverified tenant selector', async () => {
      mocks.native.mockReturnValue(native);
      mockCli();
      await expect(
        runCommandAsync('az', ['account', 'get-access-token', '--tenant', 'other'])
      ).resolves.toEqual(denied);
      expect(mocks.execCommand).not.toHaveBeenCalled();
    });

    test.each([
      [{ ...account, user: { name: 'other@example.com' } }, { name: 'AzureCloud' }],
      [{ ...account, tenantId: 'other' }, { name: 'AzureCloud' }],
      [{ ...account, cloudName: 'AzureUSGovernment' }, { name: 'AzureCloud' }],
      [account, { name: 'AzureUSGovernment' }],
      [{ ...account, user: {} }, { name: 'AzureCloud' }],
      [{ ...account, cloudName: undefined }, { name: 'AzureCloud' }],
      [null, { name: 'AzureCloud' }],
    ])('blocks operations when account or cloud cannot be verified', async (cliAccount, cloud) => {
      mocks.native.mockReturnValue(native);
      mockCli(cliAccount, cloud);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      expect(mocks.execCommand).toHaveBeenCalledTimes(2);
    });

    test('blocks lookup errors and malformed identity responses', async () => {
      mocks.native.mockReturnValue(native);
      mocks.execCommand.mockResolvedValue({ stdout: '{bad', stderr: '' });
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      mocks.execCommand.mockResolvedValue({ stdout: '{}', stderr: 'Command exited with code 1' });
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
    });

    test('blocks native login pending and explicitly signed out', async () => {
      mocks.nativeSession.mockReturnValue(true);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      mocks.nativeSession.mockReturnValue(false);
      mocks.signedOut.mockReturnValue(true);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      expect(mocks.execCommand).not.toHaveBeenCalled();
    });

    test('permits CLI fallback after a terminal native login error', async () => {
      mocks.nativeError.mockReturnValue('Device authorization denied');
      mocks.execCommand.mockResolvedValue(commandResult);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(commandResult);
    });

    test('restores CLI fallback after a real native device login fails', async () => {
      const nativeAuth = await vi.importActual<typeof import('./native-auth')>('./native-auth');
      mocks.native.mockImplementation(nativeAuth.getNativeAccount);
      mocks.generation.mockImplementation(nativeAuth.getNativeAuthGeneration);
      mocks.nativeSession.mockImplementation(nativeAuth.hasNativeSession);
      mocks.signedOut.mockImplementation(nativeAuth.isAzureExplicitlySignedOut);
      mocks.execCommand.mockResolvedValue(commandResult);
      vi.useFakeTimers();
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                device_code: 'device',
                user_code: 'code',
                verification_uri: 'https://microsoft.com/devicelogin',
                expires_in: 30,
                interval: 1,
              })
            )
          )
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ error: 'access_denied', error_description: 'Denied' }), {
              status: 400,
            })
          )
      );
      const open = vi.spyOn(window, 'open').mockImplementation(() => null);
      try {
        nativeAuth.allowAzureCliFallback();
        await nativeAuth.initiateNativeLogin();
        await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
        await vi.advanceTimersByTimeAsync(1000);
        expect(nativeAuth.getNativeLoginError()).toBe('Denied');
        expect(nativeAuth.hasNativeSession()).toBe(false);
        await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(commandResult);
      } finally {
        nativeAuth.logoutNative();
        open.mockRestore();
        vi.useRealTimers();
        vi.unstubAllGlobals();
      }
    });

    test('allows metadata and non-az commands while signed out', async () => {
      mocks.signedOut.mockReturnValue(true);
      mocks.execCommand.mockResolvedValue(commandResult);
      for (const args of [['version'], ['cloud', 'show'], ['account', 'show'], ['logout']]) {
        await expect(runCommandAsync('az', args)).resolves.toEqual(commandResult);
      }
      await expect(runCommandAsync('kubectl', ['get', 'pods'])).resolves.toEqual(commandResult);
    });

    test('blocks during login and after failure until a successful retry', async () => {
      let finishLogin!: (value: { stdout: string; stderr: string }) => void;
      mocks.execCommand.mockImplementation((_command: string, args: string[]) =>
        args[0] === 'login'
          ? new Promise(resolve => {
              finishLogin = resolve;
            })
          : Promise.resolve(commandResult)
      );
      const login = runCommandAsync('az', ['login', '--output', 'json']);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      finishLogin({ stdout: '', stderr: 'ERROR: login failed' });
      await login;
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      mocks.execCommand
        .mockResolvedValueOnce({ stdout: '[{}]', stderr: '' })
        .mockResolvedValueOnce({ stdout: '{"id":"sub","tenantId":"tenant"}', stderr: '' });
      await runCommandAsync('az', ['login', '--output', 'json']);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(commandResult);
    });

    test('rejects a stale verification when login starts during the check', async () => {
      mocks.native.mockReturnValue(native);
      let finishAccount!: (value: { stdout: string; stderr: string }) => void;
      let finishLogin!: (value: { stdout: string; stderr: string }) => void;
      mocks.execCommand.mockImplementation((_command: string, args: string[]) => {
        if (args[0] === 'account') return new Promise(resolve => (finishAccount = resolve));
        if (args[0] === 'login') return new Promise(resolve => (finishLogin = resolve));
        return Promise.resolve({ stdout: JSON.stringify({ name: 'AzureCloud' }), stderr: '' });
      });
      const operation = runCommandAsync('az', ['group', 'list']);
      const login = runCommandAsync('az', ['login']);
      finishAccount({ stdout: JSON.stringify(account), stderr: '' });
      await expect(operation).resolves.toEqual(denied);
      finishLogin({ stdout: '', stderr: 'ERROR: failed' });
      await login;
    });

    test('rejects a native session change during verification', async () => {
      mocks.native.mockReturnValue(native);
      mockCli();
      mocks.generation.mockReturnValueOnce(1).mockReturnValue(2);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
    });

    test('blocks other operations while CLI account selection is changing', async () => {
      let finishSet!: (value: { stdout: string; stderr: string }) => void;
      mocks.execCommand.mockImplementation((_command: string, args: string[]) =>
        args[0] === 'account' && args[1] === 'set'
          ? new Promise(resolve => (finishSet = resolve))
          : Promise.resolve(commandResult)
      );
      const change = runCommandAsync('az', ['account', 'set', '--subscription', 'sub']);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      finishSet(commandResult);
      await change;
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(commandResult);
    });

    test('keeps the login barrier until post-login verification completes', async () => {
      mocks.native.mockReturnValue(native);
      let finishAccount!: (value: { stdout: string; stderr: string }) => void;
      mocks.execCommand.mockImplementation((_command: string, args: string[]) => {
        if (args[0] === 'login') return Promise.resolve({ stdout: '[{}]', stderr: '' });
        if (args[0] === 'account') return new Promise(resolve => (finishAccount = resolve));
        if (args[0] === 'cloud') {
          return Promise.resolve({ stdout: '{"name":"AzureCloud"}', stderr: '' });
        }
        return Promise.resolve(commandResult);
      });
      const login = runCommandAsync('az', ['login']);
      await Promise.resolve();
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
      finishAccount({ stdout: JSON.stringify(account), stderr: '' });
      await expect(login).resolves.toEqual({ stdout: '[{}]', stderr: '' });
    });

    test('keeps operations blocked when login succeeds but account verification fails', async () => {
      mocks.native.mockReturnValue(native);
      mockCli({ ...account, user: { name: 'other@example.com' } });
      mocks.execCommand.mockImplementationOnce(() =>
        Promise.resolve({ stdout: '[{}]', stderr: '' })
      );
      await expect(runCommandAsync('az', ['login'])).resolves.toEqual(denied);
      await expect(runCommandAsync('az', ['group', 'list'])).resolves.toEqual(denied);
    });
  });

  test('returns success without a parser', async () => {
    mocks.execCommand.mockResolvedValue({ stdout: '', stderr: 'WARNING: harmless' });

    await expect(runAzCommand(['mock'], 'Running:', 'run mock')).resolves.toEqual({
      success: true,
      data: undefined,
    });
  });

  test('returns an authentication error for relogin guidance', async () => {
    mocks.execCommand.mockResolvedValue({
      stdout: '',
      stderr: 'Please run "az login" to setup account.',
    });

    await expect(runAzCommand(['mock'], 'Running:', 'run mock')).resolves.toEqual({
      success: false,
      error: 'Authentication required. Please log in to Azure CLI: az login',
    });
  });

  test('allows a stderr callback to return a domain result', async () => {
    mocks.execCommand.mockResolvedValue({ stdout: '', stderr: 'WARNING: partial result' });

    await expect(
      runAzCommand(['mock'], 'Running:', 'run mock', undefined, () => ({
        success: true,
        warning: true,
      }))
    ).resolves.toEqual({ success: true, warning: true });
  });

  test('falls through when a stderr callback declines the result', async () => {
    mocks.execCommand.mockResolvedValue({ stdout: '', stderr: 'ERROR: failed' });

    await expect(
      runAzCommand(['mock'], 'Running:', 'run mock', undefined, () => null)
    ).resolves.toEqual({
      success: false,
      error: 'Failed to run mock: ERROR: failed',
    });
  });

  test('reports parser and command exceptions', async () => {
    mocks.execCommand
      .mockResolvedValueOnce({ stdout: '{invalid', stderr: '' })
      .mockRejectedValueOnce('private failure');

    await expect(
      runAzCommand(['mock'], 'Running:', 'parse output', stdout => JSON.parse(stdout))
    ).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('Failed to parse output'),
    });
    await expect(runAzCommand(['mock'], 'Running:', 'run mock')).resolves.toEqual({
      success: false,
      error: 'Failed to run mock: Unknown error',
    });
  });
});
