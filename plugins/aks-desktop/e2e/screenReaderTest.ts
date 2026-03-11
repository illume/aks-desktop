// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * Screen reader test fixture factory.
 *
 * Selects the screen reader driver based on the `SCREEN_READER` environment
 * variable:
 *
 *   SCREEN_READER=nvda       → NVDA on Windows   (requires @guidepup/setup)
 *   SCREEN_READER=voiceover  → VoiceOver on macOS (requires @guidepup/setup)
 *
 * The default is `voiceover` when the env var is unset.
 *
 * Usage in tests:
 *
 *   import { test, expect, getScreenReader } from './screenReaderTest';
 *
 *   test('announces heading', async (fixtures) => {
 *     const { page } = fixtures;
 *     const sr = getScreenReader(fixtures);
 *     await page.goto(STORYBOOK_URL);
 *     await sr.navigateToWebContent();
 *     // ...
 *   });
 */

import { nvdaTest, voiceOverTest } from '@guidepup/playwright';
import { expect } from '@playwright/test';

const SCREEN_READER = process.env.SCREEN_READER ?? 'voiceover';

export { expect };

/**
 * Playwright `test` function pre-configured with the correct screen reader
 * fixture (`voiceOver` or `nvda`) based on the `SCREEN_READER` env var.
 */
export const test = SCREEN_READER === 'nvda' ? nvdaTest : voiceOverTest;

/**
 * Extract the active screen reader instance from the Playwright fixture bag.
 * Works with both `voiceOverTest` (provides `voiceOver`) and `nvdaTest`
 * (provides `nvda`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getScreenReader(fixtures: Record<string, unknown>): any {
  const sr = (fixtures as any).voiceOver ?? (fixtures as any).nvda;
  if (!sr) {
    throw new Error(
      `No screen reader fixture found. SCREEN_READER="${SCREEN_READER}". ` +
        'Ensure the test uses the exported `test` from screenReaderTest.ts.'
    );
  }
  return sr;
}
