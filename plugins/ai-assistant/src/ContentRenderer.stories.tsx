// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { Meta, StoryFn } from '@storybook/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import {
  fb1_dockerCompose,
  fb1_twoFileHeadings,
  fb2_bareNonK8sYaml,
  fb2_shellHeredoc,
  fb3_cssPanel,
  fb3_sqlPanel,
  fb4_yamlMergeKey,
  fb5_cIncludeHeaders,
  fb5_shellCaseStatement,
  fb5_terraformHcl,
  fb6_goGoroutineChannel,
  fb6_javaTryCatchFinally,
  fb7_kotlinDataClass,
  fb7_rubyClassMethods,
  fb8_githubActionsYaml,
  fb8_k8sCrdDefinition,
  fb9_phpClassNamespace,
  fb9_scalaCaseClass,
  fb10_configMapLiteralBlock,
  fb10_helmValuesYaml,
  fb11_aksTroubleshooting,
  fb11_dockerBuildSteps,
  fb11_helmTemplateGoExpr,
  fb12_barePrometheusMetrics,
  fb12_coreDNSCorefile,
  fb13_mixedMarkdownFormatting,
  fb13_proseColonEnding,
  fb14_panelCodeThenAlsoConfirm,
  fb15_assumptionsBetweenCodeBlocks,
  fb15_mainPyPanel,
  rawBareYamlService,
  rawBestPractices,
  rawCrashDiagnosis,
  rawJavaDeployOptionAB,
  rawJavaDeployTerminal,
  rawK8sDeployWithCurl,
  rawMicroservicesPythonYaml,
  rawMicroserviceYaml,
  rawMultiResource,
  rawPodStatus,
  rawPythonDeploymentAdvice,
  rawPythonFlaskApp,
  rawRustAxumApp,
  rawRustK8sDeployment,
} from './agent/__tests__/fixtures';
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
    onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
    content={JSON.stringify({
      success: true,
      content: 'Successfully scaled deployment api-server to 5 replicas.',
    })}
  />
);

/** Links to Kubernetes resources. */
export const LinksContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={`Check out the [Kubernetes documentation](https://kubernetes.io/docs/) for more details.

You can also review your [AKS best practices](https://learn.microsoft.com/en-us/azure/aks/best-practices) guide.`}
  />
);

/** Mixed content with multiple element types. */
export const MixedContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
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
      onYamlDetected={noopYamlDetected}
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
      onYamlDetected={noopYamlDetected}
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
        onYamlDetected={noopYamlDetected}
        content={JSON.stringify({
          error: true,
          content: 'Failed to connect to the Kubernetes API server.',
        })}
      />
      <br />
      <ContentRenderer
        onYamlDetected={noopYamlDetected}
        content={JSON.stringify({ success: true, content: 'Successfully scaled deployment.' })}
      />
    </div>
  </ThemeProvider>
);

// ── Edge cases ───────────────────────────────────────────────────────────────

/** Empty string content - should not crash. */
export const EmptyContent: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content="" />
);

/** Plain text with no markdown formatting. */
export const PlainText: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content="This is just plain text with no formatting at all. No bold, no code, no links."
  />
);

/** Content with only inline code - many backtick segments. */
export const InlineCodeOnly: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content="Run `kubectl get pods`, then `kubectl describe pod my-pod`, check `kubectl logs my-pod -f`, and use `kubectl exec -it my-pod -- /bin/bash` to debug."
  />
);

/** Inline code in dark theme - verify inline backtick contrast. */
export const InlineCodeOnlyDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content="Run `kubectl get pods`, then `kubectl describe pod my-pod`, check `kubectl logs my-pod -f`, and use `kubectl exec -it my-pod -- /bin/bash` to debug."
    />
  </ThemeProvider>
);

/** YAML code block (Kubernetes resource). */
export const YamlCodeBlock: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
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
      onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
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
    onYamlDetected={noopYamlDetected}
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
      onYamlDetected={noopYamlDetected}
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

