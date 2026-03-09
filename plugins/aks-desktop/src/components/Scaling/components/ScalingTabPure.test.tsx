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

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, 'aria-hidden': ariaHidden }: { icon: string; 'aria-hidden'?: string | boolean }) =>
    ariaHidden ? null : <span>{icon}</span>,
}));

import type { EditValues } from '../hooks/useEditDialog';
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

afterEach(() => {
  cleanup();
});

describe('ScalingTabPure a11y', () => {
  test('has no axe violations with a selected HPA-managed deployment', async () => {
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
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations with a selected manually-scaled deployment', async () => {
    const { container } = render(
      <ScalingTabPure
        deployments={sampleDeployments}
        selectedDeployment="frontend"
        loading={false}
        error={null}
        hpaInfo={null}
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
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations with no deployment selected', async () => {
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
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations in loading state', async () => {
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
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations in fetch error state', async () => {
    const { container } = render(
      <ScalingTabPure
        deployments={[]}
        selectedDeployment=""
        loading={false}
        error="Failed to fetch deployments from cluster"
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
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations with edit dialog open', async () => {
    render(
      <ScalingTabPure
        deployments={sampleDeployments}
        selectedDeployment="frontend"
        loading={false}
        error={null}
        hpaInfo={hpaInfo}
        chartData={sampleChartData}
        chartLoading={false}
        chartError={null}
        editDialogOpen
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
    // MUI Dialog renders into a portal on document.body, outside the render container.
    // axe.run(document.body) ensures the dialog's actual DOM content is scanned.
    const results = await axe.run(document.body);
    expect(results.violations).toEqual([]);
  });
});
