// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { _testing } from './agent/aksAgentManager';
import ContentRenderer from './ContentRenderer';

const { extractAIAnswer } = _testing;

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    sidebar: { selectedBackground: '#555555' },
  },
});

const meta: Meta<typeof ContentRenderer> = {
  title: 'AIAssistant/ContentRenderer',
  component: ContentRenderer,
  decorators: [
    (Story: any) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
};
export default meta;

// ── Light theme stories ──────────────────────────────────────────────────────

/** Simple markdown text with headings and paragraphs. */
export const MarkdownText: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`# Cluster Overview

Your AKS cluster is running **3 nodes** in the \`eastus\` region.

## Node Pools

The default node pool uses \`Standard_DS2_v2\` instances.

### Recommendations

- Consider enabling autoscaling for cost optimization
- Review your pod disruption budgets
- Check resource quotas in each namespace`}
  />
);

/** Code blocks in both inline and block styles. */
export const CodeBlocks: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`To check your cluster status, run \`kubectl get nodes\` in your terminal.

Here's a more detailed command:

\`\`\`bash
kubectl get pods --all-namespaces -o wide
\`\`\`

You can also check the cluster info:

\`\`\`
kubectl cluster-info
Kubernetes control plane is running at https://myaks-dns-12345678.hcp.eastus.azmk8s.io:443
CoreDNS is running at https://myaks-dns-12345678.hcp.eastus.azmk8s.io:443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
\`\`\``}
  />
);

/** Table content with GFM tables. */
export const TableContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`## Pod Status

| Pod Name | Status | Restarts | Age |
|----------|--------|----------|-----|
| api-server-7d8f9 | Running | 0 | 2d |
| worker-abc12 | Running | 1 | 5d |
| frontend-xyz98 | CrashLoopBackOff | 15 | 1d |
| db-migration-job | Completed | 0 | 3h |
| monitoring-agent | Running | 0 | 7d |
| cache-redis-0 | Running | 2 | 4d |
| ingress-nginx-abc | Running | 0 | 10d |`}
  />
);

/** Blockquote and mixed content. */
export const BlockquoteContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`## Important Notes

> **Warning**: The cluster is running low on memory. Consider scaling up your node pool or optimizing resource requests.

Here are the current resource limits:

> CPU: 85% utilized
> Memory: 92% utilized
> Storage: 45% utilized

These values exceed the recommended threshold of 80%.`}
  />
);

/** Error JSON response. */
export const ErrorResponse: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={JSON.stringify({
      error: true,
      content:
        'Failed to connect to the Kubernetes API server. Please check your credentials and network connectivity.',
    })}
  />
);

/** Success JSON response. */
export const SuccessResponse: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={JSON.stringify({
      success: true,
      content: 'Successfully scaled deployment api-server to 5 replicas.',
    })}
  />
);

/** Links to Kubernetes resources. */
export const LinksContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`Check out the [Kubernetes documentation](https://kubernetes.io/docs/) for more details.

You can also review your [AKS best practices](https://learn.microsoft.com/en-us/azure/aks/best-practices) guide.`}
  />
);

/** Mixed content with multiple element types. */
export const MixedContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`# Troubleshooting Guide

Your pod \`frontend-xyz98\` is in a **CrashLoopBackOff** state. Here's what to check:

## Step 1: Check Logs

\`\`\`bash
kubectl logs frontend-xyz98 --previous
\`\`\`

## Step 2: Describe the Pod

| Field | Value |
|-------|-------|
| Status | CrashLoopBackOff |
| Restarts | 15 |
| Last Exit Code | 137 (OOMKilled) |

> **Note**: Exit code 137 typically indicates the container was killed due to exceeding its memory limit.

## Step 3: Increase Memory

Update the resource limits in your deployment:

1. Edit the deployment YAML
2. Increase \`resources.limits.memory\`
3. Apply the changes with \`kubectl apply\``}
  />
);

// ── Dark theme stories ───────────────────────────────────────────────────────

/** Code blocks rendered in dark theme - verifies contrast. */
export const CodeBlocksDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      content={`To check your cluster status, run \`kubectl get nodes\` in your terminal.

Here's a more detailed command:

\`\`\`bash
kubectl get pods --all-namespaces -o wide
\`\`\`

You can also check the cluster info:

\`\`\`
kubectl cluster-info
Kubernetes control plane is running at https://myaks-dns-12345678.hcp.eastus.azmk8s.io:443
CoreDNS is running at https://myaks-dns-12345678.hcp.eastus.azmk8s.io:443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy
\`\`\``}
    />
  </ThemeProvider>
);

