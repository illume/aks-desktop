// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runCommandWithOutput: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('../kubernetes/cli-runner', () => ({
  runCommandWithOutput: mocks.runCommandWithOutput,
}));

import { queryPrometheus } from './queryPrometheus';

describe('queryPrometheus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('propagates token acquisition failures without sending an unauthenticated request', async () => {
    mocks.runCommandWithOutput.mockResolvedValue({
      stdout: '',
      stderr: 'Azure login is required for the selected subscription',
    });

    await expect(
      queryPrometheus('https://prometheus.example', 'up', 1, 2, 60, 'subscription-id')
    ).rejects.toThrow('Azure login is required for the selected subscription');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  test('rejects an empty token even when Azure CLI emits no error', async () => {
    mocks.runCommandWithOutput.mockResolvedValue({ stdout: ' \n', stderr: '' });

    await expect(
      queryPrometheus('https://prometheus.example', 'up', 1, 2, 60, 'subscription-id')
    ).rejects.toThrow('Azure CLI returned no Prometheus access token');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
