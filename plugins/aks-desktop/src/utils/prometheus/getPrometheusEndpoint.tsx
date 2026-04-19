// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { configureAzureCliExtensions } from '../azure/az-extensions';
import { runCommandWithOutput } from '../kubernetes/cli-runner';

/** Flip to `true` locally when debugging Prometheus endpoint discovery. */
const DEBUG = false;

/**
 * Fetches Prometheus endpoint for a given cluster
 *
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of target cluster.
 * @param subscription - Azure subscription ID.
 * @returns The Prometheus query endpoint URL.
 */
export async function getPrometheusEndpoint(
  resourceGroup: string,
  clusterName: string,
  subscription: string
): Promise<string> {
  try {
    // Configure Azure CLI to auto-install extensions without prompts
    // This allows the az alerts-management command to automatically install the extension if needed
    if (DEBUG) console.debug('Configuring Azure CLI for automatic extension installation...');
    await configureAzureCliExtensions();

    if (DEBUG) {
      console.debug('[getPrometheusEndpoint] Querying prometheus rule groups...');
      console.debug('[getPrometheusEndpoint] Parameters:', {
        resourceGroup,
        clusterName,
        subscription,
      });
    }

    // First, get all rule groups as JSON and filter in JavaScript
    // This avoids shell escaping issues with JMESPath queries
    const { stdout: allGroupsStdout, stderr: allGroupsStderr } = await runCommandWithOutput('az', [
      'alerts-management',
      'prometheus-rule-group',
      'list',
      '--resource-group',
      resourceGroup,
      '--output',
      'json',
      '--subscription',
      subscription,
    ]);

    if (DEBUG) {
      console.debug('[getPrometheusEndpoint] All rule groups query result:');
      console.debug('[getPrometheusEndpoint]   stdout length:', allGroupsStdout.length);
      console.debug('[getPrometheusEndpoint]   stderr present:', !!allGroupsStderr);
    }

    if (!allGroupsStdout.trim()) {
      throw new Error(
        'Azure Monitor Metrics (Managed Prometheus) does not appear to be configured for this cluster. ' +
          `To enable it, run: az aks update --resource-group ${resourceGroup} --name ${clusterName} --enable-azure-monitor-metrics.` +
          ' See docs/cluster-requirements.md for full cluster requirements.'
      );
    }

    let ruleGroups;
    try {
      ruleGroups = JSON.parse(allGroupsStdout);
      if (DEBUG) console.debug('[getPrometheusEndpoint] Found', ruleGroups.length, 'rule groups');
    } catch (parseError) {
      console.error('[getPrometheusEndpoint] Failed to parse rule groups JSON:', parseError);
      throw new Error('Failed to parse prometheus rule groups response');
    }

    // Filter for the specific cluster in JavaScript
    const matchingGroup = ruleGroups.find((rg: any) => rg.clusterName === clusterName);

    if (!matchingGroup) {
      console.error('[getPrometheusEndpoint] No rule group found for the specified cluster');
      console.error(
        '[getPrometheusEndpoint] Available clusters count:',
        ruleGroups.length
      );
      throw new Error(
        `No Prometheus workspace found for cluster '${clusterName}'. ` +
          'Ensure Azure Monitor Metrics is enabled. ' +
          `To enable it, run: az aks update --resource-group ${resourceGroup} --name ${clusterName} --enable-azure-monitor-metrics.` +
          ' See docs/cluster-requirements.md for full cluster requirements.'
      );
    }

    if (DEBUG) console.debug('[getPrometheusEndpoint] Found matching rule group:', matchingGroup.name);

    // Get the workspace scope from the first scope
    const workspaceScope = matchingGroup.scopes?.[0];
    if (!workspaceScope) {
      throw new Error('Rule group has no scopes defined');
    }

    if (DEBUG) console.debug('[getPrometheusEndpoint] Found workspace scope:', workspaceScope);

    const { stdout: endpointStdout } = await runCommandWithOutput('az', [
      'monitor',
      'account',
      'show',
      '--ids',
      workspaceScope,
      '--query',
      'metrics.prometheusQueryEndpoint',
      '--output',
      'tsv',
      '--subscription',
      subscription,
    ]);

    if (DEBUG) console.debug('[getPrometheusEndpoint] Prometheus endpoint:', endpointStdout.trim());

    return endpointStdout.trim();
  } catch (error) {
    console.error('MetricsTab: Failed to get Prometheus endpoint:', error);
    throw error;
  }
}
