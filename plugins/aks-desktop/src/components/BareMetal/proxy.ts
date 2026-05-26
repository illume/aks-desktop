// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

declare const pluginRunCommand: (
  command: string,
  args: string[],
  options: Record<string, unknown>
) => ReturnType<typeof import('@kinvolk/headlamp-plugin/lib').runCommand>;

/** Status snapshot returned by BareMetal proxy lifecycle functions. */
export interface BareMetalProxyStatus {
  /** Whether the operation itself succeeded. */
  success: boolean;
  /** Current proxy state. */
  status: 'stopped' | 'starting' | 'running' | 'error';
  /** Most recent error message, if any. */
  lastError?: string;
  /** OS process ID of the running proxy, when available. */
  pid?: number;
  /** Raw lines received from the az process (stdout + stderr), newest last. */
  debugLog?: string[];
}

/** Internal bookkeeping for a running `az connectedk8s proxy` process. */
interface BareMetalProxySession {
  /** The child-process handle; `undefined` after the process exits. */
  cmd?: ReturnType<typeof import('@kinvolk/headlamp-plugin/lib').runCommand>;
  /** Mirrors {@link BareMetalProxyStatus.status}. */
  status: BareMetalProxyStatus['status'];
  /** Most recent error message, if any. */
  lastError?: string;
  /** OS process ID, when available. */
  pid?: number;
  /** Raw lines from the az process for debugging. */
  debugLog: string[];
}

/** In-memory map of active BareMetal proxy sessions, keyed by `subscription/resourceGroup/cluster`. */
const bareMetalProxySessions = new Map<string, BareMetalProxySession>();

/**
 * Reconciles the in-memory proxy session with actual cluster reachability.
 *
 * After a page reload the process handle is lost, so this function probes
 * the cluster and updates the session map accordingly.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the BareMetal cluster.
 * @returns The reconciled proxy status.
 */
