// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useCallback, useState } from 'react';
import { sanitizeDnsName } from '../../../utils/kubernetes/k8sNames';

type DeployWorkloadIdentityStatus =
  | 'idle'
  | 'done'
  | 'error';

interface DeployWorkloadIdentityResult {
  clientId: string;
  serviceAccountName: string;
}

interface UseDeployWorkloadIdentityReturn {
  status: DeployWorkloadIdentityStatus;
  error: string | null;
  result: DeployWorkloadIdentityResult | null;
  setupWorkloadIdentity: (config: DeployWorkloadIdentityConfig) => Promise<void>;
  reset: () => void;
}

export interface DeployWorkloadIdentityConfig {
  subscriptionId: string;
  resourceGroup: string;
  identityResourceGroup: string;
  clusterName: string;
  namespace: string;
  appName: string;
  acrResourceId?: string;
  isManagedNamespace: boolean;
  azureRbacEnabled?: boolean;
}

/** Derives a valid Azure managed identity name from the app name (max 128 chars). */
export function getDeployIdentityName(appName: string): string {
  return sanitizeDnsName(`id-${appName}-workload`, 128, 'id-app-workload');
}

/**
 * Stub hook for workload identity setup.
 * Azure Workload Identity operations are not available in this plugin.
 */
export const useDeployWorkloadIdentity = (): UseDeployWorkloadIdentityReturn => {
  const [status] = useState<DeployWorkloadIdentityStatus>('idle');
  const [error] = useState<string | null>(null);
  const [result] = useState<DeployWorkloadIdentityResult | null>(null);

  const setupWorkloadIdentity = useCallback(async (_config: DeployWorkloadIdentityConfig) => {
    console.warn('[headlamp-plugin-deploy] Workload identity setup is not available in this plugin.');
  }, []);

  const reset = useCallback(() => {}, []);

  return { status, error, result, setupWorkloadIdentity, reset };
};
