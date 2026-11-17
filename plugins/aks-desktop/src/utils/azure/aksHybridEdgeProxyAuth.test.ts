// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockRunCommandAsync = vi.hoisted(() => vi.fn());

vi.mock('./az-cli-core', async importOriginal => ({
  ...(await importOriginal<typeof import('./az-cli-core')>()),
  runCommandAsync: mockRunCommandAsync,
}));

import { ensureProxyAuthentication } from './aksHybridEdgeProxyAuth';

const target = {
  subscriptionId: '00000000-0000-0000-0000-000000000001',
  tenantId: '00000000-0000-0000-0000-000000000002',
  accountName: 'guest@example.com',
};

function account(overrides: Record<string, unknown> = {}) {
  return {
    stdout: JSON.stringify({
      id: target.subscriptionId,
      tenantId: target.tenantId,
      user: { name: target.accountName },
      ...overrides,
    }),
    stderr: '',
  };
}

describe('ensureProxyAuthentication', () => {
  beforeEach(() => {
    mockRunCommandAsync.mockReset();
  });

  test('reuses matching app-owned CLI state without prompting', async () => {
    mockRunCommandAsync
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce({ stdout: '4102444800', stderr: '' });

    await expect(ensureProxyAuthentication(target)).resolves.toEqual({ success: true });
    expect(mockRunCommandAsync).toHaveBeenCalledTimes(2);
  });

  test('prompts for the cluster tenant when CLI state is absent or stale', async () => {
    mockRunCommandAsync
      .mockResolvedValueOnce({ stdout: '', stderr: 'ERROR: Please run az login' })
      .mockResolvedValueOnce({ stdout: '[]', stderr: '' })
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce({ stdout: '4102444800', stderr: '' });

    await expect(ensureProxyAuthentication(target)).resolves.toEqual({ success: true });
    expect(mockRunCommandAsync).toHaveBeenNthCalledWith(2, 'az', [
      'login',
      '--tenant',
      target.tenantId,
      '--allow-no-subscriptions',
    ]);
  });

  test.each([
    ['tenant', { tenantId: 'another-tenant' }],
    ['subscription', { id: 'another-subscription' }],
    ['identity', { user: { name: 'another@example.com' } }],
  ])('rejects a %s mismatch after login', async (_name, mismatch) => {
    mockRunCommandAsync
      .mockResolvedValueOnce(account(mismatch))
      .mockResolvedValueOnce({ stdout: '[]', stderr: '' })
      .mockResolvedValueOnce(account(mismatch));

    await expect(ensureProxyAuthentication(target)).resolves.toEqual({
      success: false,
      error:
        'Azure CLI login did not select the same account, tenant, and subscription as AKS Desktop.',
    });
  });

  test('reports MFA or cancellation errors without starting a proxy', async () => {
    mockRunCommandAsync
      .mockResolvedValueOnce({ stdout: '', stderr: 'ERROR: token expired' })
      .mockResolvedValueOnce({ stdout: '', stderr: 'ERROR: Authentication cancelled' });

    await expect(ensureProxyAuthentication(target)).resolves.toEqual({
      success: false,
      error: 'ERROR: Authentication cancelled',
    });
  });

  test('prompts again when cached account metadata has an expired or revoked token', async () => {
    mockRunCommandAsync
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce({ stdout: '', stderr: 'ERROR: token refresh failed' })
      .mockResolvedValueOnce({ stdout: '[]', stderr: '' })
      .mockResolvedValueOnce(account())
      .mockResolvedValueOnce({ stdout: '4102444800', stderr: '' });

    await expect(ensureProxyAuthentication(target)).resolves.toEqual({ success: true });
    expect(mockRunCommandAsync).toHaveBeenNthCalledWith(
      2,
      'az',
      expect.arrayContaining([
        'account',
        'get-access-token',
        '--subscription',
        target.subscriptionId,
      ])
    );
    expect(mockRunCommandAsync).toHaveBeenNthCalledWith(
      3,
      'az',
      expect.arrayContaining(['login', '--tenant', target.tenantId])
    );
  });

  test.each(['1', 'not-a-timestamp'])(
    'prompts again when Azure CLI reports unusable token expiry %s',
    async expiresOn => {
      mockRunCommandAsync
        .mockResolvedValueOnce(account())
        .mockResolvedValueOnce({ stdout: expiresOn, stderr: '' })
        .mockResolvedValueOnce({ stdout: '[]', stderr: '' })
        .mockResolvedValueOnce(account())
        .mockResolvedValueOnce({ stdout: '4102444800', stderr: '' });

      await expect(ensureProxyAuthentication(target)).resolves.toEqual({ success: true });
      expect(mockRunCommandAsync).toHaveBeenNthCalledWith(3, 'az', [
        'login',
        '--tenant',
        target.tenantId,
        '--allow-no-subscriptions',
      ]);
    }
  );

  test('requires tenant metadata before a replacement login', async () => {
    mockRunCommandAsync.mockResolvedValue({ stdout: '', stderr: 'ERROR: Please run az login' });

    await expect(
      ensureProxyAuthentication({ subscriptionId: target.subscriptionId })
    ).resolves.toEqual({
      success: false,
      error:
        'The Azure tenant or account for this AKS Hybrid & Edge cluster is unknown. Re-register it.',
    });
    expect(mockRunCommandAsync).not.toHaveBeenCalled();
  });
});
