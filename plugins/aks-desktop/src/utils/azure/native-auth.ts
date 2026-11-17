// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/identity';
import { openExternalUrl } from '../shared/openExternalUrl';

const AZURE_CLI_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';
const AUTHORITY = 'https://login.microsoftonline.com';
const DEVICE_LOGIN_URL = 'https://microsoft.com/devicelogin';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const ARM_SCOPE = 'https://management.azure.com/.default';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

interface NativeAccount {
  username?: string;
  tenantId: string;
  subscriptionId: string;
  environmentName: 'AzureCloud';
}

export interface NativeLoginPrompt {
  userCode: string;
  verificationUri: string;
  message: string;
}

let account: NativeAccount | undefined;
let refreshToken: string | undefined;
let loginPending = false;
let loginGeneration = 0;
const tokens = new Map<string, Promise<AccessToken>>();

function tokenEndpoint(tenant = 'common') {
  return `${AUTHORITY}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

async function postForm<T>(url: string, values: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-ms-useragent': 'AZURECLI/2.0.0',
    },
    body: new URLSearchParams(values),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof body?.error_description === 'string'
        ? body.error_description
        : 'Azure authentication failed'
    );
  }
  return body;
}

function decodeClaims(token?: string): Record<string, unknown> {
  if (!token) return {};
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return {};
  }
}

function cacheToken(scope: string, response: TokenResponse): AccessToken {
  if (response.refresh_token) refreshToken = response.refresh_token;
  const token = {
    token: response.access_token,
    expiresOnTimestamp: Date.now() + response.expires_in * 1000,
  };
  tokens.set(scope, Promise.resolve(token));
  return token;
}

async function completeLogin(
  deviceCode: string,
  intervalSeconds: number,
  expiresInSeconds: number,
  generation: number
) {
  const deadline = Date.now() + expiresInSeconds * 1000;
  let interval = intervalSeconds;
  while (Date.now() < deadline && generation === loginGeneration) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));
    let response: Response;
    try {
      response = await fetch(tokenEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'x-ms-useragent': 'AZURECLI/2.0.0',
        },
        body: new URLSearchParams({
          client_id: AZURE_CLI_CLIENT_ID,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
        }),
      });
    } catch {
      continue;
    }
    const body = await response.json();
    if (!response.ok) {
      if (body?.error === 'authorization_pending') continue;
      if (body?.error === 'slow_down') {
        interval += 5;
        continue;
      }
      throw new Error(body?.error_description ?? 'Azure authentication failed');
    }

    const tokenResponse = body as TokenResponse;
    const token = cacheToken(ARM_SCOPE, tokenResponse);
    const claims = decodeClaims(tokenResponse.id_token ?? tokenResponse.access_token);
    const subscriptions = await fetch(
      'https://management.azure.com/subscriptions?api-version=2022-12-01',
      {
        headers: {
          Authorization: ['Bearer', token.token].join(' '),
          'x-ms-useragent': 'AZURECLI/2.0.0',
        },
      }
    );
    const subscriptionBody = await subscriptions.json();
    const subscription = subscriptionBody?.value?.find(
      (value: { state?: string }) => value.state === 'Enabled'
    );
    if (!subscriptions.ok || typeof subscription?.subscriptionId !== 'string') {
      throw new Error('No enabled Azure subscriptions were found for this account');
    }
    if (generation !== loginGeneration) return;
    account = {
      username:
        typeof claims.preferred_username === 'string'
          ? claims.preferred_username
          : typeof claims.name === 'string'
          ? claims.name
          : undefined,
      tenantId: typeof claims.tid === 'string' ? claims.tid : String(subscription.tenantId ?? ''),
      subscriptionId: subscription.subscriptionId,
      environmentName: 'AzureCloud',
    };
    loginPending = false;
    window.dispatchEvent(new CustomEvent('azure-account-change'));
    return;
  }
}

/** Starts public-client device authentication without requiring Azure CLI. */
export async function initiateNativeLogin(): Promise<NativeLoginPrompt> {
  logoutNative();
  const response = await postForm<{
    device_code: string;
    user_code: string;
    verification_uri: string;
    message?: string;
    expires_in: number;
    interval?: number;
  }>(`${AUTHORITY}/common/oauth2/v2.0/devicecode`, {
    client_id: AZURE_CLI_CLIENT_ID,
    scope: `${ARM_SCOPE} openid profile offline_access`,
  });
  const generation = loginGeneration;
  loginPending = true;
  void completeLogin(
    response.device_code,
    response.interval ?? 5,
    response.expires_in,
    generation
  ).catch(error => {
    loginPending = false;
    console.error('Azure authentication failed:', error);
  });
  openExternalUrl(response.verification_uri || DEVICE_LOGIN_URL);
  return {
    userCode: response.user_code,
    verificationUri: response.verification_uri || DEVICE_LOGIN_URL,
    message:
      response.message ??
      `Open ${response.verification_uri || DEVICE_LOGIN_URL} and enter code ${response.user_code}.`,
  };
}

/** Returns the in-memory account established by native authentication. */
export function getNativeAccount(): NativeAccount | undefined {
  return account;
}

/** Returns whether native login has established or is establishing a session. */
export function hasNativeSession(): boolean {
  return loginPending || account !== undefined || refreshToken !== undefined;
}

/** Clears native tokens and cancels an outstanding device login. */
export function logoutNative(): void {
  loginGeneration++;
  account = undefined;
  refreshToken = undefined;
  loginPending = false;
  tokens.clear();
}

async function requestToken(scope: string, tenantId?: string): Promise<AccessToken> {
  if (!refreshToken) throw new Error('Azure login is required');
  const response = await postForm<TokenResponse>(tokenEndpoint(tenantId ?? account?.tenantId), {
    client_id: AZURE_CLI_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope,
  });
  return cacheToken(`${tenantId ?? ''}|${scope}`, response);
}

/** In-memory credential backed by the native public-client session. */
export const nativeCredential: TokenCredential = {
  async getToken(scopes: string | string[], options?: GetTokenOptions) {
    const scope = Array.isArray(scopes) ? scopes[0] : scopes;
    if (!scope || (Array.isArray(scopes) && scopes.length !== 1)) {
      throw new Error('Exactly one token scope is required');
    }
    const key = `${options?.tenantId ?? ''}|${scope}`;
    const cached =
      tokens.get(key) ??
      (!options?.tenantId && scope === ARM_SCOPE ? tokens.get(ARM_SCOPE) : undefined);
    if (cached) {
      const token = await cached;
      if (token.expiresOnTimestamp - TOKEN_REFRESH_MARGIN_MS > Date.now()) return token;
    }
    const pending = requestToken(scope, options?.tenantId);
    tokens.set(key, pending);
    pending.catch(() => {
      if (tokens.get(key) === pending) tokens.delete(key);
    });
    return pending;
  },
};
