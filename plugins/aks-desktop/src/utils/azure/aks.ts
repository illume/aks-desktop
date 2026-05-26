import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { getClusters, getConnectedClusters } from './az-clusters';
import { getSubscriptions as getAzSubscriptions } from './az-subscriptions';

declare const pluginRunCommand: (
  command: string,
  args: string[],
  options: Record<string, unknown>
) => ReturnType<typeof import('@kinvolk/headlamp-plugin/lib').runCommand>;

/** An Azure subscription returned by the Azure CLI. */
export interface Subscription {
  /** The subscription GUID. */
  id: string;
  /** Human-readable subscription display name. */
  name: string;
  /** Subscription state, e.g. `"Enabled"`. */
  state: string;
  /** The Azure AD tenant that owns this subscription. */
  tenantId: string;
  /** Whether this is the CLI's currently-active default subscription. */
  isDefault: boolean;
}

/** A unified representation of an AKS managed cluster or an AKS Arc (connected) cluster. */
export interface AKSCluster {
  /** Cluster resource name. */
  name: string;
  /** Azure resource group containing the cluster. */
  resourceGroup: string;
  /** Azure region / location. */
  location: string;
  /** Kubernetes version running on the cluster. */
  kubernetesVersion: string;
  /** Current provisioning state, e.g. `"Succeeded"`. */
  provisioningState: string;
  /** Fully-qualified domain name (empty for Arc clusters). */
  fqdn: string;
  /** Whether Azure RBAC is enabled on the cluster's AAD profile. */
  isAzureRBACEnabled: boolean;
  /** Discriminator: `'aks'` for managed clusters, `'aksarc'` for Arc-connected clusters. */
  clusterType: 'aks' | 'aksarc';
}

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
function checkClusterReachable(clusterName: string): Promise<{ success: boolean; error?: string }> {
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
function arcProxyKey(subscriptionId: string, resourceGroup: string, clusterName: string): string {
  return `${subscriptionId}/${resourceGroup}/${clusterName}`;
}

/**
 * Get list of Azure subscriptions
 */
export async function getSubscriptions(): Promise<{
  success: boolean;
  message: string;
  subscriptions?: Subscription[];
}> {
  try {
    const subs = await getAzSubscriptions();

    return {
      success: true,
      message: 'Subscriptions retrieved successfully',
      subscriptions: subs.map((sub: any) => ({
        id: sub.id,
        name: sub.name,
        state: sub.status || 'Unknown',
        tenantId: sub.tenant,
        isDefault: false, // We don't have this info from the existing function
      })),
    };
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get list of AKS clusters in a subscription
 */
export async function getAKSClusters(subscriptionId: string): Promise<{
  success: boolean;
  message: string;
  clusters?: AKSCluster[];
}> {
  try {
    const aksClusters = await getClusters(subscriptionId);
    const arcClusters = await getConnectedClusters(subscriptionId);
    const clusters = [...aksClusters, ...arcClusters];

    return {
      success: true,
      message: 'AKS/Arc clusters retrieved successfully',
      clusters: clusters.map((cluster: any) => ({
        name: cluster.name,
        resourceGroup: cluster.resourceGroup,
        location: cluster.location,
        kubernetesVersion: cluster.version || '',
        provisioningState: cluster.status,
        fqdn: '', // Not returned by getClusters
        isAzureRBACEnabled: cluster.aadProfile !== null,
        clusterType: cluster.clusterType || 'aks',
      })),
    };
  } catch (error) {
    console.error('Error getting AKS clusters:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Register an AKS cluster using the Electron IPC API.
 * This calls the native registration logic in the Electron backend.
 *
 * @param managedNamespace - Optional managed namespace name to use for scoped credentials
 */
export async function registerAKSCluster(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string,
  managedNamespace?: string,
  tenantId?: string,
  clusterType: 'aks' | 'aksarc' = 'aks'
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    console.debug(
      '[AKS] Registering cluster:',
      clusterName,
      managedNamespace ? `with managed namespace: ${managedNamespace}` : ''
    );

    // Call the Electron IPC handler
    const desktopApi = (window as any).desktopApi;

    if (!desktopApi || !desktopApi.registerAKSCluster) {
      console.error('[AKS] Desktop API not available - running in non-desktop mode?');
      return {
        success: false,
        message: 'Desktop API not available. This feature is only available in desktop mode.',
      };
    }

    const result = await desktopApi.registerAKSCluster(
      subscriptionId,
      resourceGroup,
      clusterName,
      false, // isAzureRBACEnabled retained for backwards compatibility
      managedNamespace,
      clusterType
    );

    console.debug('[AKS] Registration result:', result);
    return result;
  } catch (error) {
    console.error('[AKS] Error registering AKS cluster:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
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