/** Mixed content rendered in dark theme - verifies contrast across all element types. */
export const MixedContentDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      content={`# Dark Theme Contrast Check

Your pod \`frontend-xyz98\` is in a **CrashLoopBackOff** state.

## Table

| Pod Name | Status | Restarts |
|----------|--------|----------|
| api-server-7d8f9 | Running | 0 |
| frontend-xyz98 | CrashLoopBackOff | 15 |

> **Note**: Exit code 137 typically indicates OOMKilled.

\`\`\`bash
kubectl logs frontend-xyz98 --previous
\`\`\`

Check the [docs](https://kubernetes.io/docs/) for more.`}
    />
  </ThemeProvider>
);

/** Error and success alerts in dark theme. */
export const AlertsDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <div>
      <ContentRenderer
        content={JSON.stringify({
          error: true,
          content: 'Failed to connect to the Kubernetes API server.',
        })}
      />
      <br />
      <ContentRenderer
        content={JSON.stringify({ success: true, content: 'Successfully scaled deployment.' })}
      />
    </div>
  </ThemeProvider>
);

// ── Edge cases ───────────────────────────────────────────────────────────────

/** Empty string content - should not crash. */
export const EmptyContent: StoryFn<typeof ContentRenderer> = () => <ContentRenderer content="" />;

/** Plain text with no markdown formatting. */
export const PlainText: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer content="This is just plain text with no formatting at all. No bold, no code, no links." />
);

/** Content with only inline code - many backtick segments. */
export const InlineCodeOnly: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer content="Run `kubectl get pods`, then `kubectl describe pod my-pod`, check `kubectl logs my-pod -f`, and use `kubectl exec -it my-pod -- /bin/bash` to debug." />
);

/** Inline code in dark theme - verify inline backtick contrast. */
export const InlineCodeOnlyDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer content="Run `kubectl get pods`, then `kubectl describe pod my-pod`, check `kubectl logs my-pod -f`, and use `kubectl exec -it my-pod -- /bin/bash` to debug." />
  </ThemeProvider>
);

/** YAML code block (Kubernetes resource). */
export const YamlCodeBlock: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`Here's a sample deployment:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
\`\`\``}
  />
);

/** YAML code block in dark theme. */
export const YamlCodeBlockDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      content={`Here's a sample deployment:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.21
        ports:
        - containerPort: 80
\`\`\``}
    />
  </ThemeProvider>
);

/** Deeply nested markdown - headings, lists, bold, inline code together. */
export const DeeplyNestedContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`# Level 1

## Level 2

### Level 3

- Item with **bold** and \`inline code\`
  - Nested item with [a link](https://example.com)
    - Deeply nested with \`more code\`

1. First **ordered** item
2. Second item with \`kubectl get ns\`
3. Third item

> A blockquote with **bold text** and \`code\` inside.
>
> > Nested blockquote for emphasis.`}
  />
);

/** Very long unbroken strings and URLs. */
export const LongUnbrokenStrings: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`The error log contains the following message:

\`\`\`
E0312 21:02:19.886Z controller/manager.go:123 ReconciliationError: unable to reconcile resource aksmanagedcluster/myverylongclustername-in-eastus2-production-environment with the expected state, timeout exceeded after 300 seconds of continuous polling
\`\`\`

Check https://learn.microsoft.com/en-us/azure/aks/troubleshooting-common-issues-with-very-long-urls-that-might-break-layouts for more details.`}
  />
);

/** Multiple sequential code blocks of different languages. */
export const MultipleCodeBlocks: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    content={`First, check with bash:

\`\`\`bash
kubectl get pods -n production
\`\`\`

Then look at the JSON output:

\`\`\`json
{
  "apiVersion": "v1",
  "kind": "Pod",
  "metadata": {
    "name": "api-server-7d8f9",
    "namespace": "production"
  },
  "status": {
    "phase": "Running"
  }
}
\`\`\`

And the YAML manifest:

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: api-server
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 8080
\`\`\``}
  />
);

