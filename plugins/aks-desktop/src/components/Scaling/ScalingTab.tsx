// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { useChartData } from './hooks/useChartData';
import { useDeployments } from './hooks/useDeployments';
import { useEditDialog } from './hooks/useEditDialog';
import { useHPAInfo } from './hooks/useHPAInfo';
import { ScalingTabPure } from './ScalingTabPure';

/**
 * Props for the {@link ScalingTab} component.
 */
interface ScalingTabProps {
  /** The project whose first cluster and namespace are used to fetch deployments. */
  project: {
    clusters: string[];
    namespaces: string[];
    id: string;
  };
}

// 24 hours at 1-hour resolution (24 data points)
const TIME_RANGE_SECS = 86400;
const STEP_SECS = 3600;

/**
 * Full-page tab for viewing and editing scaling configuration for a deployment.
 *
 * This connected component fetches live data via K8s hooks and delegates all
 * rendering to {@link ScalingTabPure}.
 *
 * @param props.project - The project whose first cluster and namespace are used.
 */
const ScalingTab: React.FC<ScalingTabProps> = ({ project }) => {
  const namespace = project.namespaces?.[0];
  const cluster = project.clusters?.[0];

  const [namespaceInstance] = K8s.ResourceClasses.Namespace.useGet(namespace, undefined, {
    cluster,
  });
  const subscription =
    namespaceInstance?.jsonData?.metadata?.labels?.['aks-desktop/project-subscription'];
  const resourceGroupLabel =
    namespaceInstance?.jsonData?.metadata?.labels?.['aks-desktop/project-resource-group'];

  const { deployments, selectedDeployment, loading, error, setSelectedDeployment } = useDeployments(
    namespace,
    cluster
  );

  const { hpaInfo } = useHPAInfo(selectedDeployment, namespace, cluster);

  const {
    chartData,
    loading: chartLoading,
    error: chartError,
  } = useChartData(
    selectedDeployment,
    namespace,
    cluster,
    subscription,
    resourceGroupLabel,
    TIME_RANGE_SECS,
    STEP_SECS
  );

  const {
    editDialogOpen,
    editValues,
    saving,
    saveError,
    handleEditClick,
    handleClose,
    setEditValues,
    handleSave,
  } = useEditDialog(selectedDeployment, deployments, hpaInfo, namespace, cluster, () => {
    // Data refreshes automatically via the live K8s watchers in useDeployments and useHPAInfo
  });

  return (
    <ScalingTabPure
      deployments={deployments}
      selectedDeployment={selectedDeployment}
      loading={loading}
      error={error}
      hpaInfo={hpaInfo}
      chartData={chartData}
      chartLoading={chartLoading}
      chartError={chartError}
      editDialogOpen={editDialogOpen}
      editValues={editValues}
      saving={saving}
      saveError={saveError}
      onDeploymentChange={setSelectedDeployment}
      onEditClick={handleEditClick}
      onEditDialogClose={handleClose}
      onEditValuesChange={setEditValues}
      onSave={handleSave}
    />
  );
};

export default ScalingTab;
