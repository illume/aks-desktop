// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.
import { runCommandAsync as execCommand } from '../shared/runCommandAsync';
import { getAzCommand } from './az-cli-path';
import {
  getNativeAccount,
  getNativeAuthGeneration,
  hasNativeSession,
  isAzureExplicitlySignedOut,
} from './native-auth';

// Debug flag - set to true for development/debugging, false for production
// Can be controlled via:
// 1. NODE_ENV=development (automatic)
// 2. DEBUG_AZ_CLI=true environment variable
// 3. Manually set DEBUG_LOGS = true for debugging
const DEBUG_LOGS = process.env.NODE_ENV === 'development' || process.env.DEBUG_AZ_CLI === 'true';

// Helper function for debug logging
export const debugLog = (...args: any[]) => {
  if (DEBUG_LOGS) {
    console.debug(...args);
  }
};

// Validate that a string is a valid GUID (prevents KQL injection in Resource Graph queries)
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidGuid(value: string): boolean {
  return GUID_PATTERN.test(value);
}

// Helper to determine if error message implies re-login is needed
export function needsRelogin(error: string): boolean {
  return (
    error.includes('Interactive authentication is needed') ||
    error.includes('AADSTS700082') ||
    error.includes('AADSTS50173') ||
    /please run\s+["']?az login["']?/i.test(error)
  );
}

const CLI_IDENTITY_ERROR =
  'ERROR: Azure CLI identity could not be verified. Sign in to Azure CLI with the same account, tenant, and cloud as the application.';
let cliLoginsPending = 0;
let cliLoginFailed = false;
let cliLoginEpoch = 0;
let cliIdentityChangesPending = 0;
let nativeSubscriptionTenantLookup: (subscriptionId: string) => string | undefined = () =>
  undefined;

/** Registers the native discovery lookup without depending on the token module. */
export function registerNativeSubscriptionTenantLookup(
  lookup: (subscriptionId: string) => string | undefined
): void {
  nativeSubscriptionTenantLookup = lookup;
}

function isIdentityIndependent(args: string[]): boolean {
  return (
    args[0] === 'version' ||
    args[0] === 'login' ||
    args[0] === 'logout' ||
    (args[0] === 'cloud' && args[1] === 'show') ||
    (args[0] === 'account' && args[1] === 'show')
  );
}

function changesCliIdentity(args: string[]): boolean {
  return (
    (args[0] === 'account' && ['set', 'clear'].includes(args[1])) ||
    (args[0] === 'cloud' && ['set', 'register', 'unregister', 'update'].includes(args[1]))
  );
}

function sameValue(a: unknown, b: unknown): boolean {
  return (
    typeof a === 'string' &&
    typeof b === 'string' &&
    !!a.trim() &&
    !!b.trim() &&
    a.trim().toLowerCase() === b.trim().toLowerCase()
  );
}

async function verifyCliIdentity(
  az: string,
  native: NonNullable<ReturnType<typeof getNativeAccount>>,
  args: string[] = []
): Promise<boolean> {
  try {
    const subscriptions: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--subscription' || args[i] === '--subscriptions') {
        const plural = args[i] === '--subscriptions';
        if (!args[i + 1] || args[i + 1].startsWith('-')) return false;
        subscriptions.push(args[++i]);
        while (plural && args[i + 1] && !args[i + 1].startsWith('-')) {
          subscriptions.push(args[++i]);
        }
      } else if (args[i].startsWith('--subscription=')) {
        const value = args[i].slice('--subscription='.length);
        if (!value) return false;
        subscriptions.push(value);
      } else if (args[i].startsWith('--subscriptions=')) {
        const value = args[i].slice('--subscriptions='.length);
        if (!value) return false;
        subscriptions.push(value);
      } else if (args[i] === '--tenant') {
        if (!sameValue(args[++i], native.tenantId)) return false;
      } else if (args[i].startsWith('--tenant=')) {
        if (!sameValue(args[i].slice('--tenant='.length), native.tenantId)) return false;
      }
    }
    const [accountResults, cloudResult] = await Promise.all([
      Promise.all(
        (subscriptions.length ? subscriptions : [undefined]).map(subscription =>
          execCommand(az, [
            'account',
            'show',
            ...(subscription ? ['--subscription', subscription] : []),
            '-o',
            'json',
          ])
        )
      ),
      execCommand(az, ['cloud', 'show', '-o', 'json']),
    ]);
    if (isCommandError(cloudResult.stderr) || !cloudResult.stdout) {
      return false;
    }
    const cloud = JSON.parse(cloudResult.stdout);
    if (!sameValue(native.environmentName, cloud?.name)) return false;
    return accountResults.every((accountResult, index) => {
      if (isCommandError(accountResult.stderr) || !accountResult.stdout) return false;
      const cliAccount = JSON.parse(accountResult.stdout);
      if (typeof cliAccount?.id !== 'string' || !cliAccount.id.trim()) return false;
      const selector = subscriptions[index];
      if (selector && isValidGuid(selector) && !sameValue(selector, cliAccount.id)) return false;
      const tenant = nativeSubscriptionTenantLookup(cliAccount.id);
      return (
        sameValue(native.username, cliAccount?.user?.name) &&
        sameValue(tenant, cliAccount?.tenantId) &&
        sameValue(native.environmentName, cliAccount?.cloudName ?? cliAccount?.environmentName)
      );
    });
  } catch {
    return false;
  }
}

