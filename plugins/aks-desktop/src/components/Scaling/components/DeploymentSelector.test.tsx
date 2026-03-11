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

import { DeploymentSelector } from './DeploymentSelector';

const sampleDeployments = [
  { name: 'frontend', namespace: 'default', replicas: 3, availableReplicas: 3, readyReplicas: 3 },
  { name: 'backend', namespace: 'default', replicas: 2, availableReplicas: 2, readyReplicas: 2 },
];

afterEach(() => {
  cleanup();
});

describe('DeploymentSelector a11y', () => {
  test('has no axe violations with deployments loaded', async () => {
    const { container } = render(
      <DeploymentSelector
        selectedDeployment="frontend"
        deployments={sampleDeployments}
        loading={false}
        onDeploymentChange={() => {}}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations while loading', async () => {
    const { container } = render(
      <DeploymentSelector
        selectedDeployment=""
        deployments={[]}
        loading
        onDeploymentChange={() => {}}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations when empty', async () => {
    const { container } = render(
      <DeploymentSelector
        selectedDeployment=""
        deployments={[]}
        loading={false}
        onDeploymentChange={() => {}}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
