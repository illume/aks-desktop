// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { K8s } from '@kinvolk/headlamp-plugin/lib';

declare const pluginRunCommand: (
  command: string,
  args: string[],
  options: Record<string, unknown>
) => ReturnType<typeof import('@kinvolk/headlamp-plugin/lib').runCommand>;

/** Status snapshot returned by Arc proxy lifecycle functions. */
export interface ArcProxyStatus {
  /** Whether the operation itself succeeded. */
  success: boolean;
  /** Current proxy state. */
  status: 'stopped' | 'starting' | 'running' | 'error';
  /** Most recent error message, if any. */
  lastError?: string;
  /** OS process ID of the running proxy, when available. */
  pid?: number;
}

/** Internal bookkeeping for a running `az connectedk8s proxy` process. */
interface ArcProxySession {
  /** The child-process handle; `undefined` after the process exits. */
  cmd?: ReturnType<typeof import('@kinvolk/headlamp-plugin/lib').runCommand>;
  /** Mirrors {@link ArcProxyStatus.status}. */
  status: ArcProxyStatus['status'];
  /** Most recent error message, if any. */
  lastError?: string;
  /** OS process ID, when available. */
  pid?: number;
}

/** In-memory map of active Arc proxy sessions, keyed by `subscription/resourceGroup/cluster`. */
const arcProxySessions = new Map<string, ArcProxySession>();

/**
 * Probes whether a cluster is reachable by listing its Kubernetes namespaces.
 *
 * @param clusterName - The cluster name to probe.
 * @returns A result indicating reachability plus any error detail.
 */
