// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupAKSCluster } from './az-cluster-lookup';

const { runCommandAsync } = vi.hoisted(() => ({ runCommandAsync: vi.fn() }));
vi.mock('./az-cli-core', async importOriginal => ({
  ...(await importOriginal<typeof import('./az-cli-core')>()),
  runCommandAsync,
}));
vi.mock('../shared/runCommandAsync', () => ({ runCommandAsync }));

const subscriptionId = '12345678-1234-1234-1234-123456789abc';
const resourceId = `/subscriptions/${subscriptionId}/resourceGroups/my-group/providers/Microsoft.ContainerService/managedClusters/my-cluster`;
const cluster = {
  location: 'eastus',
  kubernetesVersion: '1.32.0',
  provisioningState: 'Succeeded',
  fqdn: 'my-cluster.example.azmk8s.io',
  aadProfile: { enableAzureRbac: true },
};

describe('lookupAKSCluster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runCommandAsync.mockResolvedValue({ stdout: JSON.stringify(cluster), stderr: '' });
  });

  it('looks up an ARM ID directly without listing subscriptions or clusters', async () => {
    await expect(lookupAKSCluster(`  ${resourceId}  `)).resolves.toEqual({
      subscriptionId,
      cluster: {
        name: 'my-cluster',
        resourceGroup: 'my-group',
        location: 'eastus',
        kubernetesVersion: '1.32.0',
        provisioningState: 'Succeeded',
        fqdn: cluster.fqdn,
        isAzureRBACEnabled: true,
        clusterType: 'aks',
      },
    });
    expect(runCommandAsync).toHaveBeenCalledExactlyOnceWith('az', [
      'aks',
      'show',
      '--subscription',
      subscriptionId,
      '--resource-group',
      'my-group',
      '--name',
      'my-cluster',
      '--output',
      'json',
    ]);
  });

  it.each([
    'my-cluster.example.azmk8s.io',
    'my-cluster.privatelink.eastus.azmk8s.io',
    'https://MY-CLUSTER.example.azmk8s.io/',
    'my-cluster.example.azmk8s.io.',
  ])('resolves the FQDN %s using a targeted cross-subscription query', async address => {
    runCommandAsync.mockResolvedValueOnce({
      stdout: JSON.stringify({ data: [{ id: resourceId }] }),
      stderr: '',
    });
    await expect(lookupAKSCluster(address)).resolves.toMatchObject({ subscriptionId });
    const args = runCommandAsync.mock.calls[0][1];
    expect(args.slice(0, 3)).toEqual(['graph', 'query', '-q']);
    expect(args[3]).toContain("type =~ 'microsoft.containerservice/managedclusters'");
    expect(args[3]).toContain('properties.fqdn =~');
    expect(args[3]).toContain('properties.privateFQDN =~');
    expect(args[3]).toContain('limit 2');
    expect(args).not.toContain('--subscription');
    expect(runCommandAsync.mock.calls[1][1]).toEqual([
      'aks',
      'show',
      '--subscription',
      subscriptionId,
      '--resource-group',
      'my-group',
      '--name',
      'my-cluster',
      '--output',
      'json',
    ]);
  });

  it.each([
    '',
    'not-a-hostname',
    "cluster.example.com' | take 1",
    '******cluster.example.com',
    'cluster.example.com/path',
    'cluster.example.com;echo',
    resourceId.replace(subscriptionId, 'invalid'),
    resourceId.replace('managedClusters', 'otherResources'),
    resourceId.replace('my-group', 'group" & echo'),
  ])('rejects invalid input without running Azure CLI: %s', async address => {
    await expect(lookupAKSCluster(address)).rejects.toThrow(/valid AKS cluster/);
    expect(runCommandAsync).not.toHaveBeenCalled();
  });

  it.each([
    [[], /No accessible AKS cluster/],
    [[{ id: resourceId }, { id: resourceId }], /Multiple clusters/],
  ])('rejects missing or ambiguous FQDN matches', async (data, error) => {
    runCommandAsync.mockResolvedValueOnce({ stdout: JSON.stringify({ data }), stderr: '' });
    await expect(lookupAKSCluster(cluster.fqdn)).rejects.toThrow(error);
    expect(runCommandAsync).toHaveBeenCalledTimes(1);
  });

  it('surfaces Azure authentication errors', async () => {
    runCommandAsync.mockResolvedValue({ stdout: '', stderr: "ERROR: Please run 'az login'" });
    await expect(lookupAKSCluster(resourceId)).rejects.toThrow(/Authentication required/);
  });

  it('surfaces malformed Azure output', async () => {
    runCommandAsync.mockResolvedValue({ stdout: 'not json', stderr: '' });
    await expect(lookupAKSCluster(resourceId)).rejects.toThrow(/Failed to get AKS cluster/);
  });
});