function isCommandError(stderr: string): boolean {
  const error = stderr.trim();
  return (
    !!error &&
    (isAzError(error) ||
      needsRelogin(error) ||
      isCliNotFoundError(error) ||
      error.split('\n').some(line => !line.trim().startsWith('WARNING:')))
  );
}

async function hasCliAccount(az: string): Promise<boolean> {
  try {
    const result = await execCommand(az, ['account', 'show', '-o', 'json']);
    if (isCommandError(result.stderr)) return false;
    const account = JSON.parse(result.stdout);
    return (
      typeof account?.id === 'string' &&
      !!account.id.trim() &&
      typeof account?.tenantId === 'string' &&
      !!account.tenantId.trim()
    );
  } catch {
    return false;
  }
}

async function runCliLogin(
  az: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  if (cliLoginsPending++ === 0) cliLoginFailed = false;
  const epoch = ++cliLoginEpoch;
  try {
    const result = await execCommand(az, args);
    let accounts: unknown;
    try {
      accounts = JSON.parse(result.stdout);
    } catch {
      // An incomplete or malformed login response cannot establish a trusted session.
    }
    const native = getNativeAccount();
    const generation = getNativeAuthGeneration();
    const valid =
      !isCommandError(result.stderr) &&
      Array.isArray(accounts) &&
      accounts.length > 0 &&
      (native ? await verifyCliIdentity(az, native) : await hasCliAccount(az)) &&
      generation === getNativeAuthGeneration() &&
      epoch === cliLoginEpoch;
    if (!valid) {
      cliLoginFailed = true;
      if (!isCommandError(result.stderr)) return { stdout: '', stderr: CLI_IDENTITY_ERROR };
    }
    return result;
  } catch (error) {
    cliLoginFailed = true;
    throw error;
  } finally {
    cliLoginsPending--;
  }
}

export async function runCommandAsync(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  let actualCommand = command;
  if (command === 'az') {
    actualCommand = getAzCommand();
    debugLog('[AZ-CLI] Command resolution:', command, '→', actualCommand);
  }
  debugLog('[AZ-CLI] Executing command:', actualCommand, 'with args:', args);
  if (command === 'az') {
    if (args[0] === 'login') return runCliLogin(actualCommand, args);
    if (args[0] === 'logout') {
      cliLoginEpoch++;
      cliLoginFailed = true;
    }
    if (!isIdentityIndependent(args)) {
      if (
        cliLoginsPending ||
        cliIdentityChangesPending ||
        cliLoginFailed ||
        isAzureExplicitlySignedOut()
      ) {
        return { stdout: '', stderr: CLI_IDENTITY_ERROR };
      }
      const native = getNativeAccount();
      if (!native) {
        if (hasNativeSession()) {
          return { stdout: '', stderr: CLI_IDENTITY_ERROR };
        }
      } else {
        const generation = getNativeAuthGeneration();
        const epoch = cliLoginEpoch;
        const verified = await verifyCliIdentity(actualCommand, native, args);
        if (
          !verified ||
          generation !== getNativeAuthGeneration() ||
          epoch !== cliLoginEpoch ||
          cliLoginsPending ||
          cliIdentityChangesPending ||
          cliLoginFailed ||
          isAzureExplicitlySignedOut()
        ) {
          return { stdout: '', stderr: CLI_IDENTITY_ERROR };
        }
      }
      if (changesCliIdentity(args)) {
        cliLoginEpoch++;
        cliIdentityChangesPending++;
        try {
          return await execCommand(actualCommand, args);
        } finally {
          cliIdentityChangesPending--;
        }
      }
    }
  }
  return execCommand(actualCommand, args);
}

