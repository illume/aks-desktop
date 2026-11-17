// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/identity';
import { openExternalUrl } from '../shared/openExternalUrl';
import {
  allowImplicitAzureCli,
  blockImplicitAzureCli,
  isImplicitAzureCliBlocked,
} from './azure-auth-policy';
import { getNativeCloudConfiguration, NativeCloudConfiguration } from './azure-cloud-config';

const AZURE_CLI_CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';
const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;
const TOKEN_REQUEST_TIMEOUT_MS = 30_000;

class AuthenticationError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

function authenticationError(body: unknown): AuthenticationError {
  const details =
    body && typeof body === 'object'
      ? (body as { error?: unknown; error_description?: unknown })
      : undefined;
  return new AuthenticationError(
    typeof details?.error_description === 'string'
      ? details.error_description
      : 'Azure authentication failed',
    typeof details?.error === 'string' ? details.error : undefined
  );
}

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
  environmentName: NativeCloudConfiguration['name'];
}

export interface NativeLoginPrompt {
  userCode: string;
  verificationUri: string;
  message: string;
}

let account: NativeAccount | undefined;
let refreshToken: string | undefined;
let loginPending = false;
let loginError: string | undefined;
let loginGeneration = 0;
let explicitlySignedOut = false;
let nativeCloud: NativeCloudConfiguration | undefined;
let homeTenantId: string | undefined;
const tokens = new Map<string, Promise<AccessToken>>();

