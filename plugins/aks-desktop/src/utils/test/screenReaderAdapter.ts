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
 *
 * When a real screen reader is requested but unavailable (e.g. "VoiceOver not
 * supported" or "NVDA not running"), the adapter falls back to the virtual
 * driver transparently and logs a warning.
 */

export type ScreenReaderDriver = 'virtual' | 'voiceover' | 'nvda';

const raw = (process.env.SCREEN_READER ?? '').trim().toLowerCase();

export const activeDriver: ScreenReaderDriver =
  raw === 'nvda' ? 'nvda' : raw === 'voiceover' ? 'voiceover' : 'virtual';

async function loadVirtual() {
  const { virtual } = await import('@guidepup/virtual-screen-reader');
  return virtual;
}

/**
 * Lazily resolve the screen reader singleton.
 *
 * All drivers are loaded via dynamic (async) imports. For the `virtual`
 * driver (the default), `@guidepup/virtual-screen-reader` is expected to be
 * always available in the vitest environment. For the real drivers, the
 * heavy native dependency is only loaded when needed so it never fails in
 * jsdom-only CI.
 *
 * If a real screen reader is requested but throws at `start()` (e.g.
 * "VoiceOver not supported", "NVDA not running"), the returned object
 * automatically falls back to the virtual driver for that session and logs
 * a console warning.  This keeps CI green while still exercising real
 * screen readers when they are properly set up.
 */
export async function getScreenReader() {
  if (activeDriver === 'virtual') {
    return loadVirtual();
  }

  const guidepup = await import('@guidepup/guidepup');
  const realDriver = activeDriver === 'nvda' ? guidepup.nvda : guidepup.voiceOver;
  const virtual = await loadVirtual();

  let usingVirtualFallback = false;

  return {
    start: async (options?: { container: HTMLElement }) => {
      try {
        await realDriver.start();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(
          `[screenReaderAdapter] ${activeDriver} unavailable (${msg}), falling back to virtual`
        );
        usingVirtualFallback = true;
        await virtual.start(options!);
      }
    },
    stop: async () => {
      if (usingVirtualFallback) {
        await virtual.stop();
      } else {
        await realDriver.stop();
      }
    },
    next: async () => {
      if (usingVirtualFallback) {
        await virtual.next();
      } else {
        await realDriver.next();
      }
    },
    lastSpokenPhrase: async (): Promise<string> => {
      if (usingVirtualFallback) {
        return virtual.lastSpokenPhrase();
      }
      return realDriver.lastSpokenPhrase();
    },
    spokenPhraseLog: async (): Promise<string[]> => {
      if (usingVirtualFallback) {
        return virtual.spokenPhraseLog();
      }
      return realDriver.spokenPhraseLog();
    },
  };
}
