// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetClusters = vi.fn();
const mockGetConnectedClusters = vi.fn();
const mockGetAzSubscriptions = vi.fn();

vi.mock('./az-clusters', () => ({
  getClusters: (...args: unknown[]) => mockGetClusters(...args),
  getConnectedClusters: (...args: unknown[]) => mockGetConnectedClusters(...args),
}));

vi.mock('./az-subscriptions', () => ({
  getSubscriptions: (...args: unknown[]) => mockGetAzSubscriptions(...args),
}));

vi.mock('../../components/BareMetal/proxy', () => ({
  getBareMetalProxyStatus: vi.fn(),
  startBareMetalProxy: vi.fn(),
  stopBareMetalProxy: vi.fn(),
  restartBareMetalProxy: vi.fn(),
}));

import { getAKSClusters, getSubscriptions, registerAKSCluster } from './aks';

describe('getSubscriptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return mapped subscriptions on success', async () => {
    mockGetAzSubscriptions.mockResolvedValue([
      { id: 'sub-1', name: 'My Sub', status: 'Enabled', tenant: 'tenant-1' },
    ]);

    const result = await getSubscriptions();

    expect(result.success).toBe(true);
    expect(result.subscriptions).toHaveLength(1);
    expect(result.subscriptions![0]).toEqual({
      id: 'sub-1',
      name: 'My Sub',
      state: 'Enabled',
      tenantId: 'tenant-1',
      isDefault: false,
    });
  });

  it('should return failure on error', async () => {
    mockGetAzSubscriptions.mockRejectedValue(new Error('auth required'));

    const result = await getSubscriptions();

    expect(result.success).toBe(false);
    expect(result.message).toBe('auth required');
  });

  it('should default state to Unknown when status is missing', async () => {
    mockGetAzSubscriptions.mockResolvedValue([
      { id: 'sub-2', name: 'Other Sub', tenant: 'tenant-2' },
    ]);

    const result = await getSubscriptions();

    expect(result.subscriptions![0].state).toBe('Unknown');
  });
});

describe('getAKSClusters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge AKS and BareMetal clusters', async () => {
    mockGetClusters.mockResolvedValue([
      {
        name: 'aks-cluster',
        resourceGroup: 'rg-aks',
        location: 'eastus',
        version: '1.28.0',
        status: 'Succeeded',
      },
    ]);
    mockGetConnectedClusters.mockResolvedValue([
      {
        name: 'arc-cluster',
        resourceGroup: 'rg-arc',
        location: 'westus',
        version: '1.27.0',
        status: 'Running',
        clusterType: 'aksarc',
      },
    ]);

    const result = await getAKSClusters('sub-1');

    expect(result.success).toBe(true);
    expect(result.clusters).toHaveLength(2);
    expect(result.clusters![0].clusterType).toBe('aks');
    expect(result.clusters![1].clusterType).toBe('aksarc');
  });

  it('should return empty clusters when both sources are empty', async () => {
    mockGetClusters.mockResolvedValue([]);
    mockGetConnectedClusters.mockResolvedValue([]);

    const result = await getAKSClusters('sub-1');

    expect(result.success).toBe(true);
    expect(result.clusters).toEqual([]);
  });

  it('should return failure on error', async () => {
    mockGetClusters.mockRejectedValue(new Error('network error'));

    const result = await getAKSClusters('sub-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('network error');
  });

  it('should default clusterType to aks when not set', async () => {
    mockGetClusters.mockResolvedValue([
      {
        name: 'cluster-no-type',
        resourceGroup: 'rg',
        location: 'eastus',
        version: '1.28.0',
        status: 'Succeeded',
      },
    ]);
    mockGetConnectedClusters.mockResolvedValue([]);

    const result = await getAKSClusters('sub-1');

    expect(result.clusters![0].clusterType).toBe('aks');
  });
});

describe('registerAKSCluster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return failure when desktopApi is not available', async () => {
    (window as any).desktopApi = undefined;

    const result = await registerAKSCluster('sub-1', 'rg-1', 'cluster-1');

    expect(result.success).toBe(false);
    expect(result.message).toContain('Desktop API not available');
  });

  it('should call desktopApi.registerAKSCluster and return result', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
    (window as any).desktopApi = { registerAKSCluster: mockRegister };

    const result = await registerAKSCluster(
      'sub-1',
      'rg-1',
      'cluster-1',
      undefined,
      undefined,
      'aksarc'
    );

    expect(result).toEqual({ success: true, message: 'ok' });
    expect(mockRegister).toHaveBeenCalledWith(
      'sub-1',
      'rg-1',
      'cluster-1',
      false,
      undefined,
      'aksarc'
    );
  });

  it('should default clusterType to aks', async () => {
    const mockRegister = vi.fn().mockResolvedValue({ success: true, message: 'ok' });
    (window as any).desktopApi = { registerAKSCluster: mockRegister };

    await registerAKSCluster('sub-1', 'rg-1', 'cluster-1');

    expect(mockRegister).toHaveBeenCalledWith(
      'sub-1',
      'rg-1',
      'cluster-1',
      false,
      undefined,
      'aks'
    );
  });

  it('should return failure when desktopApi call throws', async () => {
    const mockRegister = vi.fn().mockRejectedValue(new Error('IPC error'));
    (window as any).desktopApi = { registerAKSCluster: mockRegister };

    const result = await registerAKSCluster('sub-1', 'rg-1', 'cluster-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('IPC error');
  });
});
