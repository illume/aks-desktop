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

// @iconify/react renders an inline SVG — stub it so the test focuses on dialog structure.
// Forward aria-hidden so axe tests can detect missing aria-hidden on decorative icons in production code.
vi.mock('@iconify/react', () => ({
  Icon: ({ icon, 'aria-hidden': ariaHidden }: { icon: string; 'aria-hidden'?: string | boolean }) =>
    ariaHidden ? null : <span>{icon}</span>,
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
    render(
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
    // MUI Dialog renders into a portal on document.body, outside the render container.
    // axe.run(document.body) ensures the dialog's actual DOM content is scanned.
    const results = await axe.run(document.body);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations in manual mode', async () => {
    render(
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
    const results = await axe.run(document.body);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations while saving', async () => {
    render(
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
    const results = await axe.run(document.body);
    expect(results.violations).toEqual([]);
  });
});
