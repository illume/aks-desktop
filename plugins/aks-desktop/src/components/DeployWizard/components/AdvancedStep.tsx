// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { Box, Button, FormControlLabel, Switch, Typography } from '@mui/material';
import React from 'react';
import { CONTAINER_STEPS } from '../hooks/useContainerConfiguration';
import { ContainerConfigProp, LabelWithInfo } from './configureContainerUtils';

interface AdvancedStepProps {
  containerConfig: ContainerConfigProp;
}

export default function AdvancedStep({ containerConfig }: AdvancedStepProps) {
  const { t } = useTranslation();

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('Configure security context settings for the container.')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={containerConfig.config.runAsNonRoot}
              onChange={e =>
                containerConfig.setConfig(c => ({ ...c, runAsNonRoot: e.target.checked }))
              }
            />
          }
          label={
            <LabelWithInfo
              label={t('Run as non root user')}
              infoText={t(
                'Ensures the container runs as a non-root user (UID != 0) for better security. This prevents privilege escalation attacks.'
              )}
            />
          }
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 5, display: 'block', mt: -1 }}
        >
          {t('Ensures the container runs as a non-root user for better security.')}
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={containerConfig.config.readOnlyRootFilesystem}
              onChange={e =>
                containerConfig.setConfig(c => ({
                  ...c,
                  readOnlyRootFilesystem: e.target.checked,
                }))
              }
            />
          }
          label={
            <LabelWithInfo
              label={t('Read only root filesystem')}
              infoText={t(
                "Mounts the container's root filesystem as read-only to prevent write operations. This enhances security by preventing malicious code from modifying system files."
              )}
            />
          }
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 5, display: 'block', mt: -1 }}
        >
          {t("Mounts the container's root filesystem as read-only to prevent write operations.")}
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={containerConfig.config.allowPrivilegeEscalation}
              onChange={e =>
                containerConfig.setConfig(c => ({
                  ...c,
                  allowPrivilegeEscalation: e.target.checked,
                }))
              }
            />
          }
          label={
            <LabelWithInfo
              label={t('Allow privilege escalation')}
              infoText={t(
                'Controls whether a process can gain more privileges than its parent process. Disabling this (recommended) prevents privilege escalation attacks.'
              )}
            />
          }
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 5, display: 'block', mt: -1 }}
        >
          {t('Controls whether a process can gain more privileges than its parent process.')}
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={containerConfig.config.enablePodAntiAffinity}
              onChange={e =>
                containerConfig.setConfig(c => ({
                  ...c,
                  enablePodAntiAffinity: e.target.checked,
                }))
              }
            />
          }
          label={
            <LabelWithInfo
              label={t('Enable pod anti-affinity')}
              infoText={t(
                'Prefer scheduling pods on different nodes to improve availability and fault tolerance. This helps ensure pods are distributed across the cluster.'
              )}
            />
          }
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 5, display: 'block', mt: -1 }}
        >
          {t(
            'Prefer scheduling pods on different nodes to improve availability and fault tolerance.'
          )}
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={containerConfig.config.enableTopologySpreadConstraints}
              onChange={e =>
                containerConfig.setConfig(c => ({
                  ...c,
                  enableTopologySpreadConstraints: e.target.checked,
                }))
              }
            />
          }
          label={
            <LabelWithInfo
              label={t('Enable topology spread constraints')}
              infoText={t(
                'Distributes pods evenly across nodes, zones, or other topology domains to improve workload distribution and availability.'
              )}
            />
          }
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: 5, display: 'block', mt: -1 }}
        >
          {t('Distributes pods evenly across nodes to improve workload distribution.')}
        </Typography>
      </Box>
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={() =>
            containerConfig.setConfig(c => ({
              ...c,
              containerStep: CONTAINER_STEPS.WORKLOAD_IDENTITY,
            }))
          }
        >
          {t('Back')}
        </Button>
      </Box>
    </>
  );
}
