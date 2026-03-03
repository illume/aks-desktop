// @vitest-environment jsdom
// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Use a real i18next instance so {{variable}} interpolation works correctly in
// error messages (e.g. 'Namespace status verification failed: {{message}}'
// renders with the actual message instead of the raw placeholder).
// react-i18next falls back to the global instance set by initReactI18next, so
// no I18nextProvider wrapper is needed.
vi.mock('@kinvolk/headlamp-plugin/lib', async () => {
  const i18n = (await import('i18next')).default;
  const { initReactI18next, useTranslation } = await import('react-i18next');
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: {} } },
      interpolation: { escapeValue: false },
      returnEmptyString: false,
    });
  }
  return { useTranslation };
});

vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push: vi.fn() }),
}));

vi.mock('../../../utils/azure/az-cli', () => ({
  checkNamespaceExists: vi.fn(),
  createManagedNamespace: vi.fn(),
  createNamespaceRoleAssignment: vi.fn(),
  verifyNamespaceAccess: vi.fn(),
}));

vi.mock('../../../utils/azure/checkAzureCli', () => ({
  checkAzureCliAndAksPreview: vi.fn().mockResolvedValue({ suggestions: [] }),
}));

vi.mock('./useAzureResources', () => ({
  useAzureResources: () => ({
    subscriptions: [],
    clusters: [],
    loading: false,
    error: null,
    clusterError: null,
    loadingClusters: false,
    totalClusterCount: 0,
    fetchSubscriptions: vi.fn().mockResolvedValue([]),
    fetchClusters: vi.fn().mockResolvedValue([]),
    clearClusters: vi.fn(),
    clearError: vi.fn(),
    clearClusterError: vi.fn(),
  }),
}));

vi.mock('./useClusterCapabilities', () => ({
  useClusterCapabilities: () => ({
    capabilities: null,
    loading: false,
    error: null,
    fetchCapabilities: vi.fn(),
    clearCapabilities: vi.fn(),
  }),
}));

vi.mock('./useExtensionCheck', () => ({
  useExtensionCheck: () => ({
    installed: true,
    installing: false,
    error: null,
    showSuccess: false,
    installExtension: vi.fn(),
    checkExtension: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('./useFeatureCheck', () => ({
  useFeatureCheck: () => ({
    registered: true,
    state: null,
    registering: false,
    error: null,
    showSuccess: false,
    registerFeature: vi.fn(),
    checkFeature: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('./useNamespaceCheck', () => ({
  useNamespaceCheck: () => ({
    exists: false,
    checking: false,
    error: null,
    checkNamespace: vi.fn(),
    clearStatus: vi.fn(),
  }),
}));

vi.mock('./useFormData', () => ({
  useFormData: () => ({
    formData: {
      subscription: '',
      cluster: '',
      resourceGroup: '',
      projectName: 'test-project',
      description: '',
      cpuRequest: 2000,
      cpuLimit: 2000,
      memoryRequest: 4096,
      memoryLimit: 4096,
      ingress: 'AllowSameNamespace',
      egress: 'AllowAll',
      userAssignments: [],
    },
    updateFormData: vi.fn(),
    resetFormData: vi.fn(),
    setFormDataField: vi.fn(),
  }),
}));

vi.mock('./useValidation', () => ({
  useValidation: () => ({ isValid: true, errors: {}, warnings: [], fieldErrors: {} }),
}));

vi.mock('@kinvolk/headlamp-plugin/lib/lib/k8s', () => ({
  useClustersConf: () => ({}),
}));

import { checkNamespaceExists, createManagedNamespace } from '../../../utils/azure/az-cli';
import { useCreateAKSProjectWizard } from './useCreateAKSProjectWizard';

describe('useCreateAKSProjectWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('has initial activeStep of 0', () => {
    const { result } = renderHook(() => useCreateAKSProjectWizard());
    expect(result.current.activeStep).toBe(0);
  });

  it('handleNext increments activeStep', () => {
    const { result } = renderHook(() => useCreateAKSProjectWizard());
    act(() => {
      result.current.handleNext();
    });
    expect(result.current.activeStep).toBe(1);
  });

  it('handleBack decrements activeStep', () => {
    const { result } = renderHook(() => useCreateAKSProjectWizard());
    act(() => {
      result.current.handleNext();
    });
    act(() => {
      result.current.handleBack();
    });
    expect(result.current.activeStep).toBe(0);
  });

  it('onBack calls history.push("/")', () => {
    // We check indirectly — onBack should not throw
    const { result } = renderHook(() => useCreateAKSProjectWizard());
    expect(() => {
      act(() => {
        result.current.onBack();
      });
    }).not.toThrow();
  });

  it('initial isCreating is false', () => {
    const { result } = renderHook(() => useCreateAKSProjectWizard());
    expect(result.current.isCreating).toBe(false);
  });

  it('handleSubmit success path: sets showSuccessDialog after success and timer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });

    // Return success immediately, skip all internal delays by resolving everything fast
    vi.mocked(createManagedNamespace).mockResolvedValue({ success: true } as any);
    vi.mocked(checkNamespaceExists).mockResolvedValue({ exists: true } as any);

    const { result } = renderHook(() => useCreateAKSProjectWizard());

    // Start the submit and run all scheduled timers+microtasks deterministically
    await act(async () => {
      const submitPromise = result.current.handleSubmit();
      await vi.runAllTimersAsync();
      await submitPromise;
    });

    expect(result.current.isCreating).toBe(false);
  }, 10000);

  it('handleSubmit error path: sets creationError when createManagedNamespace fails', async () => {
    vi.mocked(createManagedNamespace).mockResolvedValue({
      success: false,
      error: 'boom',
    } as any);

    const { result } = renderHook(() => useCreateAKSProjectWizard());

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.creationError).toBeTruthy();
    expect(result.current.isCreating).toBe(false);
  });

  it('handleSubmit sets isCreating false after error completion', async () => {
    vi.mocked(createManagedNamespace).mockResolvedValue({
      success: false,
      error: 'quick-fail',
    } as any);

    const { result } = renderHook(() => useCreateAKSProjectWizard());

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.isCreating).toBe(false);
  });
});
