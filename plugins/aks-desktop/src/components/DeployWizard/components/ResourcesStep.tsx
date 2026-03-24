// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Icon } from '@iconify/react';
import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import {
  Box,
  Button,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import { CONTAINER_STEPS } from '../hooks/useContainerConfiguration';
import { ContainerConfigProp, LabelWithInfo } from './configureContainerUtils';
import { setFromInput } from './types';

interface ResourcesStepProps {
  containerConfig: ContainerConfigProp;
}

export default function ResourcesStep({ containerConfig }: ResourcesStepProps) {
  const { t } = useTranslation();

  return (
    <>
      <FormControlLabel
        control={
          <Switch
            checked={containerConfig.config.enableResources}
            onChange={e =>
              containerConfig.setConfig(c => ({ ...c, enableResources: e.target.checked }))
            }
          />
        }
        label={
          <LabelWithInfo
            label={t('Enable resource requests and limits')}
            infoText={t(
              'Set CPU and memory requests (guaranteed resources) and limits (maximum resources) to control resource allocation and prevent containers from consuming excessive cluster resources.'
            )}
          />
        }
      />
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))',
          gap: 2,
        }}
      >
        <Box>
          <Box
            component="label"
            htmlFor="cpu-request-input"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('CPU request')}
            </Typography>
            <Tooltip
              title={t(
                'The minimum amount of CPU guaranteed to the container. Kubernetes will schedule the pod on a node with at least this much CPU available.'
              )}
              arrow
            >
              <IconButton aria-label={t('Information about CPU request')}>
                <Icon
                  icon="mdi:information-outline"
                  width="16px"
                  height="16px"
                  aria-hidden="true"
                />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            id="cpu-request-input"
            type="number"
            inputProps={{ step: 50, min: 1 }}
            value={containerConfig.config.cpuRequest?.replace(/m$/, '')}
            onChange={e =>
              setFromInput(e.target.value, 'm', val =>
                containerConfig.setConfig(c => ({ ...c, cpuRequest: val }))
              )
            }
            InputProps={{
              endAdornment: <InputAdornment position="end">{t('millicores')}</InputAdornment>,
            }}
            disabled={!containerConfig.config.enableResources}
            fullWidth
          />
        </Box>

        <Box>
          <Box
            component="label"
            htmlFor="cpu-limit-input"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('CPU limit')}
            </Typography>
            <Tooltip
              title={t(
                'The maximum amount of CPU the container can use. If exceeded, the container will be throttled.'
              )}
              arrow
            >
              <IconButton aria-label={t('Information about CPU limit')}>
                <Icon
                  icon="mdi:information-outline"
                  width="16px"
                  height="16px"
                  aria-hidden="true"
                />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            id="cpu-limit-input"
            type="number"
            inputProps={{ step: 50, min: 1 }}
            value={containerConfig.config.cpuLimit?.replace(/m$/, '')}
            onChange={e =>
              setFromInput(e.target.value, 'm', val =>
                containerConfig.setConfig(c => ({ ...c, cpuLimit: val }))
              )
            }
            InputProps={{
              endAdornment: <InputAdornment position="end">{t('millicores')}</InputAdornment>,
            }}
            disabled={!containerConfig.config.enableResources}
            fullWidth
          />
        </Box>
        <Box>
          <Box
            component="label"
            htmlFor="memory-request-input"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('Memory request')}
            </Typography>
            <Tooltip
              title={t(
                'The minimum amount of memory guaranteed to the container. Kubernetes will schedule the pod on a node with at least this much memory available.'
              )}
              arrow
            >
              <IconButton aria-label={t('Information about memory request')}>
                <Icon
                  icon="mdi:information-outline"
                  width="16px"
                  height="16px"
                  aria-hidden="true"
                />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            id="memory-request-input"
            type="number"
            inputProps={{ step: 64, min: 1 }}
            value={containerConfig.config.memoryRequest?.replace(/Mi$/, '')}
            onChange={e =>
              setFromInput(e.target.value, 'Mi', val =>
                containerConfig.setConfig(c => ({ ...c, memoryRequest: val }))
              )
            }
            InputProps={{
              endAdornment: <InputAdornment position="end">{t('mebibytes')}</InputAdornment>,
            }}
            disabled={!containerConfig.config.enableResources}
            fullWidth
          />
        </Box>

        <Box>
          <Box
            component="label"
            htmlFor="memory-limit-input"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              {t('Memory limit')}
            </Typography>
            <Tooltip
              title={t(
                'The maximum amount of memory the container can use. If exceeded, the container will be terminated (OOMKilled).'
              )}
              arrow
            >
              <IconButton aria-label={t('Information about memory limit')}>
                <Icon
                  icon="mdi:information-outline"
                  width="16px"
                  height="16px"
                  aria-hidden="true"
                />
              </IconButton>
            </Tooltip>
          </Box>
          <TextField
            id="memory-limit-input"
            type="number"
            inputProps={{ step: 64, min: 1 }}
            value={containerConfig.config.memoryLimit?.replace(/Mi$/, '')}
            onChange={e =>
              setFromInput(e.target.value, 'Mi', val =>
                containerConfig.setConfig(c => ({ ...c, memoryLimit: val }))
              )
            }
            InputProps={{
              endAdornment: <InputAdornment position="end">{t('mebibytes')}</InputAdornment>,
            }}
            disabled={!containerConfig.config.enableResources}
            fullWidth
          />
        </Box>
      </Box>
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          onClick={() =>
            containerConfig.setConfig(c => ({ ...c, containerStep: CONTAINER_STEPS.HEALTHCHECKS }))
          }
        >
          {t('Back')}
        </Button>
        <Button
          variant="contained"
          onClick={() =>
            containerConfig.setConfig(c => ({ ...c, containerStep: CONTAINER_STEPS.ENV_VARS }))
          }
        >
          {t('Continue')}
        </Button>
      </Box>
    </>
  );
}
