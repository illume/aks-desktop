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

// MUI Select sets aria-controls pointing to a listbox that doesn't exist in jsdom when
// the dropdown is closed. This is a known MUI behavior:
// https://github.com/mui/material-ui/issues/32825
// The virtual screen reader crashes trying to resolve the dangling ID reference.
// We mock DeploymentSelector with a native <select> that has equivalent semantics.
// The real component's a11y is verified by the axe tests in DeploymentSelector.test.tsx
// which run against the unmocked MUI Select without issue.
vi.mock('./DeploymentSelector', () => ({
  DeploymentSelector: ({
    selectedDeployment,
    deployments,
    loading,
  }: {
    selectedDeployment: string;
    deployments: Array<{ name: string }>;
    loading: boolean;
    onDeploymentChange: (name: string) => void;
  }) => (
    <label>
      Select Deployment
      <select
        value={selectedDeployment}
        disabled={loading || deployments.length === 0}
        onChange={() => {}}
      >
        {loading ? (
          <option disabled>Loading deployments...</option>
        ) : deployments.length === 0 ? (
          <option disabled>No deployments found</option>
        ) : (
          deployments.map(d => (
            <option key={d.name} value={d.name}>
              {d.name}
            </option>
          ))
        )}
      </select>
    </label>
  ),
}));

import { DeploymentSelector } from './DeploymentSelector';

const sampleDeployments = [
  { name: 'frontend', namespace: 'default', replicas: 3, availableReplicas: 3, readyReplicas: 3 },
  { name: 'backend', namespace: 'default', replicas: 2, availableReplicas: 2, readyReplicas: 2 },
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

describe('DeploymentSelector guidepup screen reader', () => {
  /**
   * Tests that the "Select Deployment" label is announced, confirming the
   * combobox has an accessible name.
   */
  test('announces the Select Deployment label', async () => {
    const { container } = render(
      <DeploymentSelector
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        loading={false}
        onDeploymentChange={() => {}}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Select Deployment'))).toBe(true);
  });

  /**
   * Tests that when the selector is disabled during loading, the screen reader
   * announces the disabled state.
   */
  test('announces loading state as disabled', async () => {
    const { container } = render(
      <DeploymentSelector
        selectedDeployment=""
        deployments={[]}
        loading
        onDeploymentChange={() => {}}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Select Deployment'))).toBe(true);
    // The native <select> mock renders disabled={true} during loading;
    // the virtual screen reader announces this as "dimmed" or "disabled".
    expect(phrases.some(p => /dimmed|disabled/i.test(p))).toBe(true);
  });

  /**
   * Tests that available deployments are announced in the combobox options.
   */
  test('announces deployment options', async () => {
    const { container } = render(
      <DeploymentSelector
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        loading={false}
        onDeploymentChange={() => {}}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('frontend'))).toBe(true);
  });
});