/** YAML code blocks rendered as interactive Monaco editors via YamlDisplay.
 *  Passing onYamlDetected enables the editor rendering path. */
// eslint-disable-next-line no-unused-vars
const noopYamlDetected = (_yaml: string, _resourceType: string) => {};

export const YamlEditorDisplay: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={`Here is a Deployment manifest:

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
        - name: api-server
          image: myregistry/api-server:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
\`\`\`

And the corresponding Service:

\`\`\`yaml
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: production
spec:
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 8080
  selector:
    app: api-server
\`\`\``}
  />
);

// ── Real-world agent response stories (raw exec output → extractAIAnswer → render) ──
// These stories feed raw terminal output (matching real dev console captures) through
// the extractAIAnswer parsing pipeline, then render the result. All identifiers are
// redacted to generic values.

/** Raw exec output → parsed: pod status table with markdown formatting. */
export const RealWorldPodStatus: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(rawPodStatus)} />
);

/** Raw exec output → parsed: diagnostic info with headings, code blocks, lists. */
export const RealWorldCrashDiagnosis: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(rawCrashDiagnosis)} />
);

/** Same crash diagnosis in dark theme. */
export const RealWorldCrashDiagnosisDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawCrashDiagnosis)}
    />
  </ThemeProvider>
);

/** Raw exec output → parsed: bullet list with conversation history echo stripped. */
export const RealWorldBestPractices: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(rawBestPractices)} />
);

/** Raw exec output → parsed: multiple YAML resources with headings. */
export const RealWorldMultiResource: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(rawMultiResource)} />
);

/** Same multi-resource in dark theme. */
export const RealWorldMultiResourceDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawMultiResource)}
    />
  </ThemeProvider>
);

/** Raw exec output → parsed: bare YAML (no code fences) auto-wrapped by parser. */
export const RealWorldBareYamlService: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawBareYamlService)}
  />
);

/** Raw exec output → parsed: terminal-formatted guidance normalized into markdown lists and code blocks. */
export const RealWorldPythonDeploymentAdvice: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawPythonDeploymentAdvice)}
  />
);

// Real-world Java deployment response with Rich terminal-formatted Dockerfile
// and multi-document YAML code blocks (Namespace + Deployment + Service).
// Each code line has [40m (black bg) ANSI formatting and blank lines between
// every line from terminal chunk boundaries.
export const RealWorldJavaDeployTerminal: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawJavaDeployTerminal)}
  />
);

export const RealWorldJavaDeployTerminalDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawJavaDeployTerminal)}
    />
  </ThemeProvider>
);

// ── Real-world Java deploy with Option A / Option B structure ──

export const RealWorldJavaDeployOptionAB: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawJavaDeployOptionAB)}
  />
);

export const RealWorldJavaDeployOptionABDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawJavaDeployOptionAB)}
    />
  </ThemeProvider>
);

// ─── Story: Kubernetes deployment with bare curl command ─────────────────────

export const RealWorldK8sDeployWithCurl: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawK8sDeployWithCurl)}
  />
);

export const RealWorldK8sDeployWithCurlDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawK8sDeployWithCurl)}
    />
  </ThemeProvider>
);

// ─── Story: Large microservice YAML with terminal-wrapped values ─────────────

export const RealWorldMicroserviceYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawMicroserviceYaml)}
  />
);

export const RealWorldMicroserviceYamlDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawMicroserviceYaml)}
    />
  </ThemeProvider>
);

// ─── Microservices YAML with embedded Python & terminal line wrapping ─────────

export const RealWorldMicroservicesPythonYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawMicroservicesPythonYaml)}
  />
);

export const RealWorldMicroservicesPythonYamlDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawMicroservicesPythonYaml)}
    />
  </ThemeProvider>
);

// ─── Python Flask app with __name__ dunder pattern ───────────────────────────

export const RealWorldPythonFlaskApp: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(rawPythonFlaskApp)} />
);

export const RealWorldPythonFlaskAppDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawPythonFlaskApp)}
    />
  </ThemeProvider>
);

// ─── Rust Axum app with method chains and {-blocks ───────────────────────────