export async function reconcileBareMetalProxyStatus(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<BareMetalProxyStatus> {
  const key = bareMetalProxyKey(subscriptionId, resourceGroup, clusterName);
  const previous = bareMetalProxySessions.get(key);

  // Probe the proxy port via the Headlamp backend's /externalproxy endpoint.
  // The backend makes the HTTPS request server-side, bypassing the self-signed
  // TLS certificate that az connectedk8s proxy uses.
  // A 200 response means the backend reached the proxy; 502 means not up yet.
  let isRunning = false;
  try {
    const backendPort = (window as any).headlampBackendPort ?? 4466;
    const resp = await fetch(`http://localhost:${backendPort}/externalproxy`, {
      headers: { 'Forward-to': 'https://localhost:47011/api/v1/namespaces' },
      signal: AbortSignal.timeout(4000),
    });
    isRunning = resp.ok;
  } catch {
    isRunning = false;
  }

  if (isRunning) {
    const reconciled: BareMetalProxySession = {
      status: 'running',
      lastError: undefined,
      pid: undefined,
      debugLog: previous?.debugLog ?? [],
    };
    bareMetalProxySessions.set(key, reconciled);
    return {
      success: true,
      status: 'running',
      debugLog: reconciled.debugLog,
    };
  }

  // Proxy port not reachable — report stopped so the user knows to start it.
  const stopped: BareMetalProxySession = {
    status: 'stopped',
    lastError: undefined,
    pid: undefined,
    debugLog: previous?.debugLog ?? [],
  };
  bareMetalProxySessions.set(key, stopped);
  return {
    success: true,
    status: 'stopped',
    debugLog: stopped.debugLog,
  };
}

/** Builds the composite map key for an BareMetal proxy session. */
export function bareMetalProxyKey(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): string {
  return `${subscriptionId}/${resourceGroup}/${clusterName}`;
}

/**
 * Starts an `az connectedk8s proxy` process for the given BareMetal cluster.
 *
 * If a proxy is already running (or the cluster is already reachable after a
 * page reload), the existing status is returned without spawning a duplicate.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the BareMetal cluster.
 */
export async function startBareMetalProxy(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<BareMetalProxyStatus> {
  if (typeof pluginRunCommand === 'undefined') {
    return {
      success: false,
      status: 'error',
      lastError: 'pluginRunCommand is not available.',
    };
  }

  const key = bareMetalProxyKey(subscriptionId, resourceGroup, clusterName);
  const existing = bareMetalProxySessions.get(key);

  if (existing && (existing.status === 'running' || existing.status === 'starting')) {
    return {
      success: true,
      status: existing.status,
      lastError: existing.lastError,
      pid: existing.pid,
    };
  }

  // Kill any orphaned az connectedk8s proxy on port 47011 before spawning a new one.
  if (typeof pluginRunCommand !== 'undefined') {
    try {
      pluginRunCommand('pkill', ['-f', 'connectedk8s proxy --port 47011'], {});
    } catch {
      // ignore — no orphan to kill
    }
  }

  try {
    const cmd = pluginRunCommand(
      'az',
      [
        'connectedk8s',
        'proxy',
        '--subscription',
        subscriptionId,
        '--resource-group',
        resourceGroup,
        '--name',
        clusterName,
        '--port',
        '47011',
      ],
      // detached: true puts the process in its own process group so it is not
      // killed when Electron signals its child process group.
      // stdio stdin:'ignore' prevents az connectedk8s proxy from treating stdin
      // EOF (no writer on the pipe) as an external close signal.
      { detached: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const session: BareMetalProxySession = {
      cmd,
      status: 'starting',
      pid: (cmd as any).pid,
      debugLog: [],
    };
    bareMetalProxySessions.set(key, session);

    // Detect readiness by polling the proxy's HTTP endpoint directly.
    // Any HTTP response (even an error JSON) means the port is up and the
    // proxy is ready — connection refused means it hasn't started yet.
    // We use a self-signed TLS cert so we need mode:'no-cors' to avoid CORS
    // preflight issues, but in Electron the renderer can hit localhost freely.
    const PROXY_URL = 'https://localhost:47011/api/v1/namespaces';
    const MAX_POLL_MS = 90_000;
    const pollStart = Date.now();

    async function probeProxy(): Promise<void> {
      const s = bareMetalProxySessions.get(key);
      if (!s || !s.cmd || s.status !== 'starting') return;
      if (Date.now() - pollStart > MAX_POLL_MS) {
        const t = bareMetalProxySessions.get(key);
        if (t && t.status === 'starting') {
          t.status = 'error';
          t.lastError = 'Proxy did not become ready within 90 seconds';
          bareMetalProxySessions.set(key, t);
        }
        return;
      }
      try {
        // Probe via the Headlamp backend's /externalproxy — it makes the HTTPS
        // request server-side, bypassing the az proxy's self-signed TLS cert.
        // 200 OK: backend reached the az proxy (port is up).
        // 502 Bad Gateway: backend got connection refused (not up yet).
        const backendPort = (window as any).headlampBackendPort ?? 4466;
        const resp = await fetch(`http://localhost:${backendPort}/externalproxy`, {
          headers: { 'Forward-to': PROXY_URL },
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          const current = bareMetalProxySessions.get(key);
          if (current && current.status === 'starting') {
            current.status = 'running';
            current.lastError = undefined;
            bareMetalProxySessions.set(key, current);
          }
        } else {
          // 502 = not ready yet. Retry.
          setTimeout(probeProxy, 3000);
        }
      } catch {
        // Network error / timeout. Retry.
        setTimeout(probeProxy, 3000);
      }
    }
    // Give az a couple of seconds to start before the first probe.
    const readinessTimer = setTimeout(probeProxy, 2000);

    // Collect stdout/stderr lines for the debug log only.
    cmd.stdout.on('data', (data: string) => {
      const latest = bareMetalProxySessions.get(key);
      if (latest) {
        latest.debugLog.push(`[stdout] ${data.toString().trim()}`);
        bareMetalProxySessions.set(key, latest);
      }
    });

    cmd.stderr.on('data', (data: string) => {
      const latest = bareMetalProxySessions.get(key);
      if (latest) {
        const msg = data.toString().trim();
        // Azure CLI frequently writes warnings/progress to stderr even when healthy.
        // Only record genuine errors (not warnings) so the debug log is useful.
        const isWarning =
          /^\s*(WARNING|warn(ing)?)\b/i.test(msg) || /^\s*\[.*\]\s*(WARNING|Info)/i.test(msg);
        latest.debugLog.push(`[stderr] ${msg}`);
        if (!isWarning && latest.status === 'starting') {
          latest.lastError = msg;
        }
        bareMetalProxySessions.set(key, latest);
      }
    });

    cmd.on('exit', (code: number | null) => {
      clearTimeout(readinessTimer);
      const latest = bareMetalProxySessions.get(key);
      if (!latest) {
        return;
      }
      latest.status = code === 0 ? 'stopped' : 'error';
      if (code !== 0 && !latest.lastError) {
        latest.lastError = `Proxy exited with code ${code}`;
      }
      latest.cmd = undefined;
      bareMetalProxySessions.set(key, latest);
    });

    cmd.on('error', (errOrCode: unknown) => {
      clearTimeout(readinessTimer);
      const latest = bareMetalProxySessions.get(key);
      if (!latest) {
        return;
      }
      latest.status = 'error';
      latest.cmd = undefined;
      latest.lastError =
        errOrCode instanceof Error ? errOrCode.message : `Proxy failed: ${String(errOrCode)}`;
      bareMetalProxySessions.set(key, latest);
    });

    return {
      success: true,
      status: 'starting',
      pid: session.pid,
      debugLog: session.debugLog,
    };
  } catch (error) {
    return {
      success: false,
      status: 'error',
      lastError: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Stops a running `az connectedk8s proxy` process for the given BareMetal cluster.
 *
 * If no proxy session exists the call is a no-op and returns `'stopped'`.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the BareMetal cluster.
 */
export async function stopBareMetalProxy(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<BareMetalProxyStatus> {
  const key = bareMetalProxyKey(subscriptionId, resourceGroup, clusterName);
  const session = bareMetalProxySessions.get(key);

  if (!session || !session.cmd) {
    // No cmd handle — proxy was started in a previous session (reconciled state).
    // Try to kill the orphaned az process by port so the user can start fresh.
    if (typeof pluginRunCommand !== 'undefined') {
      try {
        pluginRunCommand('pkill', ['-f', 'connectedk8s proxy --port 47011'], {});
      } catch {
        // ignore
      }
    }
    // Mark session as explicitly stopped so getBareMetalProxyStatus won't re-probe.
    const stopped: BareMetalProxySession = {
      status: 'stopped',
      debugLog: session?.debugLog ?? [],
    };
    bareMetalProxySessions.set(key, stopped);
    return {
      success: true,
      status: 'stopped',
    };
  }

  try {
    const pid = (session.cmd as any).pid as number | undefined;
    if (pid) {
      try {
        // Kill the entire process group (negative PID) so the az subprocess tree
        // is cleaned up, since the proxy is spawned with detached: true.
        process.kill(-pid, 'SIGTERM');
      } catch {
        // Fall back to killing just the child process if group kill fails.
        if (typeof (session.cmd as any).kill === 'function') {
          (session.cmd as any).kill();
        }
      }
    } else if (typeof (session.cmd as any).kill === 'function') {
      (session.cmd as any).kill();
    }
    session.status = 'stopped';
    session.cmd = undefined;
    bareMetalProxySessions.set(key, session);
    return {
      success: true,
      status: 'stopped',
      lastError: session.lastError,
      pid: session.pid,
    };
  } catch (error) {
    session.status = 'error';
    session.lastError = error instanceof Error ? error.message : 'Unknown error';
    bareMetalProxySessions.set(key, session);
    return {
      success: false,
      status: 'error',
      lastError: session.lastError,
      pid: session.pid,
    };
  }
}

/**
 * Restarts the BareMetal proxy by stopping and then starting it again.
 *
 * @param subscriptionId - Azure subscription GUID.
 * @param resourceGroup - Resource group containing the cluster.
 * @param clusterName - Name of the BareMetal cluster.
 */
export async function restartBareMetalProxy(
  subscriptionId: string,
  resourceGroup: string,
  clusterName: string
): Promise<BareMetalProxyStatus> {
  await stopBareMetalProxy(subscriptionId, resourceGroup, clusterName);
  return startBareMetalProxy(subscriptionId, resourceGroup, clusterName);
}
