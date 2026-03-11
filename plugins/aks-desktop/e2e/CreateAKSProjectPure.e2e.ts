// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * End-to-end screen reader tests for the CreateAKSProjectPure component.
 *
 * These tests run a real screen reader (NVDA on Windows, VoiceOver on macOS)
 * against Storybook stories using Playwright and @guidepup/playwright.
 *
 * The screen reader is selected via the `SCREEN_READER` env var:
 *   SCREEN_READER=nvda        → NVDA (Windows CI)
 *   SCREEN_READER=voiceover   → VoiceOver (macOS CI)
 *
 * Run locally:
 *   SCREEN_READER=voiceover npx playwright test --config playwright.config.ts
 *
 * Stories tested:
 *   - BasicsStepDefault  — breadcrumb navigation, step heading, Cancel/Next buttons
 *   - LoadingOverlay     — aria-busy announcement, progress text
 *   - ErrorOverlay       — alertdialog, error text, Cancel button
 *   - SuccessDialog      — dialog title, application name input, Create button
 *   - ValidationError    — Next button disabled state
 *   - NextButtonLoading  — Next button busy/loading state
 */

import { test, expect, getScreenReader } from './screenReaderTest';

const STORY_BASE =
  '/iframe.html?args=&id=createaksproject-createaksprojectpure--';

function storyUrl(storyId: string): string {
  return `${STORY_BASE}${storyId}&viewMode=story`;
}

async function collectPhrases(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sr: any,
  maxSteps = 80
): Promise<string[]> {
  const phrases: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    await sr.next();
    const phrase = await sr.lastSpokenPhrase();
    phrases.push(phrase);
  }
  return phrases;
}

test.describe('CreateAKSProjectPure — Screen Reader E2E', () => {
  test('BasicsStepDefault: announces breadcrumb and heading', async fixtures => {
    const { page } = fixtures;
    const sr = getScreenReader(fixtures);

    await page.goto(storyUrl('basics-step-default'));
    await sr.navigateToWebContent();

    const phrases = await collectPhrases(sr);
    const allText = phrases.join(' ');

    expect(allText).toMatch(/new project/i);
    expect(allText).toMatch(/basics/i);
  });

  test('BasicsStepDefault: Cancel and Next buttons reachable', async fixtures => {
    const { page } = fixtures;
    const sr = getScreenReader(fixtures);

    await page.goto(storyUrl('basics-step-default'));
    await sr.navigateToWebContent();

    const phrases = await collectPhrases(sr);
    const allText = phrases.join(' ');

    expect(allText).toMatch(/cancel/i);
    expect(allText).toMatch(/next/i);
  });

  test('LoadingOverlay: announces creating progress', async fixtures => {
    const { page } = fixtures;
    const sr = getScreenReader(fixtures);

    await page.goto(storyUrl('loading-overlay'));
    await sr.navigateToWebContent();

    const phrases = await collectPhrases(sr);
    const allText = phrases.join(' ');

    expect(allText).toMatch(/creating/i);
  });

  test('ErrorOverlay: announces error dialog with cancel', async fixtures => {
    const { page } = fixtures;
    const sr = getScreenReader(fixtures);

    await page.goto(storyUrl('error-overlay'));
    await sr.navigateToWebContent();

    const phrases = await collectPhrases(sr);
    const allText = phrases.join(' ');

    expect(allText).toMatch(/error/i);
    expect(allText).toMatch(/cancel/i);
  });

  test('SuccessDialog: announces success and application name input', async fixtures => {
    const { page } = fixtures;
    const sr = getScreenReader(fixtures);

    await page.goto(storyUrl('success-dialog'));
    await sr.navigateToWebContent();

    const phrases = await collectPhrases(sr);
    const allText = phrases.join(' ');

    expect(allText).toMatch(/project created/i);
    expect(allText).toMatch(/application name/i);
  });

  test('ValidationError: Next button announced as disabled', async fixtures => {
    const { page } = fixtures;
    const sr = getScreenReader(fixtures);

    await page.goto(storyUrl('validation-error'));
    await sr.navigateToWebContent();

    const phrases = await collectPhrases(sr);
    const allText = phrases.join(' ');

    expect(allText).toMatch(/next/i);
    expect(allText).toMatch(/disabled|dimmed/i);
  });

  test('NextButtonLoading: Next button announced as busy', async fixtures => {
    const { page } = fixtures;
    const sr = getScreenReader(fixtures);

    await page.goto(storyUrl('next-button-loading'));
    await sr.navigateToWebContent();

    const phrases = await collectPhrases(sr);
    const allText = phrases.join(' ');

    expect(allText).toMatch(/loading|busy/i);
  });
});
