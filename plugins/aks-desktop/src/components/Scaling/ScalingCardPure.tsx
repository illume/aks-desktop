// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Icon } from '@iconify/react';
import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { Alert, Box, Typography } from '@mui/material';
import React from 'react';
import { DeploymentSelector } from './components/DeploymentSelector';
import { ScalingChart } from './components/ScalingChart';
import { ScalingMetrics } from './components/ScalingMetrics';
import type { ChartDataPoint } from './hooks/useChartData';
import type { DeploymentInfo } from './hooks/useDeployments';
import type { HPAInfo } from './hooks/useHPAInfo';

/**
 * Props for the {@link ScalingCardPure} component.
 *
 * All data is passed in as props so this component has no side effects and
 * can be rendered in Storybook or unit tests without a live Kubernetes cluster.
 */
export interface ScalingCardPureProps {
  /** List of deployments in the namespace. */
  deployments: DeploymentInfo[];
  /** Name of the currently selected deployment. */
  selectedDeployment: string;
  /** Whether deployments are being fetched. */
  loading: boolean;
  /** Error message if deployment fetch failed, or null. */
  error: string | null;
  /** HPA info for the selected deployment, or null if not HPA-managed. */
  hpaInfo: HPAInfo | null;
  /** Scaling history chart data points. */
  chartData: ChartDataPoint[];
  /** Whether chart data is loading. */
  chartLoading: boolean;
  /** Error message if chart data fetch failed, or null. */
  chartError: string | null;
  /** Callback when the user picks a different deployment. */
  onDeploymentChange: (deploymentName: string) => void;
}

/**
 * Pure presentational component for the Scaling card panel.
 *
 * Renders the deployment selector, scaling metrics, and chart from props alone —
 * no hooks, no K8s API calls. The connected wrapper {@link ScalingCard} provides
 * the live data.
 */
export const ScalingCardPure: React.FC<ScalingCardPureProps> = ({
  deployments,
  selectedDeployment,
  loading,
  error,
  hpaInfo,
  chartData,
  chartLoading,
  chartError,
  onDeploymentChange,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0, '&:last-child': { pb: 0 } }}
    >
      {/* Header with title and deployment selector */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
        }}
      >
        <Typography variant="h6">{t('Scaling')}</Typography>
        <DeploymentSelector
          selectedDeployment={selectedDeployment}
          deployments={deployments}
          loading={loading}
          onDeploymentChange={onDeploymentChange}
        />
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {selectedDeployment && (
        <>
          {/* Metrics Overview */}
          <ScalingMetrics
            hpaInfo={hpaInfo}
            selectedDeployment={selectedDeployment}
            deployments={deployments}
          />
          {/* Chart */}
          <Box sx={{ height: 400, width: '100%' }}>
            <ScalingChart chartData={chartData} loading={chartLoading} error={chartError} />
          </Box>
        </>
      )}

      {!selectedDeployment && (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          flex={1}
        >
          {/* A11y: Icon is purely decorative — aria-hidden hides it from the accessibility tree.
              MDN aria-hidden: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden */}
          <Icon
            icon="mdi:chart-line"
            aria-hidden="true"
            style={{ marginBottom: 16, color: '#ccc', fontSize: 48 }}
          />
          <Typography color="textSecondary" variant="body1">
            {t('Select a deployment to view scaling metrics')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
