// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockRunCommand = vi.hoisted(() => vi.fn());
const mockNamespaceApiList = vi.hoisted(() => vi.fn());

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  K8s: {
    ResourceClasses: {
      Namespace: {
        apiList: mockNamespaceApiList,
      },
    },
  },
  runCommand: mockRunCommand,
}));

vi.mock('../azure/az-clusters', () => ({
  getClusters: vi.fn(),
  getConnectedClusters: vi.fn(),
}));

vi.mock('../azure/az-subscriptions', () => ({
  getSubscriptions: vi.fn(),
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

async function loadAksModule() {
  vi.resetModules();
  (globalThis as any).pluginRunCommand = mockRunCommand;
  return import('../azure/aks');
}

function setupReachabilitySuccess() {
  mockNamespaceApiList.mockImplementation((success: () => void) => {
    success();
    return vi.fn();
  });
}

function setupReachabilityFailure(message = 'Unable to connect to the server') {
  mockNamespaceApiList.mockImplementation(
    (_success: () => void, failure: (error: Error) => void) => {
      failure(new Error(message));
      return vi.fn();
    }
  );
}

describe('Arc proxy lifecycle', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    mockNamespaceApiList.mockReset();
    vi.useRealTimers();
  });

  test('reconciles status to running when Headlamp namespace API succeeds after reload', async () => {
    setupReachabilitySuccess();

    const { getArcProxyStatus } = await loadAksModule();
    const result = await getArcProxyStatus('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'running' });
    expect(mockNamespaceApiList).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), {
      cluster: 'edge-arc-cluster',
    });
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  test('reconciles status to stopped with last error when Headlamp namespace API fails', async () => {
    setupReachabilityFailure();

    const { getArcProxyStatus } = await loadAksModule();
    const result = await getArcProxyStatus('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({
      success: true,
      status: 'stopped',
      lastError: 'Unable to connect to the server',
    });
  });

  test('starts connectedk8s proxy after reconciliation reports stopped', async () => {
    setupReachabilityFailure('connection refused');
    const proxyCommand = createCommandHandle();
    mockRunCommand.mockReturnValueOnce(proxyCommand);

    const { startArcProxy } = await loadAksModule();
    const result = await startArcProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'starting', pid: 1234 });
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
      ],
      {}
    );
  });

  test('does not start a duplicate proxy when reconciliation reports running', async () => {
    setupReachabilitySuccess();

    const { startArcProxy } = await loadAksModule();
    const result = await startArcProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(result).toEqual({ success: true, status: 'running' });
    expect(mockRunCommand).not.toHaveBeenCalled();
  });

  test('stop kills an active proxy command and marks it stopped', async () => {
    setupReachabilityFailure('connection refused');
    const proxyCommand = createCommandHandle();
    mockRunCommand.mockReturnValueOnce(proxyCommand);

    const { startArcProxy, stopArcProxy } = await loadAksModule();
    await startArcProxy('sub-1', 'rg-1', 'edge-arc-cluster');
    const result = await stopArcProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(proxyCommand.kill).toHaveBeenCalled();
    expect(result.status).toBe('stopped');
  });

  test('restart stops active proxy and starts a new one', async () => {
    const firstProxy = createCommandHandle();
    const secondProxy = createCommandHandle();
    setupReachabilityFailure('connection refused');
    mockRunCommand.mockReturnValueOnce(firstProxy).mockReturnValueOnce(secondProxy);

    const { startArcProxy, restartArcProxy } = await loadAksModule();
    await startArcProxy('sub-1', 'rg-1', 'edge-arc-cluster');
    const result = await restartArcProxy('sub-1', 'rg-1', 'edge-arc-cluster');

    expect(firstProxy.kill).toHaveBeenCalled();
    expect(result).toEqual({ success: true, status: 'starting', pid: 1234 });
    expect(mockRunCommand).toHaveBeenCalledTimes(2);
  });
});
