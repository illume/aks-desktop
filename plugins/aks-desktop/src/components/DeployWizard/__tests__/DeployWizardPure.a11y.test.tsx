// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, test, vi } from 'vitest';

expect.extend(toHaveNoViolations);

// ── module mocks ─────────────────────────────────────────────────────────────
// Use a real i18next instance so {{variable}} interpolation works correctly in
// rendered output. react-i18next falls back to the global i18next instance set
// by initReactI18next, so no I18nextProvider wrapper is needed.
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

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: any) => <span data-icon={icon} aria-hidden="true" />,
}));

// ── component under test ─────────────────────────────────────────────────────
import DeployWizardPure, { DeployWizardPureProps } from '../DeployWizardPure';

afterEach(() => cleanup());

const noOp = () => {};
const containerConfigStub = {
  config: {
    containerStep: 0,
    appName: '',
    containerImage: '',
    replicas: 1,
    targetPort: 80,
    servicePort: 80,
    useCustomServicePort: false,
    serviceType: 'ClusterIP' as const,
    enableResources: true,
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: '128Mi',
    memoryLimit: '512Mi',
    envVars: [{ key: '', value: '' }],
    enableLivenessProbe: true,
    enableReadinessProbe: true,
    enableStartupProbe: true,
    showProbeConfigs: false,
    livenessPath: '/',
    readinessPath: '/',
    startupPath: '/',
    livenessInitialDelay: 10,
    livenessPeriod: 10,
    livenessTimeout: 1,
    livenessFailure: 3,
    livenessSuccess: 1,
    readinessInitialDelay: 5,
    readinessPeriod: 10,
    readinessTimeout: 1,
    readinessFailure: 3,
    readinessSuccess: 1,
    startupInitialDelay: 0,
    startupPeriod: 10,
    startupTimeout: 1,
    startupFailure: 30,
    startupSuccess: 1,
    enableHpa: false,
    hpaMinReplicas: 1,
    hpaMaxReplicas: 5,
    hpaTargetCpu: 70,
    runAsNonRoot: false,
    readOnlyRootFilesystem: false,
    allowPrivilegeEscalation: false,
    enablePodAntiAffinity: true,
    enableTopologySpreadConstraints: true,
    containerPreviewYaml: '',
  },
  setConfig: noOp as any,
};

const baseArgs: DeployWizardPureProps = {
  activeStep: 0,
  sourceType: null,
  setSourceType: noOp as any,
  yamlEditorValue: '',
  setYamlEditorValue: noOp as any,
  yamlError: null,
  setYamlError: noOp as any,
  deploying: false,
  deployResult: null,
  deployMessage: '',
  userPreviewYaml: '',
  containerConfig: containerConfigStub as any,
  namespace: 'default',
  handleNext: noOp,
  handleBack: noOp,
  handleStepClick: noOp,
  handleDeploy: async () => {},
  isStepValid: () => true,
  onClose: noOp,
  stepContent: <div>Step content</div>,
};

function renderInRouter(props: DeployWizardPureProps) {
  return render(
    <MemoryRouter>
      <DeployWizardPure {...props} />
    </MemoryRouter>
  );
}

describe('DeployWizardPure a11y', () => {
  test('SourceStep has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      activeStep: 0,
      stepContent: <div>Source step content</div>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('SourceStep YAML selected has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      activeStep: 0,
      sourceType: 'yaml',
      stepContent: <div>Source step — YAML selected</div>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Deploy step success has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      activeStep: 2,
      sourceType: 'yaml',
      deployResult: 'success',
      deployMessage: 'Applied 1 resource successfully.',
      stepContent: <div>Deploy step content</div>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Deploy step error has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      activeStep: 2,
      sourceType: 'yaml',
      deployResult: 'error',
      deployMessage: 'ImagePullBackOff',
      stepContent: <div>Deploy step content</div>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Deploy step deploying has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      activeStep: 2,
      sourceType: 'yaml',
      deploying: true,
      deployResult: null,
      stepContent: <div>Deploy step content</div>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Next button disabled has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      activeStep: 0,
      isStepValid: () => false,
      stepContent: <div>Source step — no source selected</div>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Deploy step deploying with container source has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      activeStep: 2,
      sourceType: 'container',
      deploying: true,
      deployResult: null,
      stepContent: <div>Deploy step content — container</div>,
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
