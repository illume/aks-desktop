// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerAKSCluster } from './aks';

vi.mock('./az-clusters', () => ({ getClusters: vi.fn() }));
vi.mock('./az-subscriptions', () => ({ getSubscriptions: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  delete (window as any).desktopApi;
});

describe('registerAKSCluster', () => {
  it('uses a named request with the declared cluster provider', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValue({ success: true, message: 'registered through provider' });
    vi.stubGlobal('clusterProviderInvoke', invoke);

    await expect(
      registerAKSCluster('subscription', 'group', 'cluster', 'managed', 'tenant')
    ).resolves.toEqual({ success: true, message: 'registered through provider' });
    expect(invoke).toHaveBeenCalledWith('aks-desktop.cluster', {
      subscriptionId: 'subscription',
      resourceGroup: 'group',
      clusterName: 'cluster',
      managedNamespace: 'managed',
      clusterType: 'aks',
    });
  });

  it('retains the current positional desktop bridge as a migration fallback', async () => {
    const register = vi.fn().mockResolvedValue({ success: true, message: 'legacy' });
    (window as any).desktopApi = { registerAKSCluster: register };

    await expect(
      registerAKSCluster('subscription', 'group', 'cluster', undefined, 'tenant')
    ).resolves.toEqual({ success: true, message: 'legacy' });
    expect(register).toHaveBeenCalledWith(
      'subscription',
      'group',
      'cluster',
      false,
      undefined,
      'tenant'
    );
  });
});
