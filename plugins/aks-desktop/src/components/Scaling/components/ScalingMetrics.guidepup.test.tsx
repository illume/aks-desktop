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

// Stub Iconify so the test focuses on metrics structure rather than icon loading
vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} aria-hidden="true" />,
}));

import { ScalingMetrics } from './ScalingMetrics';

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

describe('ScalingMetrics guidepup screen reader', () => {
  /**
   * Tests that HPA scaling mode and key metric labels are announced,
   * so screen reader users can understand the scaling configuration.
   */
  test('announces HPA scaling mode and metric labels', async () => {
    const { container } = render(
      <ScalingMetrics
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        hpaInfo={hpaInfo}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Scaling Mode'))).toBe(true);
    expect(phrases.some(p => p.includes('HPA'))).toBe(true);
    expect(phrases.some(p => p.includes('Current Replicas'))).toBe(true);
  });

  /**
   * Tests that manual scaling mode is announced with its metric labels.
   */
  test('announces manual scaling mode', async () => {
    const { container } = render(
      <ScalingMetrics
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        hpaInfo={null}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Scaling Mode'))).toBe(true);
    expect(phrases.some(p => p.includes('Manual'))).toBe(true);
  });

  /**
   * Tests that replica count values are announced so screen reader users
   * get the actual scaling numbers.
   */
  test('announces replica count values', async () => {
    const { container } = render(
      <ScalingMetrics
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        hpaInfo={hpaInfo}
      />
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    // Current replicas = 3, desired = 3, bounds = 2-10
    expect(phrases.some(p => p.includes('3'))).toBe(true);
  });
});
