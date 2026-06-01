// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { Icon } from '@iconify/react';
import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import type { AKSCluster, Subscription } from '../../utils/azure/aks';
import { getAKSClusters, getSubscriptions } from '../../utils/azure/aks';
import BareMetalProxyPanel from './BareMetalProxyPanel';
import { useBareMetalProxy } from './useBareMetalProxy';

export default function BareMetalProxySettingsPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingClusters, setLoadingClusters] = useState(false);
  const [error, setError] = useState('');
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [clusters, setClusters] = useState<AKSCluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<AKSCluster | null>(null);
  const isMountedRef = useRef(true);

  const bareMetalProxyTarget = useMemo(() => {
    if (!selectedSubscription || !selectedCluster) {
      return null;
    }
    return {
      subscriptionId: selectedSubscription.id,
      resourceGroup: selectedCluster.resourceGroup,
      clusterName: selectedCluster.name,
    };
  }, [selectedSubscription, selectedCluster]);

  const {
    proxyStatus,
    proxyActionLoading,
    proxyUiError,
    proxyDropped,
    refreshProxyStatus,
    handleProxyStart,
    handleProxyStop,
    handleProxyRestart,
    dismissProxyDropped,
    resetProxyState,
  } = useBareMetalProxy(true, bareMetalProxyTarget);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const loadSubscriptions = async () => {
      setLoadingSubscriptions(true);
      setError('');
      try {
        const result = await getSubscriptions();
        if (!isMountedRef.current) {
          return;
        }
        if (!result.success) {
          setError(result.message);
          return;
        }
        const list = result.subscriptions || [];
        setSubscriptions(list);
        if (list.length > 0) {
          setSelectedSubscription(list[0]);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            t('Failed to load subscriptions: {{message}}', {
              message: err instanceof Error ? err.message : t('Unknown error'),
            })
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingSubscriptions(false);
        }
      }
    };

    loadSubscriptions();
  }, [t]);

  useEffect(() => {
    const loadClusters = async () => {
      if (!selectedSubscription) {
        return;
      }
      setLoadingClusters(true);
      setError('');
      setSelectedCluster(null);
      setClusters([]);
      resetProxyState();

      try {
        const result = await getAKSClusters(selectedSubscription.id);
        if (!isMountedRef.current) {
          return;
        }
        if (!result.success) {
          setError(result.message);
          return;
        }
        const bareMetalClusters = (result.clusters || []).filter(
          cluster => (cluster.clusterType || 'aks') === 'aksarc'
        );
        setClusters(bareMetalClusters);
        if (bareMetalClusters.length > 0) {
          setSelectedCluster(bareMetalClusters[0]);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(
            t('Failed to load clusters: {{message}}', {
              message: err instanceof Error ? err.message : t('Unknown error'),
            })
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingClusters(false);
        }
      }
    };

    loadClusters();
  }, [selectedSubscription, resetProxyState, t]);

  const handleOpenRegisterControls = () => {
    const params = new URLSearchParams({ focus: 'baremetal-proxy' });
    if (selectedSubscription) {
      params.set('subscription', selectedSubscription.id);
    }
    if (selectedCluster) {
      params.set('cluster', selectedCluster.name);
      params.set('resourceGroup', selectedCluster.resourceGroup);
    }
    history.push(`/add-cluster-aks?${params.toString()}`);
  };

  return (
    <Box component="main" sx={{ minHeight: '100vh', backgroundColor: 'background.default', pt: 2 }}>
      <Container maxWidth="md">
        <Button
          variant="text"
          onClick={() => history.push('/azure/profile')}
          startIcon={<Icon icon="mdi:chevron-left" height={20} width={20} aria-hidden="true" />}
          sx={{ mb: 3, color: 'text.secondary', textTransform: 'uppercase', fontSize: 14 }}
        >
          {t('Back')}
        </Button>

        <Card sx={{ p: 3 }}>
          <Typography variant="h5" component="h1" sx={{ mb: 2 }}>
            {t('BareMetal Proxy')}
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {proxyUiError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {proxyUiError}
            </Alert>
          )}

          {proxyDropped && selectedCluster && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              onClose={dismissProxyDropped}
              action={
                <Box display="flex" gap={1}>
                  <Button color="inherit" size="small" onClick={handleProxyRestart}>
                    {t('Restart Proxy')}
                  </Button>
                  <Button color="inherit" size="small" onClick={handleOpenRegisterControls}>
                    {t('Open Proxy Controls')}
                  </Button>
                </Box>
              }
            >
              {t('BareMetal proxy disconnected')}
            </Alert>
          )}

          <Box display="flex" flexDirection="column" gap={2}>
            <Autocomplete
              options={subscriptions}
              value={selectedSubscription}
              onChange={(_e, value) => setSelectedSubscription(value)}
              getOptionLabel={option => option.name}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              loading={loadingSubscriptions}
              renderInput={params => (
                <TextField
                  {...params}
                  label={t('Subscription')}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingSubscriptions ? (
                          <CircularProgress color="inherit" size={20} aria-hidden="true" />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Autocomplete
              options={clusters}
              value={selectedCluster}
              onChange={(_e, value) => setSelectedCluster(value)}
              getOptionLabel={option => option.name}
              isOptionEqualToValue={(option, value) =>
                option.name === value.name && option.resourceGroup === value.resourceGroup
              }
              loading={loadingClusters}
              disabled={!selectedSubscription}
              renderInput={params => (
                <TextField
                  {...params}
                  label={t('BareMetal cluster')}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingClusters ? (
                          <CircularProgress color="inherit" size={20} aria-hidden="true" />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            {!loadingClusters && selectedSubscription && clusters.length === 0 && (
              <Alert severity="info">
                {t('No BareMetal clusters found in this subscription.')}
              </Alert>
            )}

            {selectedCluster && (
              <BareMetalProxyPanel
                panelId="baremetal-proxy-controls"
                proxyStatus={proxyStatus}
                proxyActionLoading={proxyActionLoading}
                disabled={false}
                onProxyStart={handleProxyStart}
                onProxyStop={handleProxyStop}
                onProxyRestart={handleProxyRestart}
                onProxyRefresh={refreshProxyStatus}
              />
            )}
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
