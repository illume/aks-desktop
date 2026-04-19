# Telemetry & Privacy: Preventing Sensitive Data Leaks

This document describes how AKS Desktop prevents sensitive information from
leaking to Application Insights and other telemetry channels, and provides
guidance for contributors adding new telemetry or logging.

## Why This Matters

Azure Application Insights auto-collects several categories of data by default.
Without explicit configuration, the following can be sent to App Insights:

| Data category | Default SDK behaviour | Risk |
|---|---|---|
| **Page view URLs** | Full URL including path | Cluster names, namespace names, resource names in URL path |
| **AJAX / Fetch requests** | Tracked automatically | K8s API server URLs containing resource identifiers |
| **Unhandled exceptions** | Captured with full message | Error messages may contain subscription IDs, secrets, API URLs |
| **Console output** | `console.log/debug/error/warn` forwarded as Trace telemetry | ALL console output is sent, including debug logs with stderr, cluster topology, exec output |
| **Route changes** | Auto-tracked | Same as page views |

## What We Disable

In `analyticsSetup.ts` the Application Insights JavaScript SDK is configured
with these privacy-critical flags:

```typescript
{
  disableAjaxTracking: true,       // No outgoing HTTP request tracking
  disableFetchTracking: true,      // No Fetch API request tracking
  disableExceptionTracking: true,  // No auto-captured unhandled exceptions
  loggingLevelConsole: 0,          // No console output forwarded as traces
  enableAutoRouteTracking: false,  // No automatic page-view on route change
}
```

Additionally a **telemetry initializer** sanitizes any remaining page-view URLs
by replacing dynamic path segments (cluster names, namespaces, resource names)
with `{id}` placeholders before they leave the browser.

The `trackException()` helper in `analytics.tsx` strips the original error
message and sends only the error *name* (e.g. `TypeError`) with a `[redacted]`
placeholder.

## Guidelines for Contributors

### 1. Never log sensitive data with `console.*`

Because the App Insights SDK **can** forward `console.log`, `console.debug`,
`console.error`, and `console.warn` output as Trace telemetry, treat every
`console.*` call as potentially public. Even with `loggingLevelConsole: 0`
set today, a future configuration change could re-enable it.

**Do not log:**
- Subscription IDs, tenant IDs, client IDs
- Resource group names, cluster names, namespace names, pod names
- Azure CLI stderr (may contain all of the above)
- Tokens, API keys, passwords, connection strings
- Full Kubernetes API URLs (contain namespace and resource names)
- Raw command output (stdout/stderr) from `az`, `kubectl`, etc.

**Instead, use the `DEBUG` flag pattern:**

```typescript
/** Flip to `true` locally when debugging this module. */
const DEBUG = false;

// Always-on: generic message only
console.error('Failed to get cluster status');
// Debug-only: full details available when needed
if (DEBUG) console.debug('  stderr:', stderr);
```

For the `ai-assistant` plugin, use the existing `debugLog()` / `detailLog()`
functions from `agent/debugLog.ts` — they are automatically silent in
production builds and tests.

### 2. Sanitize data sent to App Insights

When calling `trackEvent()` or `trackException()`:

- **`trackEvent(name, properties)`** — The `name` should be a static event
  type string (e.g. `headlamp.delete-resource`). Never include resource names,
  cluster names, or user identifiers in the name or properties.
- **`trackException(error)`** — The error is automatically sanitized by
  `analytics.tsx`. Do not pass custom properties containing sensitive data.

### 3. URL sanitization

The `sanitizeUrl()` function in `analytics.tsx` replaces any URL path segment
that is not in the `KNOWN_ROUTE_SEGMENTS` set with `{id}`. If you add a new
static route, add its path segment to the set so that telemetry correctly
identifies the page type.

### 4. localStorage and token storage

- Never store tokens, API keys, or credentials in `localStorage` in production.
- Use Electron `safeStorage` (OS-level encryption) for persisting secrets.
- The `localStorage` fallback in `github-auth.ts` is gated behind
  `NODE_ENV === 'development'` only.

## Official Microsoft / Azure References

The practices above follow guidance from these official Microsoft sources:

- **[Application Insights JavaScript SDK Configuration](https://learn.microsoft.com/en-us/azure/azure-monitor/app/javascript-sdk-configuration)**
  Documents `disableAjaxTracking`, `disableFetchTracking`,
  `disableExceptionTracking`, `loggingLevelConsole`,
  `addTelemetryInitializer`, and other privacy-relevant config options.

- **[Filtering and Preprocessing Telemetry (API)](https://learn.microsoft.com/en-us/azure/azure-monitor/app/api-filtering-sampling)**
  How to use telemetry initializers and processors to modify or drop telemetry
  items before they are sent. Includes guidance on stripping sensitive fields.

- **[Managing Personal Data in Azure Monitor Logs](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/personal-data-mgmt)**
  Azure's guidance on filtering, obfuscating, and anonymizing personal data
  before ingestion, and how to handle data deletion requests (GDPR).

- **[Azure Security Benchmark — Data Protection](https://learn.microsoft.com/en-us/security/benchmark/azure/security-controls-v2-data-protection)**
  Covers data discovery/classification, access control, encryption, and the
  principle of not logging passwords, tokens, or PII.

- **[Application Insights Telemetry Data Model](https://learn.microsoft.com/en-us/azure/azure-monitor/app/data-model-complete)**
  Describes exactly what fields are collected for each telemetry type
  (requests, dependencies, exceptions, traces, page views, etc.).

- **[Architecture Best Practices for Application Insights (Well-Architected Framework)](https://learn.microsoft.com/en-us/azure/well-architected/service-guides/application-insights)**
  Security, reliability, and cost-optimization best practices including
  keeping instrumentation up-to-date and minimizing data collection.

- **[Data Privacy in the Trusted Cloud](https://azure.microsoft.com/en-us/explore/trusted-cloud/privacy/)**
  Microsoft's high-level privacy commitments for Azure services.

## Applying the Headlamp Submodule Patch

The App Insights SDK configuration lives in the `headlamp` submodule. Changes
are stored as `headlamp-appinsights-sanitization.patch` in the repo root.
To apply:

```bash
cd headlamp
git apply ../headlamp-appinsights-sanitization.patch
```

See [MAINTENANCE.md](../MAINTENANCE.md) for the full fork rebase workflow.