/** Multiple code blocks in dark theme. */
export const MultipleCodeBlocksDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      content={`Check with bash:

\`\`\`bash
kubectl get pods -n production
\`\`\`

JSON output:

\`\`\`json
{
  "apiVersion": "v1",
  "kind": "Pod",
  "status": { "phase": "Running" }
}
\`\`\`

YAML manifest:

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: api-server
\`\`\``}
    />
  </ThemeProvider>
);

// ── Real-world agent response stories (raw exec output → extractAIAnswer → render) ──
// These stories feed raw terminal output (matching real dev console captures) through
// the extractAIAnswer parsing pipeline, then render the result. All identifiers are
// redacted to generic values.

const rawPodStatus = [
  '\x1b[?2004hroot@aks-agent-abc1234def-x9y8z:/app#',
  "python /app/aks-agent.py ask 'what pods are running?'",
  '\x1b[?2004l',
  "Loaded models: ['gpt-4']",
  'Task List:',
  '+------+------------------+---------+',
  '| ID   | Description      | Status  |',
  '+------+------------------+---------+',
  '| t1   | Check pods       | [~] in_progress |',
  '+------+------------------+---------+',
  'AI: Here are the running pods in the `kube-system` namespace:',
  '',
  '| Pod Name | Status | Restarts |',
  '|----------|--------|----------|',
  '| coredns-7c6bf4f | Running | 0 |',
  '| kube-proxy-abc12 | Running | 0 |',
  '| metrics-server-xyz | Running | 2 |',
  '',
  'All pods are healthy.',
  'root@aks-agent-abc1234def-x9y8z:/app#',
].join('\n');

/** Raw exec output → parsed: pod status table with markdown formatting. */
export const RealWorldPodStatus: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer content={extractAIAnswer(rawPodStatus)} />
);

const rawCrashDiagnosis = [
  '\x1b[?2004hroot@aks-agent-abc1234def-x9y8z:/app#',
  "python /app/aks-agent.py ask 'why is my pod crashing?'",
  '\x1b[?2004l',
  "Loaded models: ['gpt-4']",
  '+------+-------------------+-------------------+',
  '| t1   | Check pod status  | [✓] completed     |',
  '| t2   | Get pod logs      | [✓] completed     |',
  '+------+-------------------+-------------------+',
  'AI: Your pod `web-app-6f8b9c4d7-x2k9p` is in a **CrashLoopBackOff** state. Here is what I found:',
  '',
  '## Root Cause',
  '',
  'The container is failing because it cannot connect to the database. The logs show:',
  '',
  '```',
  'Error: connect ECONNREFUSED 10.0.0.5:5432',
  '    at TCPConnectWrap.afterConnect [as oncomplete]',
  '```',
  '',
  '## Recommended Steps',
  '',
  '1. Check if the database pod is running: `kubectl get pods -l app=postgres`',
  '2. Verify the service endpoint: `kubectl get endpoints postgres-svc`',
  '3. Check network policies that might block traffic between namespaces',
  '',
  '> **Note**: The pod has restarted 15 times in the last hour.',
  'root@aks-agent-abc1234def-x9y8z:/app#',
].join('\n');

/** Raw exec output → parsed: diagnostic info with headings, code blocks, lists. */
export const RealWorldCrashDiagnosis: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer content={extractAIAnswer(rawCrashDiagnosis)} />
);

/** Same crash diagnosis in dark theme. */
export const RealWorldCrashDiagnosisDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer content={extractAIAnswer(rawCrashDiagnosis)} />
  </ThemeProvider>
);

