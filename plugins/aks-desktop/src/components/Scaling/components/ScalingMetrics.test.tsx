// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Stub Iconify so tests focus on structure/behavior rather than icon loading (and avoid network calls).
// Forward aria-hidden so axe tests can detect missing aria-hidden on decorative icons in production code.
vi.mock('@iconify/react', () => ({
  Icon: ({ icon, 'aria-hidden': ariaHidden }: { icon: string; 'aria-hidden'?: string | boolean }) =>
    ariaHidden ? null : <span>{icon}</span>,
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

afterEach(() => {
  cleanup();
});

describe('ScalingMetrics a11y', () => {
  test('has no axe violations in HPA mode', async () => {
    const { container } = render(
      <ScalingMetrics
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        hpaInfo={hpaInfo}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations in manual mode', async () => {
    const { container } = render(
      <ScalingMetrics
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        hpaInfo={null}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations with missing HPA metrics', async () => {
    const { container } = render(
      <ScalingMetrics
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        hpaInfo={{
          name: 'frontend-hpa',
          namespace: 'default',
          minReplicas: undefined,
          maxReplicas: undefined,
          targetCPUUtilization: undefined,
          currentCPUUtilization: undefined,
          currentReplicas: undefined,
          desiredReplicas: undefined,
        }}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
