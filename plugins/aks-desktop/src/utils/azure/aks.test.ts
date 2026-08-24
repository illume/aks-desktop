// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { registerAKSCluster } from './aks';

const desktopRegisterAKSCluster = vi.fn();
const successResult = { success: true, message: 'registered' };

describe('registerAKSCluster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).desktopApi = {
      registerAKSCluster: desktopRegisterAKSCluster,
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as any).desktopApi;
    vi.restoreAllMocks();
  });

  test('passes the AKS cluster type to the desktop API', async () => {
    desktopRegisterAKSCluster.mockResolvedValue(successResult);

    await registerAKSCluster('sub-1', 'rg-1', 'cluster-1');

    expect(desktopRegisterAKSCluster).toHaveBeenCalledWith(
      'sub-1',
      'rg-1',
      'cluster-1',
      false,
      undefined,
      'aks'
    );
  });

  test('prevents concurrent registrations from losing a kubeconfig update', async () => {
    let registeredClusters: string[] = [];
    let markFirstStarted!: () => void;
    let releaseFirst!: () => void;
    const firstStarted = new Promise<void>(resolve => {
      markFirstStarted = resolve;
    });
    const firstMayFinish = new Promise<void>(resolve => {
      releaseFirst = resolve;
    });
    desktopRegisterAKSCluster.mockImplementation(
      async (_subscriptionId: string, _resourceGroup: string, clusterName: string) => {
        const existingClusters = [...registeredClusters];
        if (clusterName === 'cluster-1') {
          markFirstStarted();
          await firstMayFinish;
        }
        registeredClusters = [...existingClusters, clusterName];
        return successResult;
      }
    );

    const first = registerAKSCluster('sub-1', 'rg-1', 'cluster-1');
    await firstStarted;
    const second = registerAKSCluster('sub-2', 'rg-2', 'cluster-2');

    releaseFirst();

    await Promise.all([first, second]);
    expect(registeredClusters).toEqual(['cluster-1', 'cluster-2']);
  });

  test('continues the queue after a desktop registration rejects', async () => {
    desktopRegisterAKSCluster
      .mockRejectedValueOnce(new Error('registration failed'))
      .mockResolvedValueOnce(successResult);

    const first = registerAKSCluster('sub-1', 'rg-1', 'cluster-1');
    const second = registerAKSCluster('sub-2', 'rg-2', 'cluster-2');

    await expect(first).resolves.toEqual({
      success: false,
      message: 'registration failed',
    });
    await expect(second).resolves.toEqual(successResult);
    expect(desktopRegisterAKSCluster).toHaveBeenCalledTimes(2);
  });
});
