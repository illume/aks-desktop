// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Icon } from '@iconify/react';
import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { Alert, Box, Button, Card, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import type { ChartDataPoint } from '../hooks/useChartData';
import type { DeploymentInfo } from '../hooks/useDeployments';
import type { EditValues } from '../hooks/useEditDialog';
import type { HPAInfo } from '../hooks/useHPAInfo';
import { DeploymentSelector } from './DeploymentSelector';
import { ScalingChart } from './ScalingChart';
import { ScalingEditDialog } from './ScalingEditDialog';
import { ScalingMetrics } from './ScalingMetrics';

/**
 * Props for the {@link ScalingTabPure} component.
 *
 * All data is passed in as props so this component has no side effects and
 * can be rendered in Storybook or unit tests without a live Kubernetes cluster.
 */
export interface ScalingTabPureProps {
  /** List of deployments in the namespace. */
  deployments: DeploymentInfo[];
  /** Name of the currently selected deployment. */
  selectedDeployment: string;
  /** Whether deployments are being fetched for the first time. */
  loading: boolean;
  /** Deployment fetch error, or null. */
  error: string | null;
  /** HPA info for the selected deployment, or null if not HPA-managed. */
  hpaInfo: HPAInfo | null;
  /** Scaling history chart data points. */
  chartData: ChartDataPoint[];
  /** Whether chart data is loading. */
  chartLoading: boolean;
  /** Chart data fetch error, or null. */
  chartError: string | null;
  /** Whether the edit dialog is open. */
  editDialogOpen: boolean;
  /** Current edit form values. */
  editValues: EditValues;
  /** Whether a save request is in flight. */
  saving: boolean;
  /** Save error from the last failed attempt, or null. */
  saveError: string | null;
  /** Callback when the user picks a different deployment. */
  onDeploymentChange: (deploymentName: string) => void;
  /** Callback to open the edit dialog. */
  onEditClick: () => void;
  /** Callback to close the edit dialog without saving. */
  onEditDialogClose: () => void;
  /** Callback to update edit form values. */
  onEditValuesChange: React.Dispatch<React.SetStateAction<EditValues>>;
  /** Callback to persist the current edit form values. */
  onSave: () => Promise<void>;
}

/**
 * Pure presentational component for the Scaling tab page.
 *
 * Renders the deployment selector, scaling overview card, edit dialog, and chart
 * from props alone — no hooks, no K8s API calls. The connected wrapper
 * {@link ScalingTab} provides the live data.
 */
export const ScalingTabPure: React.FC<ScalingTabPureProps> = ({
  deployments,
  selectedDeployment,
  loading,
  error,
  hpaInfo,
  chartData,
  chartLoading,
  chartError,
  editDialogOpen,
  editValues,
  saving,
  saveError,
  onDeploymentChange,
  onEditClick,
  onEditDialogClose,
  onEditValuesChange,
  onSave,
}) => {
  const { t } = useTranslation();

  if (loading && deployments.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        {/* A11y: CircularProgress renders role="progressbar"; aria-label provides the
            accessible name so screen readers announce what is loading.
            MUI Progress accessibility: https://mui.com/material-ui/react-progress/#accessibility */}
        <CircularProgress aria-label={t('Loading deployments')} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{t('Scaling')}</Typography>
        <DeploymentSelector
          selectedDeployment={selectedDeployment}
          deployments={deployments}
          loading={loading}
          onDeploymentChange={onDeploymentChange}
        />
      </Box>

      {(error || saveError) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {error || saveError}
        </Alert>
      )}

      {!selectedDeployment ? (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          minHeight="400px"
        >
          {/* A11y: Icon is purely decorative — aria-hidden hides it from the accessibility tree.
              MDN aria-hidden: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden */}
          <Icon
            icon="mdi:chart-line"
            aria-hidden="true"
            style={{ marginBottom: 16, color: '#ccc', fontSize: 64 }}
          />
          <Typography color="textSecondary" variant="h6">
            {t('Select a deployment to view scaling metrics')}
          </Typography>
        </Box>
      ) : (
        <>
          {/* Scaling Overview */}
          <Card sx={{ p: 2, mb: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 1.5,
              }}
            >
              <Typography variant="h6">{t('Scaling Overview')}</Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={
                  // A11y: Icon inside Button is purely decorative — aria-hidden prevents
                  // screen readers from announcing the icon name alongside the button label.
                  // MDN aria-hidden: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden
                  <Icon icon="mdi:pencil" aria-hidden="true" />
                }
                onClick={onEditClick}
              >
                {t('Edit Configuration')}
              </Button>
            </Box>
            <ScalingMetrics
              hpaInfo={hpaInfo}
              selectedDeployment={selectedDeployment}
              deployments={deployments}
            />
          </Card>

          {/* Scaling History Chart */}
          <Card sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {t('Scaling History (Last 24 Hours)')}
            </Typography>
            <Box sx={{ height: 500, width: '100%', mt: 2 }}>
              <ScalingChart chartData={chartData} loading={chartLoading} error={chartError} />
            </Box>
          </Card>
        </>
      )}

      {/* Edit Dialog */}
      <ScalingEditDialog
        open={editDialogOpen}
        hpaInfo={hpaInfo}
        editValues={editValues}
        saving={saving}
        onEditValuesChange={onEditValuesChange}
        onClose={onEditDialogClose}
        onSave={onSave}
      />
    </Box>
  );
};
