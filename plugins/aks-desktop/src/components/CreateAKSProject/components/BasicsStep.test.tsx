// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

// @vitest-environment jsdom
/**
 * Interaction tests for the Project Name "Edit" button in {@link BasicsStep}.
 *
 * Focuses on:
 *   - The button renders and has a correct accessible name.
 *   - Clicking the button moves keyboard focus to the Project Name input (primary function).
 *   - The icon inside the button is hidden from assistive technology (aria-hidden).
 *   - A Tooltip is present on the button (visual discoverability for sighted users).
 */
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (must come before component imports) ──────────────────────────────

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

vi.mock('@kinvolk/headlamp-plugin/lib/lib/k8s', () => ({
  useClustersConf: () => ({}),
}));

// Pass all props through so the test can assert that the component explicitly
// sets aria-hidden="true" on the icon (rather than the mock always setting it).
vi.mock('@iconify/react', () => ({
  Icon: ({ icon, ...props }: any) => <span data-icon={icon} {...props} />,
}));

vi.mock('../../../hooks/useAzureAuth', () => ({
  useAzureAuth: () => ({ isLoggedIn: true, isChecking: false, subscriptionId: undefined }),
}));

vi.mock('../../../utils/azure/aks', () => ({
  registerAKSCluster: vi.fn(),
}));

vi.mock('../../../utils/azure/az-cli', () => ({
  getLoginStatus: vi.fn(),
  checkAzureCliAndAksPreview: vi.fn(),
  getClusterCapabilities: vi.fn(),
  enableClusterAddon: vi.fn(),
}));

// ── Component under test ─────────────────────────────────────────────────────

import type { BasicsStepProps } from '../types';
import { BasicsStep } from './BasicsStep';

// ── Helpers ──────────────────────────────────────────────────────────────────

const defaultProps: BasicsStepProps = {
  formData: {
    projectName: 'my-project',
    description: '',
    subscription: 'sub-1',
    cluster: 'cluster-1',
    resourceGroup: 'rg-1',
    ingress: 'AllowSameNamespace',
    egress: 'AllowSameNamespace',
    cpuRequest: 1,
    memoryRequest: 1,
    cpuLimit: 2,
    memoryLimit: 2,
    userAssignments: [],
  },
  onFormDataChange: vi.fn(),
  validation: { isValid: true, errors: [], warnings: [] },
  loading: false,
  error: null,
  subscriptions: [
    { id: 'sub-1', name: 'Subscription 1', tenant: 't1', tenantName: 'Tenant 1', status: 'Enabled' },
  ],
  clusters: [
    {
      name: 'cluster-1',
      location: 'eastus',
      version: '1.28',
      nodeCount: 3,
      status: 'Running',
      resourceGroup: 'rg-1',
    },
  ],
  totalClusterCount: 1,
  loadingClusters: false,
  clusterError: null,
  extensionStatus: { installed: true, installing: false, error: null, showSuccess: false },
  featureStatus: {
    registered: true,
    state: 'Registered',
    registering: false,
    error: null,
    showSuccess: false,
  },
  namespaceStatus: { exists: null, checking: false, error: null },
  clusterCapabilities: null,
  capabilitiesLoading: false,
  onInstallExtension: vi.fn(),
  onRegisterFeature: vi.fn(),
  onRetrySubscriptions: vi.fn(),
  onRetryClusters: vi.fn(),
};

afterEach(() => cleanup());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BasicsStep — Project Name Edit button', () => {
  it('renders an accessible Edit button on the Project Name field', () => {
    render(<BasicsStep {...defaultProps} />);
    expect(screen.getByRole('button', { name: /edit project name/i })).toBeInTheDocument();
  });

  it('Edit button has aria-label set', () => {
    render(<BasicsStep {...defaultProps} />);
    const editBtn = screen.getByRole('button', { name: /edit project name/i });
    expect(editBtn).toHaveAttribute('aria-label', 'Edit project name');
  });

  it('clicking the Edit button moves focus to the Project Name input', () => {
    render(<BasicsStep {...defaultProps} />);
    const editBtn = screen.getByRole('button', { name: /edit project name/i });
    const input = screen.getByRole('textbox', { name: /project name/i });

    fireEvent.click(editBtn);

    expect(document.activeElement).toBe(input);
  });

  it('the icon inside the Edit button is hidden from assistive technology', () => {
    render(<BasicsStep {...defaultProps} />);
    const editBtn = screen.getByRole('button', { name: /edit project name/i });
    const icon = editBtn.querySelector('[data-icon="mdi:edit"]');

    expect(icon).toBeInTheDocument();
    // aria-hidden="true" must be set explicitly on the icon so screen readers do not
    // double-announce it alongside the button's aria-label.
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('the Edit button has a Tooltip for sighted-user discoverability', async () => {
    // MUI Tooltip has an enterDelay (default 100ms) before showing its content.
    // Use fake timers so we can advance past that delay synchronously.
    vi.useFakeTimers();
    try {
      render(<BasicsStep {...defaultProps} />);
      const editBtn = screen.getByRole('button', { name: /edit project name/i });

      // MUI Tooltip listens on mouseover; this starts the enterDelay timer.
      fireEvent.mouseOver(editBtn);

      // Advance past MUI Tooltip's default enterDelay (100ms) and flush React state.
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      // The tooltip content should now be rendered in the document.
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
