// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockRunCommand = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  runCommand: mockRunCommand,
}));

type Handler = (...args: any[]) => void;

function createCommandHandle(
  options: {
    stdout?: string;
    stderr?: string;
    exitCode?: number | null;
    autoExit?: boolean;
    hasKill?: boolean;
  } = {}
) {
  const handlers = new Map<string, Handler>();
  const handle = {
    pid: 1234,
    kill: options.hasKill === false ? undefined : vi.fn(),
    stdout: {
      on: vi.fn((event: string, callback: Handler) => {
        if (event === 'data' && options.stdout) {
          callback(options.stdout);
        }
      }),
    },
    stderr: {
      on: vi.fn((event: string, callback: Handler) => {
        if (event === 'data' && options.stderr) {
          callback(options.stderr);
        }
      }),
    },
    on: vi.fn((event: string, callback: Handler) => {
      handlers.set(event, callback);
      if (event === 'exit' && options.autoExit) {
        callback(options.exitCode ?? 0);
      }
    }),
    emit(event: string, ...args: any[]) {
      handlers.get(event)?.(...args);
    },
  };

  return handle;
}

async function loadBareMetalProxyModule() {
  vi.resetModules();
  (globalThis as any).pluginRunCommand = mockRunCommand;
  vi.stubGlobal('fetch', mockFetch);
  return import('./proxy');
}

describe('reconcileBareMetalProxyStatus', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    mockFetch.mockReset();
  });

  test('returns running when backend proxy probe succeeds', async () => {
    mockFetch.mockResolvedValue({ ok: true });

    const { reconcileBareMetalProxyStatus } = await loadBareMetalProxyModule();
    const result = await reconcileBareMetalProxyStatus('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'running', debugLog: [] });
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  test('returns stopped when backend proxy probe returns non-ok', async () => {
    mockFetch.mockResolvedValue({ ok: false });

    const { reconcileBareMetalProxyStatus } = await loadBareMetalProxyModule();
    const result = await reconcileBareMetalProxyStatus('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'stopped', debugLog: [] });
  });

  test('returns stopped when backend proxy probe throws', async () => {
    mockFetch.mockRejectedValue(new Error('connection refused'));

    const { reconcileBareMetalProxyStatus } = await loadBareMetalProxyModule();
    const result = await reconcileBareMetalProxyStatus('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'stopped', debugLog: [] });
  });
});

describe('BareMetal proxy lifecycle', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    mockFetch.mockReset();
    vi.useRealTimers();
  });

  test('starts connectedk8s proxy', async () => {
    const proxyCommand = createCommandHandle();
    // startBareMetalProxy calls pluginRunCommand twice: pkill then az
    mockRunCommand
      .mockReturnValueOnce(undefined) // pkill — result ignored
      .mockReturnValueOnce(proxyCommand); // az

    const { startBareMetalProxy } = await loadBareMetalProxyModule();
    const result = await startBareMetalProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'starting', pid: 1234, debugLog: [] });
    expect(mockRunCommand).toHaveBeenLastCalledWith(
      'az',
      [
        'connectedk8s',
        'proxy',
        '--subscription',
        'sub-1',
        '--resource-group',
        'rg-1',
        '--name',
        'edge-arc-cluster',
        '--port',
        '47011',
      ],
      { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
  });

  test('does not spawn a duplicate when a session is already active', async () => {
    const proxyCommand = createCommandHandle();
    mockRunCommand
      .mockReturnValueOnce(undefined) // pkill
      .mockReturnValueOnce(proxyCommand); // az

    const { startBareMetalProxy } = await loadBareMetalProxyModule();
    await startBareMetalProxy('sub-1', 'rg-1', 'edge-arc-cluster'); // session now 'starting'
    mockRunCommand.mockReset();

    const result = await startBareMetalProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'starting', pid: 1234 });
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  test('stop kills an active proxy command and marks it stopped', async () => {
    const proxyCommand = createCommandHandle();
    mockRunCommand
      .mockReturnValueOnce(undefined) // pkill
      .mockReturnValueOnce(proxyCommand); // az

    const { startBareMetalProxy, stopBareMetalProxy } = await loadBareMetalProxyModule();
    await startBareMetalProxy('sub-1', 'rg-1', 'edge-arc-cluster');
    const result = await stopBareMetalProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(proxyCommand.kill).toHaveBeenCalled();
    expect(result.status).toBe('stopped');
  });

  test('restart stops active proxy and starts a new one', async () => {
    const firstProxy = createCommandHandle();
    const secondProxy = createCommandHandle();
    // start #1: pkill + az; stop uses process.kill (no pluginRunCommand); start #2: pkill + az
    mockRunCommand
      .mockReturnValueOnce(undefined) // pkill for start #1
      .mockReturnValueOnce(firstProxy) // az for start #1
      .mockReturnValueOnce(undefined) // pkill for start #2
      .mockReturnValueOnce(secondProxy); // az for start #2

    const { startBareMetalProxy, restartBareMetalProxy } = await loadBareMetalProxyModule();
    await startBareMetalProxy('sub-1', 'rg-1', 'edge-arc-cluster');
    const result = await restartBareMetalProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(firstProxy.kill).toHaveBeenCalled();
    expect(result).toEqual({ success: true, status: 'starting', pid: 1234, debugLog: [] });
    expect(mockRunCommand).toHaveBeenCalledTimes(4);
  });
});

describe('bareMetalProxyKey', () => {
  test('builds composite key from subscription, resource group and cluster name', async () => {
    const { bareMetalProxyKey } = await loadBareMetalProxyModule();
    expect(bareMetalProxyKey('sub-1', 'rg-1', 'cluster-1')).toBe('sub-1/rg-1/cluster-1');
  });
});

describe('stopBareMetalProxy', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
  });

  test('returns stopped when no session exists', async () => {
    const { stopBareMetalProxy } = await loadBareMetalProxyModule();
    const result = await stopBareMetalProxy('sub-1', 'rg-1', 'no-session-cluster');
    expect(result).toEqual({ success: true, status: 'stopped' });
  });
});