export const RealWorldRustAxumApp: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(rawRustAxumApp)} />
);

export const RealWorldRustAxumAppDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(rawRustAxumApp)} />
  </ThemeProvider>
);

export const RealWorldRustK8sDeployment: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(rawRustK8sDeployment)}
  />
);

export const RealWorldRustK8sDeploymentDark: StoryFn<typeof ContentRenderer> = () => (
  <ThemeProvider theme={darkTheme}>
    <CssBaseline />
    <ContentRenderer
      onYamlDetected={noopYamlDetected}
      content={extractAIAnswer(rawRustK8sDeployment)}
    />
  </ThemeProvider>
);

// ── Synthetic fixture stories (round-representative, one per fixture round) ──

export const SyntheticRound01TwoFileHeadings: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb1_twoFileHeadings)}
  />
);

export const SyntheticRound02ShellHeredoc: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb2_shellHeredoc)} />
);

export const SyntheticRound03CssPanel: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb3_cssPanel)} />
);

export const SyntheticRound04YamlMergeKey: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb4_yamlMergeKey)} />
);

export const SyntheticRound05CIncludeHeaders: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb5_cIncludeHeaders)}
  />
);

export const SyntheticRound06JavaTryCatchFinally: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb6_javaTryCatchFinally)}
  />
);

export const SyntheticRound07RubyClassMethods: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb7_rubyClassMethods)}
  />
);

export const SyntheticRound08K8sCrdDefinition: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb8_k8sCrdDefinition)}
  />
);

export const SyntheticRound09ScalaCaseClass: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb9_scalaCaseClass)}
  />
);

export const SyntheticRound10ConfigMapLiteralBlock: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb10_configMapLiteralBlock)}
  />
);

export const SyntheticRound11AksTroubleshooting: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb11_aksTroubleshooting)}
  />
);

export const SyntheticRound12CoreDnsCorefile: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb12_coreDNSCorefile)}
  />
);

export const SyntheticRound13MixedMarkdownNegative: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb13_mixedMarkdownFormatting)}
  />
);

export const SyntheticRound14PanelCodeThenAlsoConfirm: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb14_panelCodeThenAlsoConfirm)}
  />
);

export const SyntheticRound15AssumptionsBetweenCodeBlocks: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb15_assumptionsBetweenCodeBlocks)}
  />
);

// ── Additional synthetic fixture stories ─────────────────────────────────────

export const SyntheticDockerComposeYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb1_dockerCompose)} />
);

export const SyntheticBareNonK8sYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb2_bareNonK8sYaml)}
  />
);

export const SyntheticSqlPanel: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb3_sqlPanel)} />
);

export const SyntheticTerraformHcl: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb5_terraformHcl)} />
);

export const SyntheticShellCaseStatement: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb5_shellCaseStatement)}
  />
);

export const SyntheticGoGoroutineChannel: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb6_goGoroutineChannel)}
  />
);

export const SyntheticKotlinDataClass: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb7_kotlinDataClass)}
  />
);

export const SyntheticGitHubActionsYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb8_githubActionsYaml)}
  />
);

export const SyntheticPhpClassNamespace: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb9_phpClassNamespace)}
  />
);

export const SyntheticHelmValuesYaml: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb10_helmValuesYaml)}
  />
);

export const SyntheticDockerBuildSteps: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb11_dockerBuildSteps)}
  />
);

export const SyntheticHelmTemplateGoExpr: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb11_helmTemplateGoExpr)}
  />
);

export const SyntheticBarePrometheusMetrics: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb12_barePrometheusMetrics)}
  />
);

export const SyntheticProseColonEndingNegative: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer
    onYamlDetected={noopYamlDetected}
    content={extractAIAnswer(fb13_proseColonEnding)}
  />
);

export const SyntheticMainPyFilenameHint: StoryFn<typeof ContentRenderer> = () => (
  <ContentRenderer onYamlDetected={noopYamlDetected} content={extractAIAnswer(fb15_mainPyPanel)} />
);
