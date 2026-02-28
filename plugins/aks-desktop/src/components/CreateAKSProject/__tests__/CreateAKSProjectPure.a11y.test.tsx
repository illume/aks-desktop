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
// rendered output (e.g. 'Your AKS project "{{projectName}}"...' → 'Your AKS
// project "my-project"...'). react-i18next falls back to the global i18next
// instance set by initReactI18next, so no I18nextProvider wrapper is needed.
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

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  PageGrid: ({ children }: any) => <div>{children}</div>,
  SectionBox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: any) => <span data-icon={icon} aria-hidden="true" />,
}));

// ── component under test ─────────────────────────────────────────────────────
import CreateAKSProjectPure, { CreateAKSProjectPureProps } from '../CreateAKSProjectPure';
import { STEPS } from '../types';

afterEach(() => cleanup());

const noOp = () => {};
const baseArgs: CreateAKSProjectPureProps = {
  activeStep: 0,
  steps: STEPS,
  handleNext: noOp,
  handleBack: noOp,
  handleStepClick: noOp,
  handleSubmit: async () => {},
  onBack: noOp,
  isCreating: false,
  creationProgress: '',
  creationError: null,
  showSuccessDialog: false,
  applicationName: '',
  setApplicationName: noOp as any,
  cliSuggestions: [],
  validation: { isValid: true },
  azureResourcesLoading: false,
  onNavigateToProject: noOp,
  stepContent: <div>Basics step content</div>,
  projectName: 'my-project',
  onDismissError: noOp,
  onCancelSuccess: noOp,
};

function renderInRouter(props: CreateAKSProjectPureProps) {
  return render(
    <MemoryRouter>
      <CreateAKSProjectPure {...props} />
    </MemoryRouter>
  );
}

// Component-level tests scan document.body so MUI Dialog portal content is
// included. The 'region' rule requires every element to be inside a landmark,
// which only makes sense for full-page tests, not isolated component tests.
const axeConfig = { rules: { region: { enabled: false } } };

describe('CreateAKSProjectPure a11y', () => {
  test('BasicsStepDefault has no violations', async () => {
    renderInRouter({ ...baseArgs });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });

  test('LoadingOverlay has no violations', async () => {
    renderInRouter({
      ...baseArgs,
      isCreating: true,
      creationProgress: 'Creating namespace...',
    });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });

  test('ErrorOverlay has no violations', async () => {
    renderInRouter({
      ...baseArgs,
      creationError: 'Error: Namespace creation failed: quota exceeded',
    });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });

  test('SuccessDialog has no violations', async () => {
    renderInRouter({
      ...baseArgs,
      showSuccessDialog: true,
      applicationName: '',
      projectName: 'my-project',
    });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });

  test('SuccessDialog with app name has no violations', async () => {
    renderInRouter({
      ...baseArgs,
      showSuccessDialog: true,
      applicationName: 'frontend-app',
      projectName: 'my-project',
    });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });

  test('NextButtonLoading has no violations', async () => {
    renderInRouter({
      ...baseArgs,
      azureResourcesLoading: true,
      validation: { isValid: false },
    });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });

  test('LongErrorMessage has no violations', async () => {
    renderInRouter({
      ...baseArgs,
      creationError:
        'Error: Namespace creation failed: ResourceQuotaExceeded — Exceeded quota: compute-resources, requested: limits.cpu=2, used: limits.cpu=14, limited: limits.cpu=14. Failed after 3 retries.\n\nAdditional context: The cluster autoscaler attempted to provision new nodes but all available node pools have reached their maximum size. Node pool "default" is at capacity (10/10 nodes). Node pool "high-memory" is at capacity (5/5 nodes).\n\nRecommended actions:\n  1. Increase the CPU quota for the compute-resources ResourceQuota.\n  2. Scale down existing workloads to free up CPU headroom.\n  3. Request a quota increase from your cluster administrator.',
    });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });

  test('ValidationError state has no violations', async () => {
    renderInRouter({
      ...baseArgs,
      validation: { isValid: false },
      azureResourcesLoading: false,
    });
    expect(await axe(document.body, axeConfig)).toHaveNoViolations();
  });
});
