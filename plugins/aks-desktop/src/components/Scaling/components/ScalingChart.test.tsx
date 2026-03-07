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

import { ScalingChart } from './ScalingChart';

const sampleChartData = [
  { time: 'Mon, 09:00', Replicas: 2, CPU: 35 },
  { time: 'Mon, 10:00', Replicas: 3, CPU: 55 },
  { time: 'Mon, 11:00', Replicas: 4, CPU: 75 },
];

afterEach(() => {
  cleanup();
});

describe('ScalingChart a11y', () => {
  test('has no axe violations with chart data', async () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <ScalingChart chartData={sampleChartData} loading={false} error={null} />
      </div>
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations while loading', async () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <ScalingChart chartData={[]} loading error={null} />
      </div>
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations with error state', async () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <ScalingChart
          chartData={[]}
          loading={false}
          error="Unable to connect to Prometheus"
        />
      </div>
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });

  test('has no axe violations with no data', async () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <ScalingChart chartData={[]} loading={false} error={null} />
      </div>
    );
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
});
