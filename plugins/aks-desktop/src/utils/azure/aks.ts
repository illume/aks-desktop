import { getClusters, getConnectedClusters } from './az-clusters';
import { getSubscriptions as getAzSubscriptions } from './az-subscriptions';

// Re-export BareMetal proxy types and functions from the dedicated module.
export type { BareMetalProxyStatus } from '../../components/BareMetal/proxy';
export {
  getBareMetalProxyStatus,
  startBareMetalProxy,
  stopBareMetalProxy,
  restartBareMetalProxy,
} from '../../components/BareMetal/proxy';

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

/** A unified representation of an AKS managed cluster or an AKS BareMetal (connected) cluster. */
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
  /** Fully-qualified domain name (empty for BareMetal clusters). */
  fqdn: string;
  /** Whether Azure RBAC is enabled on the cluster's AAD profile. */
  isAzureRBACEnabled: boolean;
  /** Discriminator: `'aks'` for managed clusters, `'aksarc'` for Arc-connected clusters. */
  clusterType: 'aks' | 'aksarc';
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
      message: 'AKS/BareMetal clusters retrieved successfully',
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