const rawBestPractices = [
  '\x1b[?2004hroot@aks-agent-abc1234def-x9y8z:/app#',
  "python /app/aks-agent.py ask 'IMPORTANT INSTRUCTIONS:",
  '\x1b[?2004l',
  '\x1b[?2004h>',
  '- When returning any YAML content, always wrap it inside a markdown code block using ```yaml ... ``` so it renders properly.',
  '\x1b[?2004l',
  '\x1b[?2004h>',
  '- The conversation history below shows all previously asked questions and your answers.',
  '\x1b[?2004l',
  '\x1b[?2004h>',
  'Now answer the following new question:',
  '\x1b[?2004l',
  '\x1b[?2004h>',
  "what best practices should I follow for AKS?'",
  '\x1b[?2004l',
  "Loaded models: ['gpt-4']",
  'AI: Here are the key best practices for AKS:',
  '',
  '- **Use managed identities** instead of service principals for authentication',
  '- **Enable Azure Policy** to enforce organizational standards',
  '- **Configure autoscaling** for both cluster and pods:',
  '  - Cluster Autoscaler for node pools',
  '  - Horizontal Pod Autoscaler (HPA) for workloads',
  '- **Use Azure CNI** networking for better integration with VNets',
  '- **Enable monitoring** with Container Insights and Prometheus',
  '- **Implement network policies** to control pod-to-pod traffic',
  '- **Use node pools** to separate system and user workloads',
  '',
  'For more details, see the [AKS best practices documentation](https://learn.microsoft.com/en-us/azure/aks/best-practices).',
  'root@aks-agent-abc1234def-x9y8z:/app#',
].join('\n');

/** Raw exec output → parsed: bullet list with conversation history echo stripped. */
export const RealWorldBestPractices: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer content={extractAIAnswer(rawBestPractices)} />
);

const rawMultiResource = [
  '\x1b[?2004hroot@aks-agent-abc1234def-x9y8z:/app#',
  "python /app/aks-agent.py ask 'create a complete app with deployment and service'",
  '\x1b[?2004l',
  "Loaded models: ['gpt-4']",
  '| t1 | Create resources | [✓] completed |',
  'AI: Here is a complete application setup with a Deployment and Service:',
  '',
  '### Deployment',
  '',
  '```yaml',
  'apiVersion: apps/v1',
  'kind: Deployment',
  'metadata:',
  '  name: web-app',
  '  labels:',
  '    app: web-app',
  'spec:',
  '  replicas: 2',
  '  selector:',
  '    matchLabels:',
  '      app: web-app',
  '  template:',
  '    metadata:',
  '      labels:',
  '        app: web-app',
  '    spec:',
  '      containers:',
  '      - name: web',
  '        image: myregistry.azurecr.io/web-app:latest',
  '        ports:',
  '        - containerPort: 3000',
  '        resources:',
  '          requests:',
  '            cpu: 100m',
  '            memory: 128Mi',
  '          limits:',
  '            cpu: 250m',
  '            memory: 256Mi',
  '```',
  '',
  '### Service',
  '',
  '```yaml',
  'apiVersion: v1',
  'kind: Service',
  'metadata:',
  '  name: web-app-svc',
  'spec:',
  '  type: LoadBalancer',
  '  selector:',
  '    app: web-app',
  '  ports:',
  '  - port: 80',
  '    targetPort: 3000',
  '```',
  '',
  'Apply both with: `kubectl apply -f app.yaml`',
  'root@aks-agent-abc1234def-x9y8z:/app#',
].join('\n');

/** Raw exec output → parsed: multiple YAML resources with headings. */
export const RealWorldMultiResource: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer content={extractAIAnswer(rawMultiResource)} />
);

/** Same multi-resource in dark theme. */
export const RealWorldMultiResourceDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer content={extractAIAnswer(rawMultiResource)} />
  </ThemeProvider>
);

const rawBareYamlService = [
  '\x1b[?2004hroot@aks-agent-abc1234def-x9y8z:/app#',
  "python /app/aks-agent.py ask 'create a service'",
  '\x1b[?2004l',
  "\x1b[1mLoaded models:\x1b[0m [\x1b[32m'gpt-4'\x1b[0m]",
  '┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓',
  '┃ Task List                       ┃',
  '┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛',
  '| t1 | Create service | [✓] completed |',
  '\x1b[1mAI:\x1b[0m Here is a Service:',
  '',
  'apiVersion: v1',
  'kind: Service',
  'metadata:',
  '  name: my-service',
  '  namespace: default',
  'spec:',
  '  type: LoadBalancer',
  '  selector:',
  '    app: nginx',
  '  ports:',
  '  - protocol: TCP',
  '    port: 80',
  '    targetPort: 8080',
  '',
  'This Service exposes your application on port 80.',
  'root@aks-agent-abc1234def-x9y8z:/app#',
].join('\n');

/** Raw exec output → parsed: bare YAML (no code fences) auto-wrapped by parser. */
export const RealWorldBareYamlService: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer content={extractAIAnswer(rawBareYamlService)} />
);