function tokenEndpoint(cloud: NativeCloudConfiguration, tenant = 'common') {
  return `${cloud.authority}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

async function postForm<T>(
  url: string,
  values: Record<string, string>,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-ms-useragent': 'AZURECLI/2.0.0',
    },
    body: new URLSearchParams(values),
    signal,
  });
  const body = await response.json().catch(() => undefined);
  if (!response.ok) {
    throw authenticationError(body);
  }
  if (!body) throw new Error('Invalid Azure authentication response');
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

function cacheToken(scope: string, response: TokenResponse, credential?: string): AccessToken {
  if (
    typeof response?.access_token !== 'string' ||
    !response.access_token ||
    typeof response.expires_in !== 'number' ||
    !Number.isFinite(response.expires_in) ||
    response.expires_in <= 0
  ) {
    throw new Error('Invalid Azure authentication response');
  }
  if (
    (credential === undefined || credential === refreshToken) &&
    typeof response.refresh_token === 'string' &&
    response.refresh_token
  ) {
    refreshToken = response.refresh_token;
  }
  const token = {
    token: response.access_token,
    expiresOnTimestamp: Date.now() + response.expires_in * 1000,
  };
  tokens.set(scope, Promise.resolve(token));
  return token;
}

async function beforeDeviceDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new AuthenticationError('Azure device login expired', 'device_code_expired')),
          Math.max(0, deadline - Date.now())
        );
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

async function completeLogin(
  deviceCode: string,
  intervalSeconds: number,
  expiresInSeconds: number,
  generation: number,
  cloud: NativeCloudConfiguration
) {
  const deadline = Date.now() + expiresInSeconds * 1000;
  let interval = intervalSeconds;
  while (generation === loginGeneration) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('Azure device login expired');
    await new Promise(resolve => setTimeout(resolve, Math.min(interval * 1000, remaining)));
    if (generation !== loginGeneration) return;
    if (Date.now() >= deadline) throw new Error('Azure device login expired');
    let response: Response;
    try {
      response = await beforeDeviceDeadline(
        fetch(tokenEndpoint(cloud), {
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
        }),
        deadline
      );
    } catch (error) {
      if (generation !== loginGeneration) return;
      if (error instanceof AuthenticationError && error.code === 'device_code_expired') throw error;
      continue;
    }
    if (generation !== loginGeneration) return;
    if (Date.now() >= deadline) throw new Error('Azure device login expired');
    const body = await beforeDeviceDeadline(
      response.json().catch(() => undefined),
      deadline
    );
    if (generation !== loginGeneration) return;
    if (Date.now() >= deadline) throw new Error('Azure device login expired');
    if (!response.ok) {
      if (body?.error === 'authorization_pending') continue;
      if (body?.error === 'slow_down') {
        interval += 5;
        continue;
      }
      if (response.status === 429 || response.status >= 500) continue;
      throw authenticationError(body);
    }

    const tokenResponse = body as TokenResponse;
    if (generation !== loginGeneration) return;
    cacheToken(cloud.arm.scope, tokenResponse);
    const claims = decodeClaims(tokenResponse.id_token ?? tokenResponse.access_token);
    homeTenantId = typeof claims.tid === 'string' ? claims.tid : undefined;
    const { getSubscriptions } = await import('./az-subscriptions');
    if (generation !== loginGeneration) return;
    const subscriptions = await getSubscriptions(false, { strict: true });
    if (generation !== loginGeneration) return;
    const subscription = subscriptions.find(
      value => value.status === 'Enabled' && typeof value.id === 'string' && value.id
    );
    if (!subscription) {
      throw new Error('No enabled Azure subscriptions were found for this account');
    }
    account = {
      username:
        typeof claims.preferred_username === 'string'
          ? claims.preferred_username
          : typeof claims.name === 'string'
          ? claims.name
          : undefined,
      tenantId: typeof subscription.tenant === 'string' ? subscription.tenant : '',
      subscriptionId: subscription.id,
      environmentName: cloud.name,
    };
    explicitlySignedOut = false;
    loginPending = false;
    window.dispatchEvent(
      new CustomEvent('azure-account-change', {
        detail: {
          nativeSubscriptions: subscriptions.map(({ id, tenant }) => ({ id, tenant })),
        },
      })
    );
    return;
  }
}

/** Starts public-client device authentication without requiring Azure CLI. */
export async function initiateNativeLogin(
  signal?: AbortSignal,
  cloudName = 'AzureCloud'
): Promise<NativeLoginPrompt> {
  if (signal?.aborted) throw new Error('Azure login was cancelled');
  const cloud = getNativeCloudConfiguration(cloudName);
  if (!blockImplicitAzureCli()) {
    throw new Error(
      'Azure sign-in policy could not be saved; enable application storage and retry.'
    );
  }
  resetNativeSession();
  nativeCloud = cloud;
  const generation = loginGeneration;
  loginPending = true;
  let rejectDeviceRequest: ((error: Error) => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    rejectDeviceRequest = reject;
  });
  const onAbort = () => {
    if (generation !== loginGeneration || !loginPending) return;
    resetNativeSession();
    rejectDeviceRequest?.(new Error('Azure login was cancelled'));
    signal?.removeEventListener('abort', onAbort);
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  let response: {
    device_code: string;
    user_code: string;
    verification_uri: string;
    message?: string;
    expires_in: number;
    interval?: number;
  };
  try {
    response = await Promise.race([
      postForm<typeof response>(`${cloud.authority}/common/oauth2/v2.0/devicecode`, {
        client_id: AZURE_CLI_CLIENT_ID,
        scope: `${cloud.arm.scope} openid profile offline_access`,
      }),
      cancelled,
    ]);
    rejectDeviceRequest = undefined;
    if (generation !== loginGeneration) throw new Error('Azure login was cancelled');
    if (
      typeof response.device_code !== 'string' ||
      !response.device_code ||
      typeof response.user_code !== 'string' ||
      !response.user_code ||
      typeof response.expires_in !== 'number' ||
      !Number.isFinite(response.expires_in) ||
      response.expires_in <= 0 ||
      (response.interval !== undefined &&
        (typeof response.interval !== 'number' ||
          !Number.isFinite(response.interval) ||
          response.interval <= 0))
    ) {
      throw new Error('Invalid Azure authentication response');
    }
  } catch (error) {
    rejectDeviceRequest = undefined;
    signal?.removeEventListener('abort', onAbort);
    if (generation !== loginGeneration) throw new Error('Azure login was cancelled');
    resetNativeSession();
    throw error;
  }
  void completeLogin(
    response.device_code,
    response.interval ?? 5,
    response.expires_in,
    generation,
    cloud
  )
    .catch(error => {
      if (generation !== loginGeneration) return;
      resetNativeSession();
      loginError = error instanceof Error ? error.message : 'Azure authentication failed';
      console.error('Azure authentication failed:', error);
    })
    .finally(() => signal?.removeEventListener('abort', onAbort));
  openExternalUrl(response.verification_uri || cloud.deviceLoginUrl);
  return {
    userCode: response.user_code,
    verificationUri: response.verification_uri || cloud.deviceLoginUrl,
    message:
      response.message ??
      `Open ${response.verification_uri || cloud.deviceLoginUrl} and enter code ${
        response.user_code
      }.`,
  };
}

/** Returns the in-memory account established by native authentication. */
export function getNativeAccount(): NativeAccount | undefined {
  return account;
}

/** Returns the latest terminal native-login error, if any. */
export function getNativeLoginError(): string | undefined {
  return loginError;
}

/** Returns whether native login has established or is establishing a session. */
export function hasNativeSession(): boolean {
  return loginPending || account !== undefined || refreshToken !== undefined;
}

/** Returns the active native cloud, including during subscription discovery. */
export function getNativeCloudName(): NativeCloudConfiguration['name'] | undefined {
  return hasNativeSession() ? nativeCloud?.name : undefined;
}

/** Identifies the current native login attempt or session. */
export function getNativeAuthGeneration(): number {
  return loginGeneration;
}

function resetNativeSession(): void {
  loginGeneration++;
  account = undefined;
  refreshToken = undefined;
  loginPending = false;
  loginError = undefined;
  nativeCloud = undefined;
  homeTenantId = undefined;
  tokens.clear();
}

/** Returns whether sign-out or a terminal credential failure blocks implicit CLI access. */
export function isAzureExplicitlySignedOut(): boolean {
  return explicitlySignedOut || (!hasNativeSession() && isImplicitAzureCliBlocked());
}

/** Allows CLI account discovery following an explicit choice to sign in with the CLI. */
export function allowAzureCliFallback(): void {
  allowImplicitAzureCli();
  explicitlySignedOut = false;
}

/** Signs out and prevents automatic reuse of an Azure CLI account. */
export function logoutNative(): boolean {
  const persisted = blockImplicitAzureCli();
  resetNativeSession();
  explicitlySignedOut = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('azure-account-change'));
  }
  return persisted;
}

async function requestToken(scope: string, tenantId?: string): Promise<AccessToken> {
  if (!refreshToken || !nativeCloud) throw new Error('Azure login is required');
  const generation = loginGeneration;
  const credential = refreshToken;
  const controller = new AbortController();
  const deadline = Date.now() + TOKEN_REQUEST_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout>;
  const timeoutError = () => new Error('Azure token refresh timed out');
  let response: TokenResponse;
  try {
    response = await Promise.race([
      postForm<TokenResponse>(
        tokenEndpoint(nativeCloud, tenantId ?? account?.tenantId),
        {
          client_id: AZURE_CLI_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: credential,
          scope,
        },
        controller.signal
      ),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(timeoutError());
          controller.abort();
        }, TOKEN_REQUEST_TIMEOUT_MS);
      }),
    ]);
    if (Date.now() >= deadline) {
      controller.abort();
      throw timeoutError();
    }
  } catch (error) {
    if (generation !== loginGeneration) throw new Error('Azure login was cancelled');
    if (Date.now() >= deadline) {
      controller.abort();
      throw timeoutError();
    }
    const requestedTenant = tenantId ?? account?.tenantId;
    const isHomeTenant =
      !!homeTenantId &&
      !!requestedTenant &&
      requestedTenant.toLowerCase() === homeTenantId.toLowerCase();
    if (
      credential === refreshToken &&
      error instanceof AuthenticationError &&
      ['invalid_grant', 'invalid_client', 'interaction_required', 'login_required'].includes(
        error.code ?? ''
      ) &&
      isHomeTenant
    ) {
      const wasLoggingIn = loginPending;
      resetNativeSession();
      if (wasLoggingIn) loginError = error.message;
      explicitlySignedOut = true;
      window.dispatchEvent(new CustomEvent('azure-account-change'));
    }
    throw error;
  } finally {
    clearTimeout(timer!);
  }
  if (generation !== loginGeneration) throw new Error('Azure login was cancelled');
  return cacheToken(`${tenantId ?? ''}|${scope}`, response, credential);
}

/** In-memory credential backed by the native public-client session. */
export const nativeCredential: TokenCredential = {
  async getToken(scopes: string | string[], options?: GetTokenOptions) {
    const scope = Array.isArray(scopes) ? scopes[0] : scopes;
    if (!scope || (Array.isArray(scopes) && scopes.length !== 1)) {
      throw new Error('Exactly one token scope is required');
    }
    const signal = options?.abortSignal;
    const abortError = () =>
      (signal as { reason?: unknown } | undefined)?.reason ??
      new DOMException('Token request was aborted', 'AbortError');
    if (signal?.aborted) throw abortError();
    const load = async () => {
      const key = `${options?.tenantId ?? ''}|${scope}`;
      const generation = loginGeneration;
      while (true) {
        const cached =
          tokens.get(key) ??
          (!options?.tenantId && scope === nativeCloud?.arm.scope ? tokens.get(scope) : undefined);
        if (cached) {
          const token = await cached;
          if (generation !== loginGeneration) throw new Error('Azure login was cancelled');
          if (signal?.aborted) throw abortError();
          if (token.expiresOnTimestamp - TOKEN_REFRESH_MARGIN_MS > Date.now()) return token;
          if (tokens.has(key) && tokens.get(key) !== cached) continue;
        }
        const pending = requestToken(scope, options?.tenantId);
        tokens.set(key, pending);
        pending.catch(() => {
          if (tokens.get(key) === pending) tokens.delete(key);
        });
        return pending;
      }
    };
    if (!signal) return load();
    // A caller can stop waiting without cancelling the shared refresh for other callers.
    let onAbort: () => void;
    return new Promise<AccessToken>((resolve, reject) => {
      onAbort = () => reject(abortError());
      signal.addEventListener('abort', onAbort, { once: true });
      load().then(resolve, reject);
    }).finally(() => signal.removeEventListener('abort', onAbort!));
  },
};
