// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { debugLog, isAzError, needsRelogin, runCommandAsync } from './az-cli-core';

/**
 * Gets the Azure resource ID and resource group for a given AKS cluster.
 *
 * @param clusterName - Name of the AKS cluster.
 * @param subscription - Azure subscription ID.
 * @returns The resource ID and resource group, or null if not found.
 */
export async function getClusterResourceIdAndGroup(
  clusterName: string,
  subscription: string
): Promise<{ resourceId: string; resourceGroup: string } | null> {
  if (!clusterName) return null;
  debugLog('cluster name:', clusterName, 'subscription:', subscription);
  const { stdout, stderr } = await runCommandAsync('az', [
    'aks',
    'list',
    '--query',
    `[?name=='${clusterName}']`,
    '-o',
    'json',
    '--subscription',
    subscription,
  ]);

  debugLog('stdout:', stdout);
  debugLog('stderr:', stderr);
  if (stderr && needsRelogin(stderr)) {
    throw new Error('Authentication required. Please log in to Azure CLI: az login');
  }

  if (stderr && isAzError(stderr)) {
    throw new Error(`Failed to list AKS clusters: ${stderr}`);
  }

  try {
    const arr = JSON.parse(stdout || '[]');
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const item = arr[0] || {};
    const resourceId: string = item.id || '';
    let resourceGroup: string = item.resourceGroup || '';

    if (!resourceGroup && resourceId) {
      const match = resourceId.match(/\/resourceGroups\/([^/]+)\//i);
      if (match && match[1]) resourceGroup = match[1];
    }

    if (!resourceId) return null;
    return { resourceId, resourceGroup };
  } catch (parseError) {
    debugLog('parseError:', parseError);
    throw new Error('Failed to parse AKS list response');
  }
}
