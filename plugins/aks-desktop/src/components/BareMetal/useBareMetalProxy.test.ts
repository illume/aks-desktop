// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { didBareMetalProxyDrop, useBareMetalProxy } from './useBareMetalProxy';

const mockReconcile = vi.hoisted(() => vi.fn());

vi.mock('./proxy', () => ({
  getBareMetalProxyStatus: vi.fn(),
  reconcileBareMetalProxyStatus: mockReconcile,
  startBareMetalProxy: vi.fn(),
  stopBareMetalProxy: vi.fn(),
  restartBareMetalProxy: vi.fn(),
}));

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('didBareMetalProxyDrop', () => {
  test('returns true when a running proxy transitions to stopped', () => {
    expect(didBareMetalProxyDrop('running', 'stopped')).toBe(true);
  });

  test('returns true when a running proxy transitions to error', () => {
    expect(didBareMetalProxyDrop('running', 'error')).toBe(true);
  });

  test('returns false for non-running previous states', () => {
    expect(didBareMetalProxyDrop(null, 'stopped')).toBe(false);
    expect(didBareMetalProxyDrop('starting', 'error')).toBe(false);
  });
});

describe('useBareMetalProxy – refreshProxyStatus', () => {
  const target = { subscriptionId: 'sub-1', resourceGroup: 'rg-1', clusterName: 'cluster-1' };

  beforeEach(() => {
    mockReconcile.mockReset();
  });

  test('refreshProxyStatus calls reconcileBareMetalProxyStatus, not getBareMetalProxyStatus', async () => {
    mockReconcile.mockResolvedValue({ success: true, status: 'running' });

    const { result } = renderHook(() => useBareMetalProxy(true, target, 999999));

    await act(async () => {
      await result.current.refreshProxyStatus();
    });

    expect(mockReconcile).toHaveBeenCalledWith('sub-1', 'rg-1', 'cluster-1');
    expect(result.current.proxyStatus?.status).toBe('running');
  });

  test('refreshProxyStatus updates proxyStatus with reconciled stopped state', async () => {
    mockReconcile.mockResolvedValue({ success: true, status: 'stopped' });

    const { result } = renderHook(() => useBareMetalProxy(true, target, 999999));

    await act(async () => {
      await result.current.refreshProxyStatus();
    });

    expect(result.current.proxyStatus?.status).toBe('stopped');
  });

  test('refreshProxyStatus sets proxyUiError when reconcileBareMetalProxyStatus throws', async () => {
    mockReconcile.mockRejectedValue(new Error('network failure'));

    const { result } = renderHook(() => useBareMetalProxy(true, target, 999999));

    await act(async () => {
      await result.current.refreshProxyStatus();
    });

    expect(result.current.proxyUiError).toContain('Failed to fetch proxy status');
  });
});