export function checkClusterReachable(
  clusterName: string
): Promise<{ success: boolean; error?: string }> {
  return new Promise(resolve => {
    let settled = false;
    let cancel: (() => void) | undefined;

    const finish = (result: { success: boolean; error?: string }) => {
      if (!settled) {
        settled = true;
        if (cancel) {
          cancel();
        }
        resolve(result);
      }
    };

    const timeout = setTimeout(() => {
      finish({ success: false, error: 'Timed out checking cluster reachability' });
    }, 5000);

    try {
      cancel = K8s.ResourceClasses.Namespace.apiList(
        () => {
          clearTimeout(timeout);
          finish({ success: true });
        },
        (error: unknown) => {
          clearTimeout(timeout);
          finish({ success: false, error: error instanceof Error ? error.message : String(error) });
        },
        { cluster: clusterName }
      );
    } catch (error) {
      clearTimeout(timeout);
      finish({ success: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
}

/**
 * Reconciles the in-memory proxy session with actual cluster reachability.
 *
 * After a page reload the process handle is lost, so this function probes
 * the cluster and updates the session map accordingly.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the Arc cluster.
 * @returns The reconciled proxy status.
 */
async function reconcileArcProxyStatus(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<ArcProxyStatus> {
  const key = arcProxyKey(subscriptionId, resourceGroup, clusterName);

  const probe = await checkClusterReachable(clusterName);

  if (probe.success) {
    const reconciled: ArcProxySession = {
      status: 'running',
      lastError: undefined,
      pid: undefined,
    };
    arcProxySessions.set(key, reconciled);
    return {
      success: true,
      status: 'running',
    };
  }

  const previous = arcProxySessions.get(key);
  const stopped: ArcProxySession = {
    status: 'stopped',
    lastError: probe.error || previous?.lastError,
    pid: undefined,
  };
  arcProxySessions.set(key, stopped);
  return {
    success: true,
    status: 'stopped',
    lastError: stopped.lastError,
  };
}

/** Builds the composite map key for an Arc proxy session. */
export function arcProxyKey(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): string {
  return `${subscriptionId}/${resourceGroup}/${clusterName}`;
}

/**
 * Returns the current status of an Arc proxy session.
 *
 * If no in-memory session exists (e.g. after a page reload), the cluster is
 * probed for reachability and the status is reconciled automatically.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the Arc cluster.
 */
export async function getArcProxyStatus(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<ArcProxyStatus> {
  const key = arcProxyKey(subscriptionId, resourceGroup, clusterName);
  const session = arcProxySessions.get(key);

  // Reconcile after reload/restart where in-memory process handle may be gone.
  if (!session || !session.cmd) {
    return reconcileArcProxyStatus(subscriptionId, resourceGroup, clusterName);
  }

  return {
    success: true,
    status: session.status,
    lastError: session.lastError,
    pid: session.pid,
  };
}

/**
 * Starts an `az connectedk8s proxy` process for the given Arc cluster.
 *
 * If a proxy is already running (or the cluster is already reachable after a
 * page reload), the existing status is returned without spawning a duplicate.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the Arc cluster.
 */
export async function startArcProxy(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<ArcProxyStatus> {
  if (typeof pluginRunCommand === 'undefined') {
    return {
      success: false,
      status: 'error',
      lastError: 'pluginRunCommand is not available.',
    };
  }

  const key = arcProxyKey(subscriptionId, resourceGroup, clusterName);
  const existing = arcProxySessions.get(key);

  // If process handle is gone (after reload), reconcile first so we don't start duplicates.
  if (!existing || !existing.cmd) {
    const reconciled = await reconcileArcProxyStatus(subscriptionId, resourceGroup, clusterName);
    if (reconciled.status === 'running') {
      return reconciled;
    }
  }

  if (existing && (existing.status === 'running' || existing.status === 'starting')) {
    return {
      success: true,
      status: existing.status,
      lastError: existing.lastError,
      pid: existing.pid,
    };
  }

  try {
    const cmd = pluginRunCommand(
      'az',
      [
        'connectedk8s',
        'proxy',
        '--subscription',
        subscriptionId,
        '--resource-group',
        resourceGroup,
        '--name',
        clusterName,
      ],
      {}
    );

    const session: ArcProxySession = {
      cmd,
      status: 'starting',
      pid: (cmd as any).pid,
    };
    arcProxySessions.set(key, session);

    cmd.stdout.on('data', () => {
      const latest = arcProxySessions.get(key);
      if (latest) {
        latest.status = 'running';
        latest.lastError = undefined;
        arcProxySessions.set(key, latest);
      }
    });

    cmd.stderr.on('data', (data: string) => {
      const latest = arcProxySessions.get(key);
      if (latest) {
        latest.lastError = data.toString().trim();
        if (latest.status !== 'running') {
          latest.status = 'error';
        }
        arcProxySessions.set(key, latest);
      }
    });

    cmd.on('exit', (code: number | null) => {
      const latest = arcProxySessions.get(key);
      if (!latest) {
        return;
      }
      latest.status = code === 0 ? 'stopped' : 'error';
      if (code !== 0 && !latest.lastError) {
        latest.lastError = `Proxy exited with code ${code}`;
      }
      latest.cmd = undefined;
      arcProxySessions.set(key, latest);
    });

    cmd.on('error', (errOrCode: unknown) => {
      const latest = arcProxySessions.get(key);
      if (!latest) {
        return;
      }
      latest.status = 'error';
      latest.cmd = undefined;
      latest.lastError =
        errOrCode instanceof Error ? errOrCode.message : `Proxy failed: ${String(errOrCode)}`;
      arcProxySessions.set(key, latest);
    });

    return {
      success: true,
      status: 'starting',
      pid: session.pid,
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stops a running `az connectedk8s proxy` process for the given Arc cluster.
 *
 * If no proxy session exists the call is a no-op and returns `'stopped'`.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the Arc cluster.
 */
export async function stopArcProxy(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<ArcProxyStatus> {
  const key = arcProxyKey(subscriptionId, resourceGroup, clusterName);
  const session = arcProxySessions.get(key);

  if (!session || !session.cmd) {
    return {
      success: true,
      status: 'stopped',
    };
  }

  try {
    if (typeof (session.cmd as any).kill === 'function') {
      (session.cmd as any).kill();
    }
    session.status = 'stopped';
    session.cmd = undefined;
    arcProxySessions.set(key, session);
    return {
      success: true,
      status: 'stopped',
      lastError: session.lastError,
      pid: session.pid,
    };
  } catch (error) {
    session.status = 'error';
    session.lastError = error instanceof Error ? error.message : 'Unknown error';
    arcProxySessions.set(key, session);
    return {
      success: false,
      status: 'error',
      lastError: session.lastError,
      pid: session.pid,
    };
  }
}

/**
 * Restarts the Arc proxy by stopping and then starting it again.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the Arc cluster.
 */
export async function restartArcProxy(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<ArcProxyStatus> {
  await stopArcProxy(subscriptionId, resourceGroup, clusterName);
  return startArcProxy(subscriptionId, resourceGroup, clusterName);
}
