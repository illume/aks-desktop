// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  installExtension as installAzExtension,
  isExtensionInstalled,
} from '../../utils/azure/az-extensions';

/** Status of required Arc CLI extensions (connectedk8s and aksarc). */
export interface ArcExtensionStatus {
  /** `null` while checking, `true` when both extensions are installed, `false` otherwise. */
  installed: boolean | null;
  /** Whether installation is currently in progress. */
  installing: boolean;
  /** Error message from the last check or install attempt. */
  error: string | null;
  /** Temporarily set to `true` after a successful install. */
  showSuccess: boolean;
}

const REQUIRED_EXTENSIONS = ['connectedk8s', 'aksarc'] as const;

/**
 * Hook for checking and installing the Azure CLI extensions required for
 * AKS Arc cluster management (`connectedk8s` and `aksarc`).
 *
 * Follows the same pattern as {@link useExtensionCheck} from CreateAKSProject.
 */
export function useArcExtensionCheck() {
  const [status, setStatus] = useState<ArcExtensionStatus>({
    installed: null,
    installing: false,
    error: null,
    showSuccess: false,
  });
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  const checkExtensions = useCallback(async () => {
    try {
      for (const ext of REQUIRED_EXTENSIONS) {
        const result = await isExtensionInstalled(ext);
        if (!result.installed) {
          setStatus(prev => ({
            ...prev,
            installed: false,
            error: result.error || null,
          }));
          return;
        }
      }
      setStatus(prev => ({ ...prev, installed: true, error: null }));
    } catch (error) {
      console.error('Failed to check Arc extensions:', error);
      setStatus(prev => ({
        ...prev,
        installed: false,
        error: 'Failed to check extension status',
      }));
    }
  }, []);

  const installExtensions = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, installing: true, error: null }));

      for (const ext of REQUIRED_EXTENSIONS) {
        const check = await isExtensionInstalled(ext);
        if (check.installed) {
          continue;
        }

        const result = await installAzExtension(ext);
        if (!result.success) {
          setStatus(prev => ({
            ...prev,
            error: result.error || `Failed to install ${ext} extension`,
          }));
          return;
        }
      }

      setStatus(prev => ({
        ...prev,
        installed: true,
        error: null,
        showSuccess: true,
      }));

      successTimeoutRef.current = setTimeout(() => {
        setStatus(prev => ({ ...prev, showSuccess: false }));
      }, 3000);
    } catch (error) {
      console.error('Failed to install Arc extensions:', error);
      setStatus(prev => ({
        ...prev,
        error: 'Failed to install extensions',
      }));
    } finally {
      setStatus(prev => ({ ...prev, installing: false }));
    }
  }, []);

  const clearError = useCallback(() => {
    setStatus(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...status,
    checkExtensions,
    installExtensions,
    clearError,
  };
}
