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

// @iconify/react renders an inline SVG — stub it with a simple presentational span
// so the test focuses on dialog structure rather than icon loading
vi.mock('@iconify/react', () => ({
  Icon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} aria-hidden="true" />,
}));

import type { EditValues } from '../hooks/useEditDialog';
import { ScalingEditDialog } from './ScalingEditDialog';

const defaultEditValues: EditValues = {
  minReplicas: 2,
  maxReplicas: 10,
  targetCPU: 60,
  replicas: 3,
};

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

describe('ScalingEditDialog a11y', () => {
  test('has no axe violations in HPA mode', async () => {
    const { container } = render(
      <ScalingEditDialog
        open
        hpaInfo={hpaInfo}
        editValues={defaultEditValues}
        saving={false}
        onEditValuesChange={() => {}}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations in manual mode', async () => {
    const { container } = render(
      <ScalingEditDialog
        open
        hpaInfo={null}
        editValues={defaultEditValues}
        saving={false}
        onEditValuesChange={() => {}}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations while saving', async () => {
    const { container } = render(
      <ScalingEditDialog
        open
        hpaInfo={hpaInfo}
        editValues={defaultEditValues}
        saving
        onEditValuesChange={() => {}}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
