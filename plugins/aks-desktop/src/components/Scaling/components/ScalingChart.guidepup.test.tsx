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

import { ScalingChart } from './ScalingChart';

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

describe('ScalingChart guidepup screen reader', () => {
  /**
   * Tests that the loading text is announced so screen reader users know
   * chart data is being fetched. The CircularProgress is aria-hidden since the
   * visible Typography text already describes the state.
   */
  test('announces loading state with loading text', async () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <ScalingChart chartData={[]} loading error={null} />
      </div>
    );

    await virtual.start({ container });
    const phrases = await collectPhrases(20);

    expect(phrases.some(p => p.includes('Loading scaling metrics'))).toBe(true);
  });

  /**
   * Tests that an error alert is announced so screen reader users are
   * aware the chart is unavailable and why.
   */
  test('announces error alert when chart fetch fails', async () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <ScalingChart chartData={[]} loading={false} error="Unable to connect to Prometheus" />
      </div>
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Unable to connect to Prometheus'))).toBe(true);
  });

  /**
   * Tests that a "No scaling data available" message is announced when the
   * chart has no data to display.
   */
  test('announces no data message', async () => {
    const { container } = render(
      <div style={{ height: 400 }}>
        <ScalingChart chartData={[]} loading={false} error={null} />
      </div>
    );

    await virtual.start({ container });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('No scaling data available'))).toBe(true);
  });
});
