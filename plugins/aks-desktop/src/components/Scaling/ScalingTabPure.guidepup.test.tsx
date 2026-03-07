// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

// @vitest-environment jsdom
import { virtual } from '@guidepup/virtual-screen-reader';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, 'aria-hidden': ariaHidden }: { icon: string; 'aria-hidden'?: string | boolean }) =>
    ariaHidden ? null : <span>{icon}</span>,
}));

// Mock ScalingChart to avoid recharts SVG aria attributes that cause guidepup
// to fail with "Cannot read properties of undefined (reading 'escape')".
// Mock DeploymentSelector to avoid MUI Select's aria-controls referencing a
// non-existent listbox DOM element, which also causes the same guidepup error.
// The guidepup tests focus on the tab-level structure (heading, selector, buttons,
// metrics, error alerts) rather than chart internals.
vi.mock('./components/ScalingChart', () => ({
  ScalingChart: () => <div data-testid="scaling-chart" />,
}));

// Use a native <select> element rather than role="combobox" so the mock is
// accessible without needing extra ARIA attributes (aria-controls, aria-expanded).
// Native <select> already has implicit combobox semantics understood by all browsers
// and screen readers: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/select
vi.mock('./components/DeploymentSelector', () => ({
  DeploymentSelector: ({ selectedDeployment }: { selectedDeployment: string }) => (
    <label>
      Select Deployment
      <select value={selectedDeployment} onChange={() => {}}>
        <option value={selectedDeployment}>{selectedDeployment}</option>
      </select>
    </label>
  ),
}));

import type { EditValues } from './hooks/useEditDialog';
import { ScalingTabPure } from './ScalingTabPure';

const sampleDeployments = [
  { name: 'frontend', namespace: 'default', replicas: 3, availableReplicas: 3, readyReplicas: 3 },
  { name: 'backend', namespace: 'default', replicas: 2, availableReplicas: 2, readyReplicas: 2 },
];

const hpaInfo = {
  name: 'frontend-hpa',
  namespace: 'default',
  minReplicas: 2,
  maxReplicas: 10,
  targetCPUUtilization: 60,
  currentCPUUtilization: 45,
  currentReplicas: 3,
  desiredReplicas: 3,
};

const defaultEditValues: EditValues = {
  minReplicas: 2,
  maxReplicas: 10,
  targetCPU: 60,
  replicas: 3,
};

const sampleChartData = [
  { time: 'Mon, 09:00', Replicas: 2, CPU: 35 },
  { time: 'Mon, 10:00', Replicas: 3, CPU: 55 },
];

/** Walk the virtual screen reader until "end of document", returning all spoken phrases. */
async function collectPhrases(maxSteps = 50): Promise<string[]> {
  const phrases: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const phrase = await virtual.lastSpokenPhrase();
    phrases.push(phrase);
    if (phrase === 'end of document') break;
    await virtual.next();
  }
  return phrases;
}

afterEach(async () => {
  await virtual.stop();
  cleanup();
});

describe('ScalingTabPure guidepup screen reader', () => {
  /**
   * Tests that the "Scaling" page heading is reachable when a deployment is active,
   * confirming screen reader users can identify the page section.
   */
  test('announces the Scaling heading', async () => {
    const { container } = render(
      <ScalingTabPure
        deployments={sampleDeployments}
        selectedDeployment="frontend"
        loading={false}
        error={null}
        hpaInfo={hpaInfo}
        chartData={sampleChartData}
        chartLoading={false}
        chartError={null}
        editDialogOpen={false}
        editValues={defaultEditValues}
        saving={false}
        saveError={null}
        onDeploymentChange={() => {}}
        onEditClick={() => {}}
        onEditDialogClose={() => {}}
        onEditValuesChange={() => {}}
        onSave={async () => {}}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Scaling'))).toBe(true);
  });

  /**
   * Tests that the "Select a deployment to view scaling metrics" prompt is
   * announced when no deployment is selected, guiding the user to act.
   */
  test('announces prompt when no deployment is selected', async () => {
    const { container } = render(
      <ScalingTabPure
        deployments={sampleDeployments}
        selectedDeployment=""
        loading={false}
        error={null}
        hpaInfo={null}
        chartData={[]}
        chartLoading={false}
        chartError={null}
        editDialogOpen={false}
        editValues={defaultEditValues}
        saving={false}
        saveError={null}
        onDeploymentChange={() => {}}
        onEditClick={() => {}}
        onEditDialogClose={() => {}}
        onEditValuesChange={() => {}}
        onSave={async () => {}}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Select a deployment to view scaling metrics'))).toBe(true);
  });

  /**
   * Tests that the "Loading deployments" progress bar is announced during the
   * initial load state, so screen reader users know data is being fetched.
   */
  test('announces loading state with accessible progress bar label', async () => {
    const { container } = render(
      <ScalingTabPure
        deployments={[]}
        selectedDeployment=""
        loading
        error={null}
        hpaInfo={null}
        chartData={[]}
        chartLoading={false}
        chartError={null}
        editDialogOpen={false}
        editValues={defaultEditValues}
        saving={false}
        saveError={null}
        onDeploymentChange={() => {}}
        onEditClick={() => {}}
        onEditDialogClose={() => {}}
        onEditValuesChange={() => {}}
        onSave={async () => {}}
      />
    );

    await virtual.start({ container });
    // Use collectPhrases with a bounded limit — the progressbar role may cause
    // the virtual screen reader to walk sub-nodes indefinitely
    const phrases = await collectPhrases(20);

    // The CircularProgress has aria-label="Loading deployments"; the virtual screen reader
    // should announce it as a progressbar with that label.
    expect(phrases.some(p => p.includes('Loading deployments'))).toBe(true);
  });

  /**
   * Tests that the "Edit Configuration" button is reachable via screen reader
   * navigation when a deployment is selected, so users can trigger the edit flow.
   */
  test('announces Edit Configuration button when deployment is selected', async () => {
    const { container } = render(
      <ScalingTabPure
        deployments={sampleDeployments}
        selectedDeployment="frontend"
        loading={false}
        error={null}
        hpaInfo={hpaInfo}
        chartData={sampleChartData}
        chartLoading={false}
        chartError={null}
        editDialogOpen={false}
        editValues={defaultEditValues}
        saving={false}
        saveError={null}
        onDeploymentChange={() => {}}
        onEditClick={() => {}}
        onEditDialogClose={() => {}}
        onEditValuesChange={() => {}}
        onSave={async () => {}}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Edit Configuration'))).toBe(true);
  });
});
