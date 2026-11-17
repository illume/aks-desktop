// @vitest-environment node
// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * Read-only live coverage for the Azure CLI authentication used by connectedk8s proxy.
 * Requires a logged-in `az` and AZ_LIVE_TESTS=1; AZ_LIVE_SUBSCRIPTION is optional.
 */

import { spawn } from 'node:child_process';
import { beforeAll, describe, expect, test } from 'vitest';
import { azureLiveEnabled, DEFAULT_LIVE_SUBSCRIPTION } from '../test/azureLiveTestUtils';
import { ensureProxyAuthentication } from './aksHybridEdgeProxyAuth';

const invocations: string[][] = [];

function az(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('az', args, { shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => (stdout += data));
    child.stderr.on('data', (data: Buffer) => (stderr += data));
    child.on('error', reject);
    child.on('close', (code: number | null) =>
      code === 0 ? resolve(stdout) : reject(new Error(stderr))
    );
  });
}

describe.runIf(azureLiveEnabled)(
  'connectedk8s proxy authentication (live)',
  { timeout: 120_000 },
  () => {
    let account: { id: string; tenantId: string; user: { name: string } };

    beforeAll(async () => {
      const selectedSubscription = process.env.AZ_LIVE_SUBSCRIPTION || DEFAULT_LIVE_SUBSCRIPTION;
      const args = ['account', 'show', '--subscription', selectedSubscription, '--output', 'json'];
      account = JSON.parse(await az(args));

      (globalThis as any).pluginRunCommand = (command: string, commandArgs: string[]) => {
        invocations.push(commandArgs);
        if (commandArgs[0] === 'login') {
          throw new Error('Live proxy authentication unexpectedly requested an interactive login');
        }
        return spawn(command, commandArgs, { shell: process.platform === 'win32' });
      };
    });

    test('reuses the selected live account only after validating its tenant-scoped token', async () => {
      await expect(
        ensureProxyAuthentication({
          subscriptionId: account.id,
          tenantId: account.tenantId,
          accountName: account.user.name,
        })
      ).resolves.toEqual({ success: true });

      expect(invocations.some(args => args[0] === 'login')).toBe(false);
      expect(invocations).toContainEqual([
        'account',
        'get-access-token',
        '--subscription',
        account.id,
        '--query',
        'expires_on',
        '--output',
        'tsv',
        '--tenant',
        account.tenantId,
      ]);
    });
  }
);
