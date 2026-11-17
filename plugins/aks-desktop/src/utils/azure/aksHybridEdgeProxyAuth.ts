// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { getErrorMessage, isAzError, runCommandAsync } from './az-cli-core';

/** App identity and Azure scope that a connectedk8s proxy must use. */
export interface ProxyAuthTarget {
  subscriptionId: string;
  tenantId?: string;
  accountName?: string;
}

interface CliAccount {
  id: string;
  tenantId: string;
  user?: { name?: string };
}

export interface ProxyAuthResult {
  success: boolean;
  error?: string;
}

function normalize(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase('en-US') ?? '';
}

function parseAccount(stdout: string): CliAccount | undefined {
  try {
    const account = JSON.parse(stdout);
    if (
      account &&
      typeof account === 'object' &&
      !Array.isArray(account) &&
      typeof account.id === 'string' &&
      account.id &&
      typeof account.tenantId === 'string' &&
      account.tenantId
    ) {
      return account as CliAccount;
    }
  } catch {}
  return undefined;
}

function accountMatches(account: CliAccount | undefined, target: ProxyAuthTarget): boolean {
  return (
    !!account &&
    normalize(account.id) === normalize(target.subscriptionId) &&
    (!target.tenantId || normalize(account.tenantId) === normalize(target.tenantId)) &&
    (!target.accountName || normalize(account.user?.name) === normalize(target.accountName))
  );
}

async function readProxyAccount(target: ProxyAuthTarget): Promise<CliAccount | undefined> {
  const result = await runCommandAsync('az', [
    'account',
    'show',
    '--subscription',
    target.subscriptionId,
    '--output',
    'json',
  ]);
  if (result.stderr && isAzError(result.stderr)) {
    return undefined;
  }
  return parseAccount(result.stdout);
}

async function proxyAccountIsUsable(target: ProxyAuthTarget): Promise<boolean> {
  if (!accountMatches(await readProxyAccount(target), target)) {
    return false;
  }
  const args = [
    'account',
    'get-access-token',
    '--subscription',
    target.subscriptionId,
    '--query',
    'expires_on',
    '--output',
    'tsv',
  ];
  if (target.tenantId) {
    args.push('--tenant', target.tenantId);
  }
  const result = await runCommandAsync('az', args);
  const expiresOnSeconds = Number(result.stdout.trim());
  return (
    Number.isFinite(expiresOnSeconds) &&
    expiresOnSeconds * 1000 > Date.now() &&
    !(result.stderr && isAzError(result.stderr))
  );
}

/**
 * Ensures the app-owned Azure CLI profile has the same account, tenant, and
 * subscription as the app identity before `az connectedk8s proxy` starts.
 */
export async function ensureProxyAuthentication(target: ProxyAuthTarget): Promise<ProxyAuthResult> {
  try {
    if (!target.tenantId || !target.accountName) {
      return {
        success: false,
        error:
          'The Azure tenant or account for this AKS Hybrid & Edge cluster is unknown. Re-register it.',
      };
    }
    if (await proxyAccountIsUsable(target)) {
      return { success: true };
    }

    const login = await runCommandAsync('az', [
      'login',
      '--tenant',
      target.tenantId,
      '--allow-no-subscriptions',
    ]);
    if (
      (login.stderr && isAzError(login.stderr)) ||
      (!login.stdout.trim() && login.stderr.trim())
    ) {
      return {
        success: false,
        error: login.stderr.trim() || 'Azure CLI login was cancelled.',
      };
    }

    if (!(await proxyAccountIsUsable(target))) {
      return {
        success: false,
        error:
          'Azure CLI login did not select the same account, tenant, and subscription as AKS Desktop.',
      };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
}
