// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { Box, Button, Typography } from '@mui/material';
import React from 'react';
import { CONTAINER_STEPS } from '../hooks/useContainerConfiguration';
import type { ContainerConfigProp, DeployAzureContext } from './configureContainerUtils';

interface WorkloadIdentityStepProps {
  containerConfig: ContainerConfigProp;
  azureContext?: DeployAzureContext;
  namespace?: string;
}

/**
 * Stub for Workload Identity step.
 * Azure Workload Identity configuration is not available in this plugin.
 */
export default function WorkloadIdentityStep({ containerConfig }: WorkloadIdentityStepProps) {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="body2" color="text.secondary">
        {t('Workload Identity configuration is not available in this plugin.')}
      </Typography>
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={() =>
            containerConfig.setConfig(c => ({ ...c, containerStep: CONTAINER_STEPS.HPA }))
          }
        >
          {t('Back')}
        </Button>
        <Button
          variant="contained"
          onClick={() =>
            containerConfig.setConfig(c => ({ ...c, containerStep: CONTAINER_STEPS.ADVANCED }))
          }
        >
          {t('Continue')}
        </Button>
      </Box>
    </>
  );
}
