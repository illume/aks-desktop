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

// Monaco editor is heavyweight and not needed for a11y structure checks.
// role="region" is required so that aria-label is permitted on a div.
vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor" role="region" aria-label="YAML editor" />,
}));

// ── component under test ─────────────────────────────────────────────────────
import DeployPure, { DeployPureProps } from '../DeployPure';

afterEach(() => cleanup());

const sampleYamlObjects = [
  { kind: 'Deployment', name: 'my-app', namespace: 'default' },
  { kind: 'Service', name: 'my-app-svc', namespace: 'default' },
];

const baseArgs: DeployPureProps = {
  sourceType: 'yaml',
  namespace: 'default',
  containerPreviewYaml: '',
  deployResult: null,
  deployMessage: '',
  yamlObjects: sampleYamlObjects,
};

function renderInRouter(props: DeployPureProps) {
  return render(
    <MemoryRouter>
      <DeployPure {...props} />
    </MemoryRouter>
  );
}

describe('DeployPure a11y', () => {
  test('Idle state has no violations', async () => {
    const { container } = renderInRouter({ ...baseArgs });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Deploy success has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      deployResult: 'success',
      deployMessage: 'Applied 2 resources successfully.',
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Deploy error has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      deployResult: 'error',
      deployMessage: 'Failed to apply resources: ImagePullBackOff on container my-app.',
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('YAML with multiple objects has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      yamlObjects: [
        { kind: 'Deployment', name: 'api-server', namespace: 'production' },
        { kind: 'Service', name: 'api-server-svc' },
        { kind: 'Ingress', name: 'api-ingress', namespace: 'production' },
      ],
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Container source type has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      sourceType: 'container',
      containerPreviewYaml: 'apiVersion: apps/v1\nkind: Deployment\n',
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Empty resource list has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      yamlObjects: [],
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Single resource has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      yamlObjects: [{ kind: 'Deployment', name: 'web-frontend', namespace: 'production' }],
    });
    expect(await axe(container)).toHaveNoViolations();
  });

  test('Deploy error with long message has no violations', async () => {
    const { container } = renderInRouter({
      ...baseArgs,
      deployResult: 'error',
      deployMessage:
        'Failed to apply resources: connection refused to api-server.production.svc.cluster.local:443 (error: ECONNREFUSED). Retried 5 times over 30 seconds. Last attempt at 2024-01-15T10:23:45Z. Check that the API server is reachable and that your kubeconfig credentials are valid. If the issue persists, contact your cluster administrator.',
    });
    expect(await axe(container)).toHaveNoViolations();
  });
});
