// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { quoteForPlatform } from '../shared/quoteForPlatform';
import type { AKSCluster } from './aks';
import { isValidGuid, runAzCommand } from './az-cli-core';

const resourceIdPattern =
  /^\/subscriptions\/([0-9a-f-]+)\/resourceGroups\/([\p{L}\p{N}_.()-]+)\/providers\/Microsoft.ContainerService\/managedClusters\/([a-z0-9][a-z0-9_-]{0,62})\/?$/iu;

/** Resolve a managed AKS cluster without enumerating subscriptions or clusters. */
export async function lookupAKSCluster(
  input: string
): Promise<{ subscriptionId: string; cluster: AKSCluster }> {
  let resourceId = input.trim();
  let scope = resourceId.match(resourceIdPattern);
  if (!scope) {
    const hostname = resourceId
      .replace(/^https:\/\//i, '')
      .replace(/\/$/, '')
      .replace(/\.$/, '');
    const labels = hostname.split('.');
    if (
      hostname.length > 253 ||
      labels.length < 2 ||
      !labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
    ) {
      throw new Error('Enter a valid AKS cluster FQDN or ARM resource ID.');
    }

    // DNS validation above also keeps user input out of KQL syntax.
    const query = `Resources
      | where type =~ 'microsoft.containerservice/managedclusters'
      | where properties.fqdn =~ '${hostname}' or properties.privateFQDN =~ '${hostname}'
      | project id
      | limit 2`;
    const result = await runAzCommand<{ data: { id: string }[] }>(
      ['graph', 'query', '-q', quoteForPlatform(query), '--output', 'json'],
      'Looking up AKS cluster by FQDN',
      'find AKS cluster',
      JSON.parse
    );
    if (!result.success) {
      throw new Error(result.error);
    }
    const matches = result.data?.data ?? [];
    if (matches.length !== 1) {
      throw new Error(
        matches.length > 1
          ? 'Multiple clusters match this FQDN. Use the ARM resource ID instead.'
          : 'No accessible AKS cluster found for this FQDN. Check the address and Azure login.'
      );
    }
    resourceId = matches[0].id;
    scope = resourceId.match(resourceIdPattern);
  }
  if (!scope || !isValidGuid(scope[1])) {
    throw new Error('Enter a valid AKS cluster ARM resource ID.');
  }

  const result = await runAzCommand<{
    location: string;
    kubernetesVersion: string;
    provisioningState: string;
    fqdn?: string;
    privateFqdn?: string;
    aadProfile?: { enableAzureRbac?: boolean };
  }>(
    ['aks', 'show', '--ids', quoteForPlatform(resourceId), '--output', 'json'],
    'Looking up AKS cluster',
    'get AKS cluster',
    JSON.parse
  );
  if (!result.success || !result.data) {
    throw new Error(result.error || 'Failed to get AKS cluster.');
  }
  return {
    subscriptionId: scope[1],
    cluster: {
      name: scope[3],
      resourceGroup: scope[2],
      location: result.data.location,
      kubernetesVersion: result.data.kubernetesVersion,
      provisioningState: result.data.provisioningState,
      fqdn: result.data.fqdn || result.data.privateFqdn || '',
      isAzureRBACEnabled: result.data.aadProfile?.enableAzureRbac === true,
      clusterType: 'aks',
    },
  };
}
