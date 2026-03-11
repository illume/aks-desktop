// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { K8s } from '@kinvolk/headlamp-plugin/lib';
import React from 'react';
import { RESOURCE_GROUP_LABEL, SUBSCRIPTION_LABEL } from '../../utils/constants/projectLabels';
import { ScalingCardPure } from './components/ScalingCardPure';
import { useChartData } from './hooks/useChartData';
import { useDeployments } from './hooks/useDeployments';
import { useHPAInfo } from './hooks/useHPAInfo';

/**
 * Defines the structure of a project for scaling operations.
 */
export interface ProjectDefinition {
  /** Unique identifier for the project. */
  id: string;
  /** List of Kubernetes namespaces associated with the project. */
  namespaces: string[];
  /** List of cluster names/identifiers where the project can be deployed. */
  clusters: string[];
}

/** Alias for ProjectDefinition. */
type Project = ProjectDefinition;

// 2 hours at 15-minute resolution (8 data points)
const TIME_RANGE_SECS = 7200;
const STEP_SECS = 900;

/**
 * Props for the {@link ScalingCard} component.
 */
interface ScalingCardProps {
  /** The project whose first cluster and namespace are used to fetch deployments. */
  project: Project;
}

/**
 * Displays scaling metrics and charts for a selected Kubernetes deployment.
 *
 * This connected component fetches live data via K8s hooks and delegates all
 * rendering to {@link ScalingCardPure}.
 *
 * @param props.project - The project whose first cluster and namespace are used to fetch deployments.
 */
function ScalingCard({ project }: ScalingCardProps) {
  const namespace = project.namespaces?.[0];
  const cluster = project.clusters?.[0];

  // Get subscription and resource group from namespace labels
  const [namespaceInstance] = K8s.ResourceClasses.Namespace.useGet(namespace, undefined, {
    cluster,
  });
  const subscription = namespaceInstance?.jsonData?.metadata?.labels?.[SUBSCRIPTION_LABEL];
  const resourceGroupLabel = namespaceInstance?.jsonData?.metadata?.labels?.[RESOURCE_GROUP_LABEL];

  // Fetch real deployments from Kubernetes API
  const { deployments, selectedDeployment, loading, error, setSelectedDeployment } = useDeployments(
    namespace,
    cluster
  );
  // Find HPA that targets the selected deployment
  const { hpaInfo } = useHPAInfo(selectedDeployment, namespace, cluster);
  // Fetch real chart data from Prometheus
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

  return (
    <ScalingCardPure
      deployments={deployments}
      selectedDeployment={selectedDeployment}
      loading={loading}
      error={error}
      hpaInfo={hpaInfo}
      chartData={chartData}
      chartLoading={chartLoading}
      chartError={chartError}
      onDeploymentChange={setSelectedDeployment}
    />
  );
}

export default ScalingCard;
