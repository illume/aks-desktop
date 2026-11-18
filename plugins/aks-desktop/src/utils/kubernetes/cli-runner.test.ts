// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { expect, test, vi } from 'vitest';

const runCommandAsync = vi.hoisted(() => vi.fn());

vi.mock('../azure/az-cli-core', () => ({ runCommandAsync }));

import { runCommandWithOutput } from './cli-runner';

test('routes Azure CLI commands through the guarded executor', async () => {
  runCommandAsync.mockResolvedValue({ stdout: 'ok', stderr: '' });

  await expect(runCommandWithOutput('az', ['monitor', 'metrics', 'list'])).resolves.toEqual({
    stdout: 'ok',
    stderr: '',
  });
  expect(runCommandAsync).toHaveBeenCalledWith('az', ['monitor', 'metrics', 'list']);
});
