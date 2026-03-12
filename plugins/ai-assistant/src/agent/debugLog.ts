/**
 * Debug logger for AKS agent response parsing.
 *
 * - **On by default** in development (`npm start` / `import.meta.env.DEV`).
 * - **Off** in production builds.
 * - **Off** during tests (`import.meta.env.MODE === 'test'`).
 *
 * Helpers:
 * - `debugLog(tag, ...args)` — emits a `console.debug` line.
 * - `warnLog(tag, ...args)` — emits a `console.warn` line.
 * - `dumpForTestCase(tag, raw, parsed)` — logs both values as JSON strings
 *   so you can copy-paste them straight into a new test case.
 */

let _enabled: boolean | null = null;

function isEnabled(): boolean {
  if (_enabled !== null) return _enabled;

  try {
    // import.meta.env is set by Vite / Vitest
    if (import.meta.env.MODE === 'test') {
      _enabled = false;
      return false;
    }
    // On in dev, off in production
    _enabled = !!import.meta.env.DEV;
    return _enabled;
  } catch {
    // Not in a Vite context — default off
    _enabled = false;
    return false;
  }
}

/** Emit a console.debug line.  Active in dev mode, silent in tests and production. */
export function debugLog(tag: string, ...args: unknown[]): void {
  if (!isEnabled()) return;
  console.debug(tag, ...args);
}

/** Emit a console.warn line.  Active in dev mode, silent in tests and production. */
export function warnLog(tag: string, ...args: unknown[]): void {
  if (!isEnabled()) return;
  console.warn(tag, ...args);
}

/**
 * Log a raw→parsed pair as JSON so you can copy-paste it into a test.
 *
 * Example output:
 * ```
 * [AKS Agent TestCase] extractAIAnswer
 *   input:  "AI: Hello\nroot@host:#"
 *   output: "Hello"
 * ```
 *
 * Silent during tests.
 */
export function dumpForTestCase(tag: string, raw: string, parsed: string): void {
  if (!isEnabled()) return;
  console.debug(
    `[AKS Agent TestCase] ${tag}\n  input:  ${JSON.stringify(raw)}\n  output: ${JSON.stringify(
      parsed
    )}`
  );
}

// Allow tests to override enabled state
export const _testing = {
  /** Force enable/disable, or pass null to reset to auto-detect. */
  setEnabled(value: boolean | null): void {
    _enabled = value;
  },
};
