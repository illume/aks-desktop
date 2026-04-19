# Telemetry Privacy

How we prevent sensitive data from reaching Application Insights.

## The Problem

The App Insights JavaScript SDK ships with defaults that would send cluster
names, namespace names, resource names, subscription IDs, and API server URLs
to Azure telemetry. Out of the box it auto-collects:

- **Page view URLs** — paths like `/c/my-cluster/secrets/production/db-creds`
- **AJAX / Fetch calls** — every outgoing HTTP request, including K8s API calls
- **Unhandled exceptions** — full error messages that may embed resource identifiers
- **Route changes** — same URL exposure as page views

None of that should leave the browser.

## What We Disable

`analyticsSetup.ts` configures the SDK to stop auto-collecting:

```typescript
{
  disableAjaxTracking: true,
  disableFetchTracking: true,
  disableExceptionTracking: true,
  enableAutoRouteTracking: false,
}
```

A **telemetry initializer** rewrites any remaining page-view URLs, replacing
dynamic path segments (cluster names, namespaces, resource names) with `{id}`.

`trackException()` in `analytics.tsx` strips the error message and sends only
the error class name (e.g. `TypeError`) with a `[redacted]` placeholder.

## Rules for Contributors

### Console output

Even though the SDK (v3.x) does not auto-forward `console.*` to App Insights,
treat every `console.*` call as if it could be captured — crash reporters,
Electron DevTools logs, and future SDK versions may surface it.

**Never log** subscription IDs, tenant IDs, resource groups, cluster names,
namespace names, pod names, tokens, API keys, raw CLI stderr/stdout, or full
Kubernetes API URLs.

Use the `DEBUG` flag at the top of each file:

```typescript
const DEBUG = false;

console.error('Failed to get cluster status');
if (DEBUG) console.debug('  stderr:', stderr);
```

The `ai-assistant` plugin uses `debugLog()` from `agent/debugLog.ts` instead —
it is automatically silent outside development builds.

### trackEvent / trackException

- `trackEvent(name)` — use static event names only (`headlamp.delete-resource`).
  No resource names, cluster names, or user identifiers in the name or properties.
- `trackException(error)` — sanitized automatically. Do not attach sensitive
  custom properties.

### Adding a new route

If you add a new static route path, add its segment to `KNOWN_ROUTE_SEGMENTS`
in `analytics.tsx` so the URL sanitizer keeps it readable in telemetry.

### Token storage

Never persist tokens or API keys in `localStorage` in production. Use Electron
`safeStorage`. The `localStorage` fallback in `github-auth.ts` is gated behind
`NODE_ENV === 'development'`.

## Azure / Microsoft References

- [App Insights JS SDK Configuration](https://learn.microsoft.com/en-us/azure/azure-monitor/app/javascript-sdk-configuration) —
  `disableAjaxTracking`, `disableFetchTracking`, `addTelemetryInitializer`, etc.
- [Filtering and Preprocessing Telemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/api-filtering-sampling) —
  telemetry initializers and processors for stripping sensitive fields.
- [Managing Personal Data in Azure Monitor Logs](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/personal-data-mgmt) —
  filtering, obfuscating, and deleting personal data (GDPR).
- [Azure Security Benchmark — Data Protection](https://learn.microsoft.com/en-us/security/benchmark/azure/security-controls-v2-data-protection) —
  never log passwords, tokens, or PII.
- [App Insights Telemetry Data Model](https://learn.microsoft.com/en-us/azure/azure-monitor/app/data-model-complete) —
  what fields are collected per telemetry type.

## Applying the Headlamp Patch

The SDK configuration lives in the `headlamp` submodule. Changes are stored as
`headlamp-appinsights-sanitization.patch` in the repo root:

```bash
cd headlamp
git apply ../headlamp-appinsights-sanitization.patch
```

See [MAINTENANCE.md](../MAINTENANCE.md) for the fork rebase workflow.
