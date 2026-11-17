// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ openExternalUrl: vi.fn() }));

vi.mock('../shared/openExternalUrl', () => ({
  openExternalUrl: mocks.openExternalUrl,
}));

import {
  getNativeAccount,
  hasNativeSession,
  initiateNativeLogin,
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

describe('native Azure authentication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    logoutNative();
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
      )
      .mockResolvedValueOnce(
        jsonResponse({
          value: [
            {
              subscriptionId: '11111111-2222-3333-4444-555555555555',
              state: 'Enabled',
            },
          ],
        })
      );

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
      nativeCredential.getToken('https://management.azure.com/.default')
    ).resolves.toEqual(expect.objectContaining({ token: 'arm-token' }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
          value: [{ subscriptionId: 'subscription-id', state: 'Enabled' }],
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

    const [url, options] = fetchMock.mock.calls[3];
    expect(url).toBe('https://login.microsoftonline.com/guest-tenant/oauth2/v2.0/token');
    expect(String(options?.body)).toContain('grant_type=refresh_token');
    expect(String(options?.body)).toContain('refresh_token=refresh-token');

    logoutNative();
    expect(hasNativeSession()).toBe(false);
    await expect(nativeCredential.getToken('https://graph.microsoft.com/.default')).rejects.toThrow(
      'Azure login is required'
    );
  });
});
