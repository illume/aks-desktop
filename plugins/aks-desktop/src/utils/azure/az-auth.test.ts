// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runCommandAsync: vi.fn(),
}));

vi.mock('./az-cli-core', () => ({
  debugLog: vi.fn(),
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Unknown error'),
  isAzCliLoggedIn: vi.fn(),
  isAzError: (stderr: string) => stderr.includes('ERROR: '),
  isCliNotFoundError: (output: string) =>
    output.includes('command not found') || output.includes('Azure CLI (az) command not found'),
  needsRelogin: vi.fn(),
  runCommandAsync: mocks.runCommandAsync,
}));

vi.mock('./az-cli-path', () => ({
  getAzCommand: () => 'az',
  getInstallationInstructions: () => 'Install Azure CLI.',
}));

import { initiateLogin } from './az-auth';

describe('initiateLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('accepts successful login output with warnings', async () => {
    mocks.runCommandAsync.mockResolvedValue({
      stdout: '[{"isDefault":true}]',
      stderr: 'WARNING: The login output has changed.',
    });

    await expect(initiateLogin()).resolves.toEqual({
      success: true,
      message: 'Login process initiated. Please complete authentication in your browser.',
    });
  });

  test('accepts usable login output with a tenant-specific error', async () => {
    mocks.runCommandAsync.mockResolvedValue({
      stdout: '[{"isDefault":true}]',
      stderr: "ERROR: Failed to authenticate tenant 'unavailable-tenant'.",
    });

    await expect(initiateLogin()).resolves.toMatchObject({ success: true });
  });

  test.each([
    'ERROR: The user canceled the authentication',
    'Command exited with code 1',
    'Command execution error: bridge disconnected',
    'Failed to execute command: bridge not ready',
    'pluginRunCommand is not available.',
  ])('reports a command failure immediately: %s', async stderr => {
    mocks.runCommandAsync.mockResolvedValue({ stdout: '', stderr });

    await expect(initiateLogin()).resolves.toEqual({
      success: false,
      message: `Failed to initiate login: ${stderr}`,
    });
  });

  test('preserves Azure CLI installation guidance for ENOENT', async () => {
    mocks.runCommandAsync.mockResolvedValue({
      stdout: '',
      stderr: 'Command execution error: spawn az ENOENT',
    });

    const result = await initiateLogin();

    expect(result.success).toBe(false);
    expect(result.message).toContain('Azure CLI not found.');
    expect(result.message).toContain('Install Azure CLI.');
  });
});
