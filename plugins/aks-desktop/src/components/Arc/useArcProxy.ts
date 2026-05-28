// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useTranslation } from '@kinvolk/headlamp-plugin/lib';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type ArcProxyStatus,
  getArcProxyStatus,
  restartArcProxy,
  startArcProxy,
  stopArcProxy,
} from './proxy';

/** Parameters identifying an Arc cluster for proxy management. */
interface ArcProxyTarget {
  subscriptionId: string;
  resourceGroup: string;
  clusterName: string;
}

/** Return value of the {@link useArcProxy} hook. */
export interface UseArcProxyResult {
  /** Latest proxy status snapshot, or `null` when no Arc cluster is selected. */
  proxyStatus: ArcProxyStatus | null;
  /** Whether a proxy action (start/stop/restart) is currently in flight. */
  proxyActionLoading: boolean;
  /** User-visible error from the most recent proxy operation. */
  proxyUiError: string;
  /** Refreshes proxy status by querying the backend. */
  refreshProxyStatus: () => Promise<void>;
  /** Starts the Arc proxy for the current cluster. */
  handleProxyStart: () => void;
  /** Stops the Arc proxy for the current cluster. */
  handleProxyStop: () => void;
  /** Restarts the Arc proxy for the current cluster. */
  handleProxyRestart: () => void;
  /** Resets all proxy state (e.g. when the selected cluster changes). */
  resetProxyState: () => void;
}

/**
 * Manages the lifecycle and polling of an `az connectedk8s proxy` session
 * for Arc-connected clusters.
 *
 * @param open - Whether the parent dialog is open.
 * @param target - The Arc cluster to manage, or `null` when no Arc cluster is selected.
 * @param pollIntervalMs - How often to poll status (default 5000 ms).
 */
export function useArcProxy(
  open: boolean,
  target: ArcProxyTarget | null,
  pollIntervalMs = 5000
): UseArcProxyResult {
  const { t } = useTranslation();
  const [proxyStatus, setProxyStatus] = useState<ArcProxyStatus | null>(null);
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
      const status = await getArcProxyStatus(
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
      ) => Promise<ArcProxyStatus>
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
            t('Failed to manage Arc proxy: {{message}}', {
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

  // Poll proxy status while dialog is open and an Arc cluster is targeted.
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
    runProxyAction(startArcProxy);
  }, [runProxyAction]);

  const handleProxyStop = useCallback(() => {
    runProxyAction(stopArcProxy);
  }, [runProxyAction]);

  const handleProxyRestart = useCallback(() => {
    runProxyAction(restartArcProxy);
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
