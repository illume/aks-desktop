// @vitest-environment jsdom
// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

vi.mock('@kinvolk/headlamp-plugin/lib/ApiProxy', () => ({
  apply: vi.fn(),
}));

vi.mock('../utils/namespaceOverride', () => ({
  applyNamespaceOverride: (obj: any) => obj,
}));

vi.mock('../utils/yamlGenerator', () => ({
  generateYamlForContainer: () => 'generated-yaml',
}));

import { apply } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { useDeployWizard } from './useDeployWizard';

const mockApply = vi.mocked(apply);

describe('useDeployWizard', () => {
  it('has correct initial state', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    expect(result.current.activeStep).toBe(0);
    expect(result.current.sourceType).toBeNull();
    expect(result.current.deploying).toBe(false);
  });

  it('handleNext advances activeStep', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.handleNext();
    });
    expect(result.current.activeStep).toBe(1);
  });

  it('handleBack decrements activeStep', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.handleNext();
    });
    act(() => {
      result.current.handleBack();
    });
    expect(result.current.activeStep).toBe(0);
  });

  it('handleBack does not go below 0', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.handleBack();
    });
    expect(result.current.activeStep).toBe(0);
  });

  it('isStepValid(0) returns false when sourceType is null', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    expect(result.current.isStepValid(0)).toBe(false);
  });

  it('isStepValid(0) returns true when sourceType is set', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.setSourceType('yaml');
    });
    expect(result.current.isStepValid(0)).toBe(true);
  });

  it('isStepValid(1) returns false when yamlEditorValue is empty with sourceType=yaml', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.setSourceType('yaml');
    });
    expect(result.current.isStepValid(1)).toBe(false);
  });

  it('isStepValid(1) returns true when yamlEditorValue is non-empty with sourceType=yaml', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.setSourceType('yaml');
      result.current.setYamlEditorValue('apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: cm');
    });
    expect(result.current.isStepValid(1)).toBe(true);
  });

  it('handleDeploy success path sets deployResult to success', async () => {
    mockApply.mockResolvedValueOnce(undefined as any);
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.setSourceType('yaml');
      result.current.setYamlEditorValue(
        'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-cm\n  namespace: default'
      );
    });
    await act(async () => {
      await result.current.handleDeploy();
    });
    expect(result.current.deployResult).toBe('success');
    expect(result.current.deploying).toBe(false);
  });

  it('handleDeploy error path sets deployResult to error', async () => {
    mockApply.mockRejectedValueOnce(new Error('apply failed'));
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.setSourceType('yaml');
      result.current.setYamlEditorValue(
        'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-cm'
      );
    });
    await act(async () => {
      await result.current.handleDeploy();
    });
    expect(result.current.deployResult).toBe('error');
    expect(result.current.deployMessage).toBe('apply failed');
    expect(result.current.deploying).toBe(false);
  });

  it('handleDeploy sets deploying false after completion', async () => {
    mockApply.mockResolvedValueOnce(undefined as any);
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.setSourceType('yaml');
      result.current.setYamlEditorValue(
        'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-cm'
      );
    });
    await act(async () => {
      await result.current.handleDeploy();
    });
    expect(result.current.deploying).toBe(false);
  });

  it('handleStepClick navigates to a previous step', () => {
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.handleNext();
    });
    expect(result.current.activeStep).toBe(1);
    act(() => {
      result.current.handleStepClick(0);
    });
    expect(result.current.activeStep).toBe(0);
  });

  it('handleStepClick does not navigate while deploying is true', async () => {
    // Start a deploy that never resolves so we can inspect state mid-flight.
    mockApply.mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useDeployWizard({}));
    act(() => {
      result.current.setSourceType('yaml');
      result.current.setYamlEditorValue(
        'apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-cm'
      );
      result.current.handleNext();
      result.current.handleNext();
    });
    // Kick off the deploy (don't await — we want the in-flight state).
    act(() => {
      result.current.handleDeploy().catch(() => {});
    });
    // deploying should be true while in flight.
    expect(result.current.deploying).toBe(true);
    // Attempting to navigate back to step 0 must be a no-op.
    act(() => {
      result.current.handleStepClick(0);
    });
    expect(result.current.activeStep).toBe(2);
  });
});
