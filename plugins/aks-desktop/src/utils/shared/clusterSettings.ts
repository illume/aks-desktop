// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

export interface ClusterSettings {
  allowedNamespaces?: string[];
  /** Discriminator stored at registration time: `'aks'` for managed clusters, `'aksarc'` for Arc-connected clusters. */
  clusterType?: 'aks' | 'aksarc';
  /** Azure subscription ID owning the cluster. */
  subscriptionId?: string;
  /** Azure resource group containing the cluster. */
  resourceGroup?: string;
  [key: string]: unknown;
}

/**
 * Builds the localStorage key for a cluster's settings.
 *
 * When `subscriptionId` and `resourceGroup` are provided the key includes
 * them so that two clusters with the same name in different
 * subscriptions/resource-groups do not collide.  Falls back to the
 * legacy `cluster_settings.${clusterName}` format when the extra
 * identifiers are unavailable.
 */
export function clusterSettingsKey(
  clusterName: string,
  subscriptionId?: string,
  resourceGroup?: string
): string {
  if (subscriptionId && resourceGroup) {
    return `cluster_settings.${subscriptionId}.${resourceGroup}.${clusterName}`;
  }
  return `cluster_settings.${clusterName}`;
}

/**
 * Reads and parses cluster settings from localStorage.
 * Returns a plain object with the parsed settings,
 * or an empty object if the key is missing or unparseable.
 *
 * When called with only `clusterName` the function first tries the
 * legacy key (`cluster_settings.${clusterName}`).  Pass `subscriptionId`
 * and `resourceGroup` when available to use the disambiguated key.
 */
export function getClusterSettings(
  clusterName: string,
  subscriptionId?: string,
  resourceGroup?: string
): ClusterSettings {
  try {
    const key = clusterSettingsKey(clusterName, subscriptionId, resourceGroup);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as ClusterSettings;
      }
    }
    // Fall back to the legacy key when the qualified key has no entry
    if (subscriptionId && resourceGroup) {
      const legacyRaw = localStorage.getItem(`cluster_settings.${clusterName}`);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as ClusterSettings;
        }
      }
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Writes cluster settings back to localStorage.
 *
 * Uses the disambiguated key when `subscriptionId` and `resourceGroup`
 * are present in the settings object, otherwise falls back to the
 * legacy key.
 */
export function setClusterSettings(clusterName: string, settings: ClusterSettings): void {
  const key = clusterSettingsKey(clusterName, settings.subscriptionId, settings.resourceGroup);
  localStorage.setItem(key, JSON.stringify(settings));
}
