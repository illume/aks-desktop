// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * Screen reader adapter that selects the driver based on the `SCREEN_READER`
 * environment variable.
 *
 *   SCREEN_READER unset / empty → @guidepup/virtual-screen-reader  (default)
 *   SCREEN_READER=voiceover     → VoiceOver via @guidepup/guidepup  (macOS)
 *   SCREEN_READER=nvda          → NVDA via @guidepup/guidepup       (Windows)
 *
 * All three drivers expose the same core API surface used by the tests:
 *   start / stop / next / lastSpokenPhrase / spokenPhraseLog
 *
 * The virtual driver's `start()` requires `{ container }` while the real
 * drivers do not — callers should always pass the options object and this
 * module returns the correct singleton for the environment.
 */

export type ScreenReaderDriver = 'virtual' | 'voiceover' | 'nvda';

const raw = (process.env.SCREEN_READER ?? '').toLowerCase();

export const activeDriver: ScreenReaderDriver =
  raw === 'nvda' ? 'nvda' : raw === 'voiceover' ? 'voiceover' : 'virtual';

/**
 * Lazily resolve the screen reader singleton.
 *
 * For `virtual` (default) the import is synchronous because
 * `@guidepup/virtual-screen-reader` is always available in the vitest
 * environment.  For real drivers the heavy native dependency is loaded
 * dynamically so it never fails in jsdom-only CI.
 */
export async function getScreenReader() {
  if (activeDriver === 'virtual') {
    const { virtual } = await import('@guidepup/virtual-screen-reader');
    return virtual;
  }
  const guidepup = await import('@guidepup/guidepup');
  return activeDriver === 'nvda' ? guidepup.nvda : guidepup.voiceOver;
}

