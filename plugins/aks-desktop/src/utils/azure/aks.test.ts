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

  test('serializes concurrent registrations', async () => {
    let resolveFirst!: (result: typeof successResult) => void;
    desktopRegisterAKSCluster
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirst = resolve;
          })
      )
      .mockResolvedValueOnce(successResult);

    const first = registerAKSCluster('sub-1', 'rg-1', 'cluster-1');
    const second = registerAKSCluster('sub-2', 'rg-2', 'cluster-2');

    await vi.waitFor(() => expect(desktopRegisterAKSCluster).toHaveBeenCalledTimes(1));
    resolveFirst(successResult);

    await expect(first).resolves.toEqual(successResult);
    await expect(second).resolves.toEqual(successResult);
    expect(desktopRegisterAKSCluster).toHaveBeenCalledTimes(2);
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