export async function isAzCliInstalled(): Promise<boolean> {
  try {
    const { stdout, stderr } = await runCommandAsync('az', ['version']);
    debugLog('Azure CLI version check:', stderr, stdout);

    if (stderr && isCliNotFoundError(stderr)) {
      debugLog('Azure CLI not found in PATH');
      return false;
    }

    // Parse JSON output from az version
    if (stdout) {
      try {
        const versionData = JSON.parse(stdout);
        if (versionData['azure-cli']) {
          debugLog('Azure CLI found, version:', versionData['azure-cli']);
          return true; // Azure CLI is installed
        } else {
          debugLog('Azure CLI version not detected in JSON output');
          return false;
        }
      } catch (parseError) {
        debugLog('Failed to parse Azure CLI version JSON:', parseError);
        return false;
      }
    } else {
      debugLog('Azure CLI version not detected in output');
      return false; // Azure CLI not found
    }
  } catch (error) {
    console.error('Error checking Azure CLI installation:', error);
    return false;
  }
}

export async function isAzCliLoggedIn(): Promise<boolean> {
  try {
    const { stdout, stderr } = await runCommandAsync('az', [
      'account',
      'show',
      '--query',
      'user.name',
      '-o',
      'tsv',
    ]);

    if (stderr && isCliNotFoundError(stderr)) {
      debugLog('Azure CLI not found when checking login status');
      return false;
    }

    if (stdout.trim()) return true;
    if (needsRelogin(stderr)) console.warn('AKS-plugin: Azure CLI requires re-login');
    return false;
  } catch (error) {
    console.error('Error checking Azure CLI login status:', error);
    return false;
  }
}

// Azure CLI prefixes fatal errors with "ERROR: " in stderr
export function isAzError(stderr: string): boolean {
  return stderr.includes('ERROR: ');
}

export function isCliNotFoundError(output: string): boolean {
  return (
    /(?:^|\s)(?:spawn\s+)?az(?:\.cmd)?\s+ENOENT\b/i.test(output) ||
    /(?:^|\s)az:\s*(?:command\s+)?not found\b/i.test(output) ||
    /'az(?:\.cmd)?' is not recognized as an internal or external command/i.test(output) ||
    /Azure CLI \(az\) command not found/i.test(output)
  );
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Shared helper that runs an `az` CLI command and handles the common
 * error-handling pattern (relogin detection, az-error detection, JSON
 * parsing, and catch-block formatting).
 *
 * @param args          - CLI arguments passed to `az`.
 * @param debugLabel    - Label used in `debugLog` (e.g. "Creating managed identity:").
 * @param errorContext  - Human-readable phrase used in error messages
 *                        (e.g. "create managed identity").
 * @param parseOutput   - Optional function to extract a value from stdout.
 * @param checkStderr   - Optional callback invoked when stderr is non-empty,
 *                        *after* the relogin check but *before* the isAzError
 *                        check. Return a result object to short-circuit, or
 *                        `null` to fall through to the default error check.
 */
export async function runAzCommand<T>(
  args: string[],
  debugLabel: string,
  errorContext: string,
  parseOutput?: (stdout: string) => T,
  checkStderr?: (stderr: string) => { success: boolean; [key: string]: unknown } | null
): Promise<{ success: boolean; data?: T; error?: string; [key: string]: unknown }> {
  try {
    debugLog(debugLabel, 'az', args.join(' '));
    const { stdout, stderr } = await runCommandAsync('az', args);

    if (stderr) {
      if (needsRelogin(stderr)) {
        return {
          success: false,
          error: 'Authentication required. Please log in to Azure CLI: az login',
        };
      }

      if (checkStderr) {
        const earlyReturn = checkStderr(stderr);
        if (earlyReturn) {
          return earlyReturn;
        }
      }

      if (isAzError(stderr)) {
        return { success: false, error: `Failed to ${errorContext}: ${stderr}` };
      }
    }

    const data = parseOutput ? parseOutput(stdout) : undefined;
    return { success: true, data };
  } catch (error) {
    const msg = getErrorMessage(error);
    return { success: false, error: `Failed to ${errorContext}: ${msg}` };
  }
}
