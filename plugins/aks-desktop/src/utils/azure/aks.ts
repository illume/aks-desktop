import { K8s } from '@kinvolk/headlamp-plugin/lib';
import { getClusters, getConnectedClusters } from './az-clusters';
import { getSubscriptions as getAzSubscriptions } from './az-subscriptions';

declare const pluginRunCommand: (
  command: string,
  args: string[],
  options: Record<string, unknown>
) => ReturnType<typeof import('@kinvolk/headlamp-plugin/lib').runCommand>;

export interface Subscription {
  id: string;
  name: string;
  state: string;
  tenantId: string;
  isDefault: boolean;
}

export interface AKSCluster {
  name: string;
  resourceGroup: string;
  location: string;
  kubernetesVersion: string;
  provisioningState: string;
  fqdn: string;
  isAzureRBACEnabled: boolean;
  clusterType: 'aks' | 'aksarc';
}

export interface ArcProxyStatus {
  success: boolean;
  status: 'stopped' | 'starting' | 'running' | 'error';
  lastError?: string;
  pid?: number;
}

interface ArcProxySession {
  cmd?: ReturnType<typeof import('@kinvolk/headlamp-plugin/lib').runCommand>;
  status: ArcProxyStatus['status'];
  lastError?: string;
  pid?: number;
}

const arcProxySessions = new Map<string, ArcProxySession>();

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
        isAzureRBACEnabled: cluster.aadProfile != null && cluster.aadProfile.enableAzureRbac === true,
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

export async function restartArcProxy(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<ArcProxyStatus> {
  await stopArcProxy(subscriptionId, resourceGroup, clusterName);
  return startArcProxy(subscriptionId, resourceGroup, clusterName);
}
