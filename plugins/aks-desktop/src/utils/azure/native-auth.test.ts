// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openExternalUrl: vi.fn(), getSubscriptions: vi.fn() }));

vi.mock('../shared/openExternalUrl', () => ({
  openExternalUrl: mocks.openExternalUrl,
}));

vi.mock('./az-subscriptions', () => ({
  getSubscriptions: mocks.getSubscriptions,
}));

import {
  allowAzureCliFallback,
  getNativeAccount,
  getNativeAuthGeneration,
  getNativeCloudName,
  getNativeLoginError,
  hasNativeSession,
  initiateNativeLogin,
  isAzureExplicitlySignedOut,
  logoutNative,
  nativeCredential,
} from './native-auth';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jwt(claims: Record<string, string>) {
  return `header.${btoa(JSON.stringify(claims))}.signature`;
}

function deviceResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse({
    device_code: 'device-code',
    user_code: 'CODE',
    verification_uri: 'https://microsoft.com/devicelogin',
    expires_in: 900,
    interval: 1,
    ...overrides,
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

async function establishSession(signal?: AbortSignal) {
  vi.mocked(fetch)
    .mockResolvedValueOnce(deviceResponse())
    .mockResolvedValueOnce(
      jsonResponse({
        access_token: 'arm-token',
        refresh_token: 'refresh-token',
        id_token: jwt({ tid: 'home-tenant' }),
        expires_in: 3600,
      })
    );
  await initiateNativeLogin(signal);
  await vi.advanceTimersByTimeAsync(1_000);
}

describe('native Azure authentication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    mocks.getSubscriptions
      .mockReset()
      .mockResolvedValue([{ id: 'subscription-id', status: 'Enabled', tenant: 'home-tenant' }]);
    logoutNative();
    allowAzureCliFallback();
  });

  afterEach(() => {
    logoutNative();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test('completes device login and exposes a reusable ARM token without invoking Azure CLI', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          device_code: 'device-code',
          user_code: 'ABCD-EFGH',
          verification_uri: 'https://microsoft.com/devicelogin',
          message: 'Enter code ABCD-EFGH',
          expires_in: 900,
          interval: 1,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'arm-token',
          refresh_token: 'refresh-token',
          id_token: jwt({
            preferred_username: 'user@example.com',
            tid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          }),
          expires_in: 3600,
        })
      );
    mocks.getSubscriptions.mockResolvedValueOnce([
      {
        id: '11111111-2222-3333-4444-555555555555',
        status: 'Enabled',
        tenant: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      },
    ]);

    await expect(initiateNativeLogin()).resolves.toEqual({
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://microsoft.com/devicelogin',
      message: 'Enter code ABCD-EFGH',
    });
    expect(hasNativeSession()).toBe(true);
    expect(mocks.openExternalUrl).toHaveBeenCalledWith('https://microsoft.com/devicelogin');

    await vi.advanceTimersByTimeAsync(1_000);

    expect(getNativeAccount()).toEqual({
      username: 'user@example.com',
      tenantId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      subscriptionId: '11111111-2222-3333-4444-555555555555',
      environmentName: 'AzureCloud',
    });
    await expect(
      nativeCredential.getToken('https://management.core.windows.net//.default')
    ).resolves.toEqual(expect.objectContaining({ token: 'arm-token' }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchMock.mock.calls) {
      expect(new Headers(options?.headers).get('x-ms-useragent')).toBe('AZURECLI/2.0.0');
    }
  });

  test('uses the refresh token for tenant-specific scopes and clears it on logout', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          device_code: 'device-code',
          user_code: 'CODE',
          verification_uri: 'https://microsoft.com/devicelogin',
          expires_in: 900,
          interval: 1,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'arm-token',
          refresh_token: 'refresh-token',
          id_token: jwt({ tid: 'home-tenant' }),
          expires_in: 3600,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'graph-token',
          refresh_token: 'rotated-refresh-token',
          expires_in: 3600,
        })
      );

    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(
      nativeCredential.getToken('https://graph.microsoft.com/.default', {
        tenantId: 'guest-tenant',
      })
    ).resolves.toEqual(expect.objectContaining({ token: 'graph-token' }));

    const [url, options] = fetchMock.mock.calls[2];
    expect(url).toBe('https://login.microsoftonline.com/guest-tenant/oauth2/v2.0/token');
    expect(String(options?.body)).toContain('grant_type=refresh_token');
    expect(String(options?.body)).toContain('refresh_token=refresh-token');

    logoutNative();
    expect(hasNativeSession()).toBe(false);
    await expect(nativeCredential.getToken('https://graph.microsoft.com/.default')).rejects.toThrow(
      'Azure login is required'
    );
  });

  test.each([
    [
      'AzureUSGovernment',
      'https://login.microsoftonline.us',
      'https://management.core.usgovcloudapi.net//.default',
    ],
    [
      'AzureChinaCloud',
      'https://login.chinacloudapi.cn',
      'https://management.core.chinacloudapi.cn//.default',
    ],
  ])(
    'uses the selected %s authority and audience for login and refresh',
    async (cloud, authority, scope) => {
      vi.mocked(fetch)
        .mockResolvedValueOnce(deviceResponse({ verification_uri: '' }))
        .mockResolvedValueOnce(
          jsonResponse({ access_token: 'arm', refresh_token: 'refresh', expires_in: 3600 })
        )
        .mockResolvedValueOnce(jsonResponse({ access_token: 'other', expires_in: 3600 }));
      await initiateNativeLogin(undefined, cloud);
      expect(getNativeCloudName()).toBe(cloud);
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        `${authority}/common/oauth2/v2.0/devicecode`,
        expect.objectContaining({
          body: expect.any(URLSearchParams),
        })
      );
      expect(String(vi.mocked(fetch).mock.calls[0][1]?.body)).toContain(encodeURIComponent(scope));
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getNativeAccount()?.environmentName).toBe(cloud);
      expect(vi.mocked(fetch).mock.calls[1][0]).toBe(`${authority}/common/oauth2/v2.0/token`);
      await nativeCredential.getToken('https://example.com/.default', { tenantId: 'guest' });
      expect(vi.mocked(fetch).mock.calls[2][0]).toBe(`${authority}/guest/oauth2/v2.0/token`);
    }
  );

  test('rejects unsupported native clouds without disturbing an existing session', async () => {
    await establishSession();
    await expect(initiateNativeLogin(undefined, 'CustomCloud')).rejects.toThrow(
      'Unsupported Azure cloud for native login'
    );
    expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
  });

  test('cancels a device request on logout and does not open or poll it', async () => {
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    const login = initiateNativeLogin();
    const result = expect(login).rejects.toThrow('Azure login was cancelled');
    expect(hasNativeSession()).toBe(true);
    logoutNative();
    request.resolve(deviceResponse());
    await result;
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mocks.openExternalUrl).not.toHaveBeenCalled();
    expect(hasNativeSession()).toBe(false);
  });

  test('a late device response cannot replace a newer login', async () => {
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise).mockResolvedValueOnce(deviceResponse());
    const oldLogin = initiateNativeLogin();
    const result = expect(oldLogin).rejects.toThrow('Azure login was cancelled');
    await initiateNativeLogin();
    request.resolve(deviceResponse({ user_code: 'OLD' }));
    await result;
    expect(mocks.openExternalUrl).toHaveBeenCalledTimes(1);
    expect(hasNativeSession()).toBe(true);
  });

  test('does not poll after logout while waiting for the interval', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse());
    await initiateNativeLogin();
    logoutNative();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getNativeLoginError()).toBeUndefined();
  });

  test('a stale polling failure cannot clear a newer session', async () => {
    const poll = deferred<Response>();
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse()).mockReturnValueOnce(poll.promise);
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    await establishSession();
    poll.resolve(jsonResponse({ error: 'access_denied', error_description: 'Denied' }, 400));
    await vi.advanceTimersByTimeAsync(0);
    expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
    expect(getNativeLoginError()).toBeUndefined();
  });

  test('expires at the deadline without polling after it', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse({ expires_in: 2, interval: 5 }));
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(getNativeLoginError()).toBe('Azure device login expired');
    expect(hasNativeSession()).toBe(false);
  });

  test('expires while a token request is pending and rejects late responses', async () => {
    const poll = deferred<Response>();
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse({ expires_in: 2 }))
      .mockReturnValueOnce(poll.promise);
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(getNativeLoginError()).toBe('Azure device login expired');
    expect(hasNativeSession()).toBe(false);
    poll.resolve(jsonResponse({ access_token: 'late', expires_in: 3600 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('retries malformed transient polling responses', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(new Response('not json', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(
        jsonResponse({ error: 'access_denied', error_description: 'Denied' }, 400)
      );
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(getNativeLoginError()).toBe('Denied');
    expect(hasNativeSession()).toBe(false);
  });

  test('honors pending and slow-down responses before expiring', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse({ expires_in: 9 }))
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(jsonResponse({ error: 'authorization_pending' }, 400))
      .mockResolvedValueOnce(jsonResponse({ error: 'slow_down' }, 400));
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(9_000);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(getNativeLoginError()).toBe('Azure device login expired');
    expect(hasNativeSession()).toBe(false);
  });

  test('rejects invalid device responses without leaving a pending session', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse({ expires_in: 0 }));
    const generation = getNativeAuthGeneration();
    await expect(initiateNativeLogin()).rejects.toThrow('Invalid Azure authentication response');
    expect(hasNativeSession()).toBe(false);
    expect(getNativeCloudName()).toBeUndefined();
    expect(getNativeAuthGeneration()).toBeGreaterThan(generation + 1);
    expect(mocks.openExternalUrl).not.toHaveBeenCalled();
  });

  test('rejects malformed successful token responses', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(jsonResponse({}));
    await initiateNativeLogin();
    const generation = getNativeAuthGeneration();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getNativeLoginError()).toBe('Invalid Azure authentication response');
    expect(hasNativeSession()).toBe(false);
    expect(getNativeCloudName()).toBeUndefined();
    expect(getNativeAuthGeneration()).toBeGreaterThan(generation);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('publishes the enabled subscription from any tenant only after discovery succeeds', async () => {
    const discovery = deferred<unknown[]>();
    mocks.getSubscriptions.mockReturnValueOnce(discovery.promise);
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'arm', refresh_token: 'refresh', expires_in: 3600 })
      );
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getNativeAccount()).toBeUndefined();
    discovery.resolve([
      { id: 'disabled', tenant: 'home', status: 'Disabled' },
      { id: 'guest-subscription', tenant: 'guest', status: 'Enabled' },
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(getNativeAccount()).toEqual(
      expect.objectContaining({
        tenantId: 'guest',
        subscriptionId: 'guest-subscription',
      })
    );
  });

  test('discovers paginated tenants and subscriptions before publishing a guest account', async () => {
    const actual = await vi.importActual<typeof import('./az-subscriptions')>('./az-subscriptions');
    mocks.getSubscriptions.mockImplementation(actual.getSubscriptions);
    const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const subscriptionA = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const subscription = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    vi.mocked(fetch).mockImplementation(async (input, options) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/devicecode')) return deviceResponse();
      if (url.pathname.endsWith('/token')) {
        const body = new URLSearchParams(String(options?.body));
        if (body.get('grant_type')?.includes('device_code')) {
          return jsonResponse({ access_token: 'arm', refresh_token: 'refresh', expires_in: 3600 });
        }
        return jsonResponse({
          access_token: url.pathname.includes(tenantA) ? 'tenant-a' : 'tenant-b',
          expires_in: 3600,
        });
      }
      if (url.pathname === '/tenants') {
        return url.searchParams.has('page')
          ? jsonResponse({ value: [{ tenantId: tenantB }] })
          : jsonResponse({
              value: [{ tenantId: tenantA }],
              nextLink: 'https://management.azure.com/tenants?page=2',
            });
      }
      if (url.pathname === '/subscriptions') {
        const authorization = new Headers(options?.headers).get('authorization');
        if (authorization?.endsWith('tenant-a')) {
          return jsonResponse({
            value: [{ subscriptionId: subscriptionA, tenantId: tenantA, state: 'Disabled' }],
          });
        }
        if (url.searchParams.has('page')) {
          return jsonResponse({
            value: [{ subscriptionId: subscription, tenantId: tenantA, state: 'Enabled' }],
          });
        }
        return jsonResponse({
          value: [],
          nextLink: 'https://management.azure.com/subscriptions?page=2',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getNativeAccount()).toEqual(
      expect.objectContaining({
        tenantId: tenantB,
        subscriptionId: subscription,
      })
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ href: 'https://management.azure.com/subscriptions?page=2' }),
      expect.anything()
    );
    window.dispatchEvent(new CustomEvent('azure-account-change'));
    window.dispatchEvent(new CustomEvent('azure-auth-update'));
    const { getSubscriptionCredential } = await import('./az-token');
    await expect(
      getSubscriptionCredential(subscriptionA).getToken('https://management.azure.com/.default')
    ).resolves.toEqual(expect.objectContaining({ token: 'tenant-a' }));
  });

  test('reports discovery failures rather than misidentifying them as no subscriptions', async () => {
    mocks.getSubscriptions.mockRejectedValueOnce(new Error('ARM returned HTTP 403'));
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(jsonResponse({ access_token: 'arm', expires_in: 3600 }));
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getNativeAccount()).toBeUndefined();
    expect(getNativeLoginError()).toBe('ARM returned HTTP 403');
    expect(hasNativeSession()).toBe(false);
    expect(isAzureExplicitlySignedOut()).toBe(true);
  });

  test('reports terminal home-tenant refresh failure during login discovery', async () => {
    mocks.getSubscriptions.mockImplementationOnce(async () => {
      await nativeCredential.getToken('discovery-scope', { tenantId: 'home-tenant' });
      return [];
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'arm',
          refresh_token: 'refresh',
          id_token: jwt({ tid: 'home-tenant' }),
          expires_in: 3600,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ error: 'invalid_grant', error_description: 'Refresh token revoked' }, 400)
      );
    const observedErrors: Array<string | undefined> = [];
    const onChange = () => observedErrors.push(getNativeLoginError());
    window.addEventListener('azure-account-change', onChange);
    try {
      await initiateNativeLogin();
      await vi.advanceTimersByTimeAsync(1_000);
      expect(getNativeLoginError()).toBe('Refresh token revoked');
      expect(observedErrors).toContain('Refresh token revoked');
      expect(hasNativeSession()).toBe(false);
      expect(getNativeAccount()).toBeUndefined();
      expect(isAzureExplicitlySignedOut()).toBe(true);
    } finally {
      window.removeEventListener('azure-account-change', onChange);
    }
  });

  test('a cancelled discovery ignores a late terminal refresh failure', async () => {
    const refresh = deferred<Response>();
    const controller = new AbortController();
    mocks.getSubscriptions.mockImplementationOnce(async () => {
      await nativeCredential.getToken('discovery-scope', { tenantId: 'home-tenant' });
      return [];
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(
        jsonResponse({
          access_token: 'arm',
          refresh_token: 'refresh',
          id_token: jwt({ tid: 'home-tenant' }),
          expires_in: 3600,
        })
      )
      .mockReturnValueOnce(refresh.promise);
    await initiateNativeLogin(controller.signal);
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    await establishSession();
    refresh.resolve(
      jsonResponse({ error: 'invalid_grant', error_description: 'Old refresh revoked' }, 400)
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(getNativeLoginError()).toBeUndefined();
    expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
    expect(isAzureExplicitlySignedOut()).toBe(false);
  });

  test('reports no enabled subscriptions only after a successful discovery', async () => {
    mocks.getSubscriptions.mockResolvedValueOnce([
      { id: 'disabled', tenant: 'home', status: 'Disabled' },
    ]);
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(jsonResponse({ access_token: 'arm', expires_in: 3600 }));
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(getNativeLoginError()).toBe(
      'No enabled Azure subscriptions were found for this account'
    );
    expect(getNativeAccount()).toBeUndefined();
  });

  test('does not publish an account when discovery finishes after cancellation', async () => {
    const discovery = deferred<unknown[]>();
    mocks.getSubscriptions.mockReturnValueOnce(discovery.promise);
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(jsonResponse({ access_token: 'arm', expires_in: 3600 }));
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    logoutNative();
    discovery.resolve([{ id: 'late', tenant: 'guest', status: 'Enabled' }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(getNativeAccount()).toBeUndefined();
    expect(isAzureExplicitlySignedOut()).toBe(true);
  });

  test('clears the session on terminal refresh credential errors', async () => {
    await establishSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_grant', error_description: 'Refresh token revoked' }, 400)
    );
    await expect(nativeCredential.getToken('other-scope')).rejects.toThrow('Refresh token revoked');
    expect(hasNativeSession()).toBe(false);
    expect(getNativeAccount()).toBeUndefined();
    await expect(nativeCredential.getToken('other-scope')).rejects.toThrow(
      'Azure login is required'
    );
  });

  test('retains the session after transient refresh failures', async () => {
    await establishSession();
    vi.mocked(fetch).mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    await expect(nativeCredential.getToken('other-scope')).rejects.toThrow();
    expect(hasNativeSession()).toBe(true);
    expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
  });

  test.each(['fetch', 'body'])(
    'times out a hung refresh %s, retries, and ignores its late response',
    async stage => {
      await establishSession();
      const request = deferred<Response>();
      const body = deferred<unknown>();
      const response = jsonResponse({});
      vi.spyOn(response, 'json').mockReturnValue(body.promise);
      vi.mocked(fetch).mockReturnValueOnce(
        stage === 'fetch' ? request.promise : Promise.resolve(response)
      );
      const first = nativeCredential.getToken('other-scope');
      const second = nativeCredential.getToken('other-scope');
      const failures = Promise.all([
        expect(first).rejects.toThrow('Azure token refresh timed out'),
        expect(second).rejects.toThrow('Azure token refresh timed out'),
      ]);
      const signal = vi.mocked(fetch).mock.calls[2][1]?.signal;
      await vi.advanceTimersByTimeAsync(29_999);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await failures;
      expect(signal?.aborted).toBe(true);
      expect(hasNativeSession()).toBe(true);

      const retry = deferred<Response>();
      vi.mocked(fetch).mockReturnValueOnce(retry.promise);
      const fresh = nativeCredential.getToken('other-scope');
      if (stage === 'fetch') {
        request.resolve(
          jsonResponse({ access_token: 'late', refresh_token: 'late-refresh', expires_in: 3600 })
        );
      } else {
        body.resolve({ access_token: 'late', refresh_token: 'late-refresh', expires_in: 3600 });
      }
      await vi.advanceTimersByTimeAsync(0);
      retry.resolve(
        jsonResponse({ access_token: 'fresh', refresh_token: 'fresh-refresh', expires_in: 3600 })
      );
      await expect(fresh).resolves.toMatchObject({ token: 'fresh' });
      await expect(nativeCredential.getToken('other-scope')).resolves.toMatchObject({
        token: 'fresh',
      });
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ access_token: 'another', expires_in: 3600 })
      );
      await nativeCredential.getToken('another-scope');
      expect(String(vi.mocked(fetch).mock.calls[4][1]?.body)).toContain(
        'refresh_token=fresh-refresh'
      );
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  test('a late terminal refresh failure after timeout cannot sign out the session', async () => {
    await establishSession();
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    const result = expect(nativeCredential.getToken('other-scope')).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(30_000);
    await result;
    request.resolve(jsonResponse({ error: 'invalid_grant' }, 400));
    await vi.advanceTimersByTimeAsync(0);
    expect(hasNativeSession()).toBe(true);
    expect(isAzureExplicitlySignedOut()).toBe(false);
  });

  test('a refresh response after logout cannot affect a new session', async () => {
    await establishSession();
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    const result = expect(nativeCredential.getToken('other-scope')).rejects.toThrow(
      'Azure login was cancelled'
    );
    logoutNative();
    await establishSession();
    request.resolve(
      jsonResponse({ access_token: 'stale', refresh_token: 'stale', expires_in: 3600 })
    );
    await result;
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ access_token: 'fresh', expires_in: 3600 })
    );
    await expect(nativeCredential.getToken('other-scope')).resolves.toMatchObject({
      token: 'fresh',
    });
    expect(String(vi.mocked(fetch).mock.calls[5][1]?.body)).toContain(
      'refresh_token=refresh-token'
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  test('caller cancellation does not abort a shared refresh or evict its result', async () => {
    await establishSession();
    const controller = new AbortController();
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    const cancelled = nativeCredential.getToken('other-scope', { abortSignal: controller.signal });
    const other = nativeCredential.getToken('other-scope');
    const result = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    expect(vi.mocked(fetch).mock.calls[2][1]?.signal?.aborted).toBe(false);
    request.resolve(jsonResponse({ access_token: 'shared', expires_in: 3600 }));
    await expect(other).resolves.toMatchObject({ token: 'shared' });
    await expect(nativeCredential.getToken('other-scope')).resolves.toMatchObject({
      token: 'shared',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('an aborted caller leaves the shared timeout and retry available to other callers', async () => {
    await establishSession();
    const controller = new AbortController();
    const reason = new Error('caller cancelled');
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    const cancelled = nativeCredential.getToken('other-scope', { abortSignal: controller.signal });
    const other = nativeCredential.getToken('other-scope');
    const cancellation = expect(cancelled).rejects.toBe(reason);
    const timeout = expect(other).rejects.toThrow('Azure token refresh timed out');
    controller.abort(reason);
    await cancellation;
    await vi.advanceTimersByTimeAsync(30_000);
    await timeout;
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ access_token: 'fresh', expires_in: 3600 })
    );
    await expect(nativeCredential.getToken('other-scope')).resolves.toMatchObject({
      token: 'fresh',
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  test('an already-aborted token caller neither uses the cache nor starts a refresh', async () => {
    await establishSession();
    const controller = new AbortController();
    controller.abort();
    await expect(
      nativeCredential.getToken('other-scope', { abortSignal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      nativeCredential.getToken('https://management.core.windows.net//.default', {
        abortSignal: controller.signal,
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('concurrent callers refresh an expired cached token only once', async () => {
    await establishSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ access_token: 'short-lived', expires_in: 10 })
    );
    await nativeCredential.getToken('other-scope');
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    const first = nativeCredential.getToken('other-scope');
    const second = nativeCredential.getToken('other-scope');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(4);
    request.resolve(jsonResponse({ access_token: 'fresh', expires_in: 3600 }));
    await expect(first).resolves.toMatchObject({ token: 'fresh' });
    await expect(second).resolves.toMatchObject({ token: 'fresh' });
  });

  test('an older successful refresh cannot replace a rotated refresh credential', async () => {
    await establishSession();
    const old = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'new', refresh_token: 'rotated', expires_in: 3600 })
      );
    const pending = nativeCredential.getToken('old-scope');
    await nativeCredential.getToken('new-scope');
    old.resolve(jsonResponse({ access_token: 'old', refresh_token: 'stale', expires_in: 3600 }));
    await pending;
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ access_token: 'another', expires_in: 3600 })
    );
    await nativeCredential.getToken('another-scope');
    expect(String(vi.mocked(fetch).mock.calls[4][1]?.body)).toContain('refresh_token=rotated');
  });

  test.each(['invalid_grant', 'interaction_required', 'login_required'])(
    'retains the home session when a guest tenant returns %s',
    async error => {
      await establishSession();
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse({ error, error_description: 'Guest tenant requires interaction' }, 400)
      );
      await expect(
        nativeCredential.getToken('other-scope', { tenantId: 'guest-tenant' })
      ).rejects.toThrow('Guest tenant requires interaction');
      expect(hasNativeSession()).toBe(true);
      expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
    }
  );

  test('clears an expired refresh credential when requested for the home tenant', async () => {
    await establishSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { error: 'invalid_grant', error_description: 'AADSTS700082: Refresh token expired' },
        400
      )
    );
    await expect(
      nativeCredential.getToken('other-scope', { tenantId: 'home-tenant' })
    ).rejects.toThrow('Refresh token expired');
    expect(hasNativeSession()).toBe(false);
    expect(getNativeAccount()).toBeUndefined();
  });

  test('retains the session for an expired-token error from a guest tenant', async () => {
    await establishSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(
        { error: 'invalid_grant', error_description: 'AADSTS700082: Refresh token expired' },
        400
      )
    );
    await expect(
      nativeCredential.getToken('other-scope', { tenantId: 'guest-tenant' })
    ).rejects.toThrow('Refresh token expired');
    expect(hasNativeSession()).toBe(true);
  });

  test('does not invalidate the home session when the default subscription is in a guest tenant', async () => {
    mocks.getSubscriptions.mockResolvedValueOnce([
      { id: 'guest-subscription', status: 'Enabled', tenant: 'guest-tenant' },
    ]);
    await establishSession();
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'invalid_grant', error_description: 'Guest requires interaction' }, 400)
    );
    await expect(nativeCredential.getToken('other-scope')).rejects.toThrow(
      'Guest requires interaction'
    );
    expect(getNativeAccount()?.subscriptionId).toBe('guest-subscription');
    expect(hasNativeSession()).toBe(true);
  });

  test('retains the session if its home tenant cannot be established', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'arm', refresh_token: 'refresh', expires_in: 3600 })
      );
    await initiateNativeLogin();
    await vi.advanceTimersByTimeAsync(1_000);
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400));
    await expect(nativeCredential.getToken('other-scope')).rejects.toThrow();
    expect(hasNativeSession()).toBe(true);
  });

  test('a stale refresh failure cannot clear a newer session', async () => {
    await establishSession();
    const refresh = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(refresh.promise);
    const result = expect(nativeCredential.getToken('other-scope')).rejects.toThrow(
      'Azure login was cancelled'
    );
    await establishSession();
    refresh.resolve(jsonResponse({ error: 'invalid_grant' }, 400));
    await result;
    expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
  });

  test('a failure using an old refresh token cannot clear a rotated credential', async () => {
    await establishSession();
    const oldRefresh = deferred<Response>();
    vi.mocked(fetch)
      .mockReturnValueOnce(oldRefresh.promise)
      .mockResolvedValueOnce(
        jsonResponse({ access_token: 'new-token', refresh_token: 'rotated', expires_in: 3600 })
      );
    const result = expect(nativeCredential.getToken('old-scope')).rejects.toThrow(
      'Azure authentication failed'
    );
    await nativeCredential.getToken('new-scope');
    oldRefresh.resolve(jsonResponse({ error: 'invalid_grant' }, 400));
    await result;
    expect(hasNativeSession()).toBe(true);
    expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
  });

  test('abort promptly cancels device acquisition and ignores the eventual response', async () => {
    const controller = new AbortController();
    const request = deferred<Response>();
    vi.mocked(fetch).mockReturnValueOnce(request.promise);
    const result = expect(initiateNativeLogin(controller.signal)).rejects.toThrow(
      'Azure login was cancelled'
    );
    controller.abort();
    await result;
    request.resolve(deviceResponse());
    await vi.advanceTimersByTimeAsync(2_000);
    expect(hasNativeSession()).toBe(false);
    expect(mocks.openExternalUrl).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('abort during polling cancels only its attempt', async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse());
    await initiateNativeLogin(controller.signal);
    controller.abort();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(hasNativeSession()).toBe(false);
    expect(getNativeLoginError()).toBeUndefined();
  });

  test('abort ignores an in-flight polling response', async () => {
    const controller = new AbortController();
    const poll = deferred<Response>();
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse()).mockReturnValueOnce(poll.promise);
    await initiateNativeLogin(controller.signal);
    await vi.advanceTimersByTimeAsync(1_000);
    controller.abort();
    poll.resolve(jsonResponse({ access_token: 'late', expires_in: 3600 }));
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(hasNativeSession()).toBe(false);
    expect(getNativeLoginError()).toBeUndefined();
  });

  test('abort of an old attempt cannot cancel a newer attempt', async () => {
    const controller = new AbortController();
    vi.mocked(fetch)
      .mockResolvedValueOnce(deviceResponse())
      .mockResolvedValueOnce(deviceResponse());
    await initiateNativeLogin(controller.signal);
    await initiateNativeLogin();
    controller.abort();
    expect(hasNativeSession()).toBe(true);
  });

  test('abort after successful login does not clear the session', async () => {
    const controller = new AbortController();
    await establishSession(controller.signal);
    controller.abort();
    expect(getNativeAccount()?.subscriptionId).toBe('subscription-id');
    expect(hasNativeSession()).toBe(true);
  });

  test('an already-aborted signal does not clear an existing session', async () => {
    await establishSession();
    const controller = new AbortController();
    controller.abort();
    await expect(initiateNativeLogin(controller.signal)).rejects.toThrow(
      'Azure login was cancelled'
    );
    expect(hasNativeSession()).toBe(true);
  });

  test('explicit logout suppresses CLI fallback until the user chooses CLI sign-in', async () => {
    await establishSession();
    const events = vi.spyOn(window, 'dispatchEvent');
    logoutNative();
    expect(isAzureExplicitlySignedOut()).toBe(true);
    expect(hasNativeSession()).toBe(false);
    expect(events).toHaveBeenCalledWith(expect.objectContaining({ type: 'azure-account-change' }));
    events.mockRestore();
    allowAzureCliFallback();
    expect(isAzureExplicitlySignedOut()).toBe(false);
  });

  test('cancelling native sign-in blocks implicit CLI access', async () => {
    const controller = new AbortController();
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse());
    await initiateNativeLogin(controller.signal);
    controller.abort();
    expect(isAzureExplicitlySignedOut()).toBe(true);

    logoutNative();
    const second = new AbortController();
    vi.mocked(fetch).mockResolvedValueOnce(deviceResponse());
    await initiateNativeLogin(second.signal);
    second.abort();
    expect(isAzureExplicitlySignedOut()).toBe(true);
  });

  test('successful native sign-in clears the explicit signed-out state', async () => {
    logoutNative();
    await establishSession();
    expect(isAzureExplicitlySignedOut()).toBe(false);
  });

  test('login status reflects native completion and explicit logout without CLI fallback', async () => {
    const { getLoginStatus } = await import('./az-auth');
    await establishSession();
    await expect(getLoginStatus()).resolves.toEqual(
      expect.objectContaining({ isLoggedIn: true, subscriptionId: 'subscription-id' })
    );
    logoutNative();
    await expect(getLoginStatus()).resolves.toEqual(expect.objectContaining({ isLoggedIn: false }));
  });

  test('terminal refresh failures block implicit CLI fallback until reauthentication', async () => {
    const { getLoginStatus } = await import('./az-auth');
    await establishSession();
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'invalid_grant' }, 400));
    await expect(nativeCredential.getToken('other-scope')).rejects.toThrow();
    expect(isAzureExplicitlySignedOut()).toBe(true);
    await expect(getLoginStatus()).resolves.toEqual(expect.objectContaining({ isLoggedIn: false }));
  });
});
