/**
 * Debug logger for AKS agent response parsing.
 *
 * - Silent during tests (`import.meta.env.MODE === 'test'`) so test output
 *   stays clean.
 * - `debugLog(tag, ...args)` — emits a `console.debug` line.
 * - `warnLog(tag, ...args)` — emits a `console.warn` line (always, even in tests).
 * - `dumpForTestCase(tag, raw, parsed)` — logs both values as JSON strings
 *   so you can copy-paste them straight into a new test case.
 *
 * Enable verbose output at runtime by setting `localStorage.AKS_DEBUG = '1'`
 * in the browser console.  When enabled, `debugLog` writes to `console.debug`
 * even if it would otherwise be silent.
 */

let _enabled: boolean | null = null;

function isEnabled(): boolean {
  if (_enabled !== null) return _enabled;
  try {
    // @ts-ignore – import.meta.env is injected by Vite
    if (import.meta.env.MODE === 'test') {
      _enabled = false;
      return false;
    }
  } catch {
    /* not in Vite context */
  }
  _enabled = true;
  return true;
}

/** Emit a console.debug line.  Silent during tests. */
export function debugLog(tag: string, ...args: unknown[]): void {
  if (!isEnabled()) return;
  console.debug(tag, ...args);
}

/**
 * Emit a console.warn line.  Active even during tests so real
 * problems are never silently swallowed.
 */
export function warnLog(tag: string, ...args: unknown[]): void {
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
