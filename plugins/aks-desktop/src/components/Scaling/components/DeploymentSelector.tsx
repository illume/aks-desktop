// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { CircularProgress, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import React from 'react';
import type { DeploymentInfo } from '../hooks/useDeployments';

interface DeploymentSelectorProps {
  selectedDeployment: string;
  deployments: DeploymentInfo[];
  loading: boolean;
  onDeploymentChange: (deploymentName: string) => void;
}

/**
 * Dropdown selector for choosing a deployment to view scaling metrics
 */
export const DeploymentSelector: React.FC<DeploymentSelectorProps> = ({
  selectedDeployment,
  deployments,
  loading,
  onDeploymentChange,
}) => {
  const { t } = useTranslation();

  // A11y: The InputLabel id and Select labelId must be explicitly linked so that
  // the combobox element receives an accessible name via aria-labelledby.
  // MUI 5 Select accessibility: https://mui.com/material-ui/react-select/#accessibility
  // useId() guarantees a unique ID per instance, avoiding duplicate-ID violations
  // when multiple DeploymentSelector components are rendered on the same page.
  const labelId = React.useId();

  return (
    <FormControl sx={{ minWidth: 200 }} size="small" variant="outlined">
      <InputLabel id={labelId}>{t('Select Deployment')}</InputLabel>
      <Select
        labelId={labelId}
        value={selectedDeployment || ''}
        onChange={e => onDeploymentChange(e.target.value as string)}
        label={t('Select Deployment')}
        disabled={loading || deployments.length === 0}
      >
        {loading ? (
          <MenuItem disabled>
            {/* A11y: Decorative — the "Loading deployments..." text in the same
                MenuItem describes the state; the spinner is just visual feedback.
                MDN aria-hidden: https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Attributes/aria-hidden */}
            <CircularProgress size={16} style={{ marginRight: 8 }} aria-hidden="true" />
            {t('Loading deployments')}...
          </MenuItem>
        ) : deployments.length === 0 ? (
          <MenuItem disabled>{t('No deployments found')}</MenuItem>
        ) : (
          deployments.map(deployment => (
            <MenuItem key={deployment.name} value={deployment.name}>
              {deployment.name}
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );
};
