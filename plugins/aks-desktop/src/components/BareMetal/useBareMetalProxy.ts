// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type BareMetalProxyStatus,
  getBareMetalProxyStatus,
  restartBareMetalProxy,
  startBareMetalProxy,
  stopBareMetalProxy,
} from './proxy';

/** Parameters identifying a BareMetal cluster for proxy management. */
interface BareMetalProxyTarget {
  subscriptionId: string;
  resourceGroup: string;
  clusterName: string;
}

/** Return value of the {@link useBareMetalProxy} hook. */
export interface UseBareMetalProxyResult {
  /** Latest proxy status snapshot, or `null` when no BareMetal cluster is selected. */
  proxyStatus: BareMetalProxyStatus | null;
  /** Whether a proxy action (start/stop/restart) is currently in flight. */
  proxyActionLoading: boolean;
  /** User-visible error from the most recent proxy operation. */
  proxyUiError: string;
  /** Refreshes proxy status by querying the backend. */
  refreshProxyStatus: () => Promise<void>;
  /** Starts the BareMetal proxy for the current cluster. */
  handleProxyStart: () => void;
  /** Stops the BareMetal proxy for the current cluster. */
  handleProxyStop: () => void;
  /** Restarts the BareMetal proxy for the current cluster. */
  handleProxyRestart: () => void;
  /** Resets all proxy state (e.g. when the selected cluster changes). */
  resetProxyState: () => void;
}

/**
 * Manages the lifecycle and polling of an `az connectedk8s proxy` session
 * for BareMetal-connected clusters.
 *
 * @param open - Whether the parent dialog is open.
 * @param target - The BareMetal cluster to manage, or `null` when no BareMetal cluster is selected.
 * @param pollIntervalMs - How often to poll status (default 5000 ms).
 */
export function useBareMetalProxy(
  open: boolean,
  target: BareMetalProxyTarget | null,
  pollIntervalMs = 5000
): UseBareMetalProxyResult {
  const { t } = useTranslation();
  const [proxyStatus, setProxyStatus] = useState<BareMetalProxyStatus | null>(null);
  const [proxyActionLoading, setProxyActionLoading] = useState(false);
  const [proxyUiError, setProxyUiError] = useState('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshProxyStatus = useCallback(async () => {
    if (!target) {
      return;
    }

    try {
      const status = await getBareMetalProxyStatus(
        target.subscriptionId,
        target.resourceGroup,
        target.clusterName
      );
      if (isMountedRef.current) {
        setProxyStatus(status);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setProxyUiError(
          t('Failed to fetch proxy status: {{message}}', {
            message: err instanceof Error ? err.message : t('Unknown error'),
          })
        );
      }
    }
  }, [target, t]);

  const runProxyAction = useCallback(
    async (
      action: (
        subscriptionId: string,
        resourceGroup: string,
        clusterName: string
      ) => Promise<BareMetalProxyStatus>
    ) => {
      if (!target) {
        return;
      }

      setProxyActionLoading(true);
      setProxyUiError('');
      try {
        const result = await action(
          target.subscriptionId,
          target.resourceGroup,
          target.clusterName
        );
        if (isMountedRef.current) {
          setProxyStatus(result);
          if (!result.success && result.lastError) {
            setProxyUiError(result.lastError);
          }
        }
        await refreshProxyStatus();
      } catch (err) {
        if (isMountedRef.current) {
          setProxyUiError(
            t('Failed to manage BareMetal proxy: {{message}}', {
              message: err instanceof Error ? err.message : t('Unknown error'),
            })
          );
        }
      } finally {
        if (isMountedRef.current) {
          setProxyActionLoading(false);
        }
      }
    },
    [target, refreshProxyStatus, t]
  );

  // Poll proxy status while dialog is open and a BareMetal cluster is targeted.
  useEffect(() => {
    if (!open || !target) {
      setProxyStatus(null);
      setProxyUiError('');
      return;
    }

    refreshProxyStatus();
    const id = window.setInterval(() => {
      refreshProxyStatus();
    }, pollIntervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [open, target, refreshProxyStatus, pollIntervalMs]);

  const handleProxyStart = useCallback(() => {
    runProxyAction(startBareMetalProxy);
  }, [runProxyAction]);

  const handleProxyStop = useCallback(() => {
    runProxyAction(stopBareMetalProxy);
  }, [runProxyAction]);

  const handleProxyRestart = useCallback(() => {
    runProxyAction(restartBareMetalProxy);
  }, [runProxyAction]);

  const resetProxyState = useCallback(() => {
    setProxyStatus(null);
    setProxyUiError('');
  }, []);

  return {
    proxyStatus,
    proxyActionLoading,
    proxyUiError,
    refreshProxyStatus,
    handleProxyStart,
    handleProxyStop,
    handleProxyRestart,
    resetProxyState,
  };
}
