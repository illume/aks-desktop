// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  getAzureCloudEndpoints: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../azure/az-cloud', () => ({
  getAzureCloudEndpoints: mocks.getAzureCloudEndpoints,
}));
vi.mock('../azure/az-token', () => ({
  getSubscriptionCredential: () => ({ getToken: mocks.getToken }),
}));

import { queryPrometheus } from './queryPrometheus';

describe('queryPrometheus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAzureCloudEndpoints.mockResolvedValue({ name: 'AzureCloud' });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('propagates token acquisition failures without sending an unauthenticated request', async () => {
    mocks.getToken.mockRejectedValue(
      new Error('Azure login is required for the selected subscription')
    );

    await expect(
      queryPrometheus(
        'https://prometheus.example',
        'up',
        1,
        2,
        60,
        '00000000-0000-0000-0000-000000000001'
      )
    ).rejects.toThrow('Azure login is required for the selected subscription');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test('uses the shared subscription credential and Prometheus scope', async () => {
    mocks.getToken.mockResolvedValue({
      token: 'prometheus-token',
      expiresOnTimestamp: Date.now() + 60_000,
    });

    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: { result: [] } }))
    );

    await expect(
      queryPrometheus(
        'https://prometheus.example',
        'up',
        1,
        2,
        60,
        '00000000-0000-0000-0000-000000000001'
      )
    ).resolves.toEqual([]);
    expect(mocks.getToken).toHaveBeenCalledWith('https://prometheus.monitor.azure.com/.default');
    expect(new Headers(mocks.fetch.mock.calls[0][1].headers).get('Authorization')).toBe(
      ['Bearer', 'prometheus-token'].join(' ')
    );
  });

  test('uses the Azure China Prometheus scope for the active cloud', async () => {
    mocks.getAzureCloudEndpoints.mockResolvedValue({ name: 'AzureChinaCloud' });
    mocks.getToken.mockResolvedValue({
      token: 'prometheus-token',
      expiresOnTimestamp: Date.now() + 60_000,
    });
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ status: 'success', data: { result: [] } }))
    );

    await queryPrometheus(
      'https://prometheus.example.cn',
      'up',
      1,
      2,
      60,
      '00000000-0000-0000-0000-000000000001'
    );

    expect(mocks.getToken).toHaveBeenCalledWith('https://prometheus.monitor.azure.cn/.default');
  });
});
