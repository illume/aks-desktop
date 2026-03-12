/**
 * Debug logger for AKS agent response parsing.
 *
 * - Silent during tests (`import.meta.env.MODE === 'test'`) so test output
 *   stays clean.
 * - `debugLog(tag, ...args)` — emits a `console.debug` line when enabled.
 * - `warnLog(tag, ...args)` — emits a `console.warn` line when enabled.
 * - `dumpForTestCase(tag, raw, parsed)` — logs both values as JSON strings
 *   so you can copy-paste them straight into a new test case.
 *
 * Enable verbose output at runtime (in non-test builds) by setting
 * `localStorage.AKS_DEBUG = '1'` in the browser console.
 */

let _enabled: boolean | null = null;

function isEnabled(): boolean {
  if (_enabled !== null) return _enabled;

  // Silent during vitest — import.meta.env.MODE is set by Vite
  try {
    if (import.meta.env.MODE === 'test') {
      _enabled = false;
      return false;
    }
  } catch {
    /* not in Vite context */
  }

  // Off by default in production — opt in via localStorage
  let enabled = false;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      enabled = window.localStorage.getItem('AKS_DEBUG') === '1';
    }
  } catch {
    // localStorage unavailable or throws (e.g. iframe sandbox)
  }
  _enabled = enabled;
  return enabled;
}

/** Emit a console.debug line.  Requires `localStorage.AKS_DEBUG = '1'`. */
export function debugLog(tag: string, ...args: unknown[]): void {
  if (!isEnabled()) return;
  console.debug(tag, ...args);
}

/** Emit a console.warn line.  Requires `localStorage.AKS_DEBUG = '1'`. */
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
