/**
 * findbugs10.test.ts — Round 10 synthetic fixtures targeting K8s/AKS parser edge cases.
 * Each test was first written as a failing test, then the parser bug was fixed.
 * Focused on patterns commonly encountered by K8s and AKS users.
 */
import { describe, expect, it } from 'vitest';
import { _testing } from './aksAgentManager';

const { extractAIAnswer } = _testing;

function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
}

function makeRaw(bodyLines: string[]): string {
  const prefix = [
    'stty -echo',
    '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent-abc123:/app# ',
    '\x1b[?2004l',
    '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
  ];
  const suffix = ['', '\x1b[?2004hroot@aks-agent-abc123:/app# '];
  return [...prefix, ...bodyLines, ...suffix].join('\n');
}

function extractCodeBlocks(result: string): string[] {
  const blocks: string[] = [];
  let inBlock = false;
  let current: string[] = [];
  for (const line of result.split('\n')) {
    if (/^```/.test(line.trim())) {
      if (inBlock) {
        blocks.push(current.join('\n'));
        current = [];
      }
      inBlock = !inBlock;
      continue;
    }
    if (inBlock) current.push(line);
  }
  return blocks;
}

function assertNoAnsiLeaks(result: string): void {
  expect(result).not.toMatch(/\x1b/);
  expect(result).not.toMatch(/\[\d+m/);
}

describe('findbugs10: K8s/AKS-focused extractAIAnswer edge cases', () => {
  // Bug 1: ANSI stripping corrupted [main] in YAML like `branches: [main]`
  // The orphaned ANSI code regex \[[\d;]*m matched [m in [main], stripping it.
  // Fixed by requiring at least one digit before 'm' in the ANSI pattern.
  it('1. GitHub Actions YAML branches: [main] not corrupted by ANSI stripping', () => {
    const body = [
      'Create .github/workflows/deploy.yml:',
      '',
      panelLine('name: Deploy to AKS'),
      panelLine('on:'),
      panelLine('  push:'),
      panelLine('    branches: [main]'),
      panelLine(''),
      panelLine('jobs:'),
      panelLine('  deploy:'),
      panelLine('    runs-on: ubuntu-latest'),
      panelLine('    steps:'),
      panelLine('    - uses: actions/checkout@v4'),
      panelLine('    - run: kubectl apply -f manifests/'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    expect(result).toContain('[main]');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('branches: [main]');
    expect(all).toContain('kubectl apply');
  });

  // Bug 2: Prometheus [5m] duration stripped by ANSI regex (\[\d[\d;]*m matched [5m)
  // Fixed by adding negative lookahead (?![)\]}\w]) so durations like [5m], [30m] stay.
  it('2. Prometheus [5m] duration selector not corrupted', () => {
    const body = [
      'Create alert rule:',
      '',
      panelLine('apiVersion: monitoring.coreos.com/v1'),
      panelLine('kind: PrometheusRule'),
      panelLine('spec:'),
      panelLine('  groups:'),
      panelLine('  - name: alerts'),
      panelLine('    rules:'),
      panelLine('    - alert: HighLatency'),
      panelLine('      expr: histogram_quantile(0.99, rate(http_duration_seconds_bucket[5m])) > 1'),
      panelLine('      for: 10m'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    // Don't use assertNoAnsiLeaks — [5m] in PromQL is intentional content
    expect(result).not.toMatch(/\x1b/);
    const blocks = extractCodeBlocks(result);
    const all = blocks.join('\n');
    expect(all).toContain('[5m]');
    expect(all).toContain('HighLatency');
    // for: 10m may be outside the code block due to deep-indent handling
    expect(result).toContain('10m');
  });

  // Bug 3: Non-K8s panel YAML (kustomization.yaml) without apiVersion wasn't wrapped
  // in code fences. Panel content at 1-space indent was passed through as plain text.
  // Fixed by adding panel YAML recovery in normalizeTerminalMarkdown.
  it('3. Kustomization YAML in panel gets wrapped in code fence', () => {
    const body = [
      'Create kustomization.yaml:',
      '',
      panelLine('resources:'),
      panelLine('- deployment.yaml'),
      panelLine('- service.yaml'),
      panelLine('- ingress.yaml'),
      panelLine(''),
      panelLine('namePrefix: prod-'),
      panelLine(''),
      panelLine('commonLabels:'),
      panelLine('  app: my-app'),
      panelLine('  env: production'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('resources:');
    expect(all).toContain('namePrefix: prod-');
    expect(all).toContain('commonLabels:');
  });

  // Bug 4: Helm values.yaml panel content (no apiVersion) wasn't wrapped.
  // Same root cause as bug 3 — non-K8s YAML at 1-space indent from panel border.
  it('4. Helm values.yaml in panel gets wrapped in code fence', () => {
    const body = [
      'Create values.yaml:',
      '',
      panelLine('replicaCount: 3'),
      panelLine(''),
      panelLine('image:'),
      panelLine('  repository: myregistry.azurecr.io/myapp'),
      panelLine('  tag: "v1.2.3"'),
      panelLine('  pullPolicy: IfNotPresent'),
      panelLine(''),
      panelLine('service:'),
      panelLine('  type: LoadBalancer'),
      panelLine('  port: 80'),
      panelBlank(),
      '',
      'Install with:',
      '',
      panelLine('helm install my-release ./chart -f values.yaml'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    const all = blocks.join('\n');
    expect(all).toContain('replicaCount: 3');
    expect(all).toContain('pullPolicy: IfNotPresent');
    expect(all).toContain('helm install');
  });

  // Bug 5: Azure DevOps pipeline YAML (trigger:, pool:, steps:) wasn't wrapped.
  // Same panel YAML recovery fix handles this.
  it('5. Azure DevOps pipeline YAML in panel gets wrapped', () => {
    const body = [
      'Create azure-pipelines.yml:',
      '',
      panelLine('trigger:'),
      panelLine('  branches:'),
      panelLine('    include:'),
      panelLine('    - main'),
      panelLine(''),
      panelLine('pool:'),
      panelLine('  vmImage: ubuntu-latest'),
      panelLine(''),
      panelLine('steps:'),
      panelLine('- task: KubernetesManifest@0'),
      panelLine('  inputs:'),
      panelLine('    action: deploy'),
      panelLine('    kubernetesServiceConnection: myAKS'),
      panelLine('    namespace: production'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('trigger:');
    expect(all).toContain('KubernetesManifest');
    expect(all).toContain('kubernetesServiceConnection');
  });

  // Bug 6: Ansible playbook YAML (---/- name:/hosts:/tasks:) wasn't wrapped.
  // Same panel YAML recovery fix.
  it('6. Ansible playbook YAML in panel gets wrapped', () => {
    const body = [
      'Here is the Ansible playbook:',
      '',
      panelLine('---'),
      panelLine('- name: Deploy to AKS'),
      panelLine('  hosts: localhost'),
      panelLine('  tasks:'),
      panelLine('  - name: Login to Azure'),
      panelLine('    azure.azcollection.azure_rm_aks_info:'),
      panelLine('      resource_group: myResourceGroup'),
      panelLine('      name: myAKSCluster'),
      panelLine('  - name: Apply manifests'),
      panelLine('    kubernetes.core.k8s:'),
      panelLine('      state: present'),
      panelLine('      src: manifests/'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('Deploy to AKS');
    expect(all).toContain('azure_rm_aks_info');
    expect(all).toContain('kubernetes.core.k8s');
  });

  // Bug 7: ConfigMap with embedded bash script (init.sh: |) split into multiple blocks.
  // The deeply indented `sleep 2` line broke the block because `sleep` is in
  // AMBIGUOUS_CODE_COMMANDS and the deep-indent check (baseIndent + 4) triggered.
  // Fixed by tracking YAML literal block scalars in the indented-block collector.
  it('7. ConfigMap with literal block scalar bash script stays in one block', () => {
    const body = [
      'Create the ConfigMap:',
      '',
      panelLine('apiVersion: v1'),
      panelLine('kind: ConfigMap'),
      panelLine('metadata:'),
      panelLine('  name: init-script'),
      panelLine('data:'),
      panelLine('  init.sh: |'),
      panelLine('    #!/bin/bash'),
      panelLine('    echo "Initializing..."'),
      panelLine('    until pg_isready -h $DB_HOST; do'),
      panelLine('      echo "Waiting..."'),
      panelLine('      sleep 2'),
      panelLine('    done'),
      panelLine('    echo "Ready!"'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('ConfigMap');
    expect(all).toContain('init.sh');
    expect(all).toContain('sleep 2');
    expect(all).toContain('done');
    // Verify everything is in the SAME block
    const sameBlock = blocks.some(b => b.includes('ConfigMap') && b.includes('sleep 2'));
    expect(sameBlock).toBe(true);
  });

  // Bug 8: Makefile .PHONY directive not detected as code by looksLikeShellOrDockerCodeLine.
  // .PHONY: matched looksLikeYaml (YAML key pattern) instead. Makefile variable
  // assignments (VAR ?=, VAR :=, VAR +=) also not detected.
  // Fixed by adding .PHONY tier 6c and Makefile variable assignment patterns.
  it('8. Makefile .PHONY and variable assignments stay in code block', () => {
    const body = [
      'Create Makefile:',
      '',
      panelLine('.PHONY: build push deploy'),
      panelLine(''),
      panelLine('IMAGE ?= myregistry.azurecr.io/myapp'),
      panelLine('TAG ?= $(shell git rev-parse --short HEAD)'),
      panelLine(''),
      panelLine('build:'),
      panelLine('\tdocker build -t $(IMAGE):$(TAG) .'),
      panelLine(''),
      panelLine('push: build'),
      panelLine('\tdocker push $(IMAGE):$(TAG)'),
      panelLine(''),
      panelLine('deploy: push'),
      panelLine('\tkubectl set image deployment/myapp app=$(IMAGE):$(TAG)'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('.PHONY');
    expect(all).toContain('IMAGE ?=');
    expect(all).toContain('docker build');
  });

  // Bug 9: NGINX config proxy_pass at deep indentation (8+ spaces from panel) broke
  // out of code block because the deep-indent check didn't recognize it as code.
  // Fixed by adding config directive detection (word value;) to looksLikeShellOrDockerCodeLine.
  it('9. NGINX config with proxy_pass stays in one code block', () => {
    const body = [
      'Configure NGINX:',
      '',
      panelLine('server {'),
      panelLine('    listen 80;'),
      panelLine('    server_name myapp.example.com;'),
      panelLine(''),
      panelLine('    location / {'),
      panelLine('        proxy_pass http://localhost:8080;'),
      panelLine('        proxy_set_header Host $host;'),
      panelLine('        proxy_set_header X-Real-IP $remote_addr;'),
      panelLine('    }'),
      panelLine(''),
      panelLine('    location /healthz {'),
      panelLine('        return 200 "OK";'),
      panelLine('    }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(1);
    const all = blocks.join('\n');
    expect(all).toContain('server {');
    expect(all).toContain('proxy_pass');
    expect(all).toContain('location /healthz');
  });

  // Bug 10: Python K8s operator code with deeply nested arguments broke into
  // multiple blocks because namespace=, body= at 8+ spaces weren't detected.
  // Fixed by extending hasStructuredCodeContext check for deep-indent bypass.
  it('10. Python K8s operator with deep nesting stays in one block', () => {
    const body = [
      'Create the operator:',
      '',
      panelLine('import kopf'),
      panelLine(''),
      panelLine('@kopf.on.create("v1", "pods")'),
      panelLine('def create_fn(spec, **kwargs):'),
      panelLine('    result = api.create('),
      panelLine('        namespace="default",'),
      panelLine('        body={'),
      panelLine('            "metadata": {"name": "test"},'),
      panelLine('        }'),
      panelLine('    )'),
      panelLine('    return {"ok": True}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kopf');
    expect(all).toContain('namespace="default"');
    const sameBlock = blocks.some(b => b.includes('kopf') && b.includes('namespace="default"'));
    expect(sameBlock).toBe(true);
  });

  // Bug 11: Grafana dashboard JSON inside ConfigMap literal block (dashboard.json: |)
  // with Prometheus [5m] duration was split and [5m] was corrupted.
  // Fixed by both the ANSI [5m] fix and the literal block tracking fix.
  it('11. Grafana JSON in ConfigMap with [5m] Prometheus duration preserved', () => {
    const body = [
      'Create dashboard ConfigMap:',
      '',
      panelLine('apiVersion: v1'),
      panelLine('kind: ConfigMap'),
      panelLine('metadata:'),
      panelLine('  name: grafana-dashboard'),
      panelLine('data:'),
      panelLine('  dashboard.json: |'),
      panelLine('    {'),
      panelLine('      "title": "Request Rate",'),
      panelLine('      "targets": ['),
      panelLine('        {'),
      panelLine('          "expr": "rate(http_requests_total[5m])"'),
      panelLine('        }'),
      panelLine('      ]'),
      panelLine('    }'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    // Don't use assertNoAnsiLeaks — [5m] in PromQL is intentional content
    expect(result).not.toMatch(/\x1b/);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('[5m]');
    expect(all).toContain('ConfigMap');
    expect(all).toContain('Request Rate');
    const sameBlock = blocks.some(b => b.includes('ConfigMap') && b.includes('[5m]'));
    expect(sameBlock).toBe(true);
  });

  // Bug 12: Docker Compose YAML in panel (version:, services:, ports:) was not wrapped.
  // Same panel YAML recovery fix as bugs 3-6.
  it('12. Docker Compose YAML in panel gets wrapped', () => {
    const body = [
      'Create docker-compose.yml:',
      '',
      panelLine('version: "3.8"'),
      panelLine(''),
      panelLine('services:'),
      panelLine('  app:'),
      panelLine('    build: .'),
      panelLine('    ports:'),
      panelLine('    - "8080:8080"'),
      panelLine('    environment:'),
      panelLine('    - DATABASE_URL=postgres://localhost/mydb'),
      panelLine('  db:'),
      panelLine('    image: postgres:15'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('services:');
    expect(all).toContain('postgres:15');
  });

  // Bug 13: Envoy proxy YAML config (non-K8s, deeply nested) not wrapped in panel.
  // The panel YAML recovery now handles this.
  it('13. Envoy proxy config YAML gets wrapped in panel', () => {
    const body = [
      'Create the Envoy config:',
      '',
      panelLine('static_resources:'),
      panelLine('  listeners:'),
      panelLine('  - name: listener_0'),
      panelLine('    address:'),
      panelLine('      socket_address:'),
      panelLine('        address: 0.0.0.0'),
      panelLine('        port_value: 8080'),
      panelLine('    filter_chains:'),
      panelLine('    - filters:'),
      panelLine('      - name: envoy.filters.network.http_connection_manager'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('static_resources:');
    expect(all).toContain('envoy.filters');
  });

  // Bug 14: Azure Bicep file for AKS with nested blocks stays in one block.
  // The resource keyword at line start is detected by Terraform HCL tier 6b,
  // and hasStructuredCodeContext keeps deeply nested content together.
  it('14. Azure Bicep for AKS stays in one code block', () => {
    const body = [
      'Create main.bicep:',
      '',
      panelLine("resource aks 'Microsoft.ContainerService/managedClusters@2024-01-01' = {"),
      panelLine("  name: 'myAKSCluster'"),
      panelLine('  identity: {'),
      panelLine("    type: 'SystemAssigned'"),
      panelLine('  }'),
      panelLine('  properties: {'),
      panelLine('    agentPoolProfiles: ['),
      panelLine('      {'),
      panelLine("        name: 'agentpool'"),
      panelLine('        count: 3'),
      panelLine("        vmSize: 'Standard_D2s_v3'"),
      panelLine('      }'),
      panelLine('    ]'),
      panelLine('  }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(1);
    const all = blocks.join('\n');
    expect(all).toContain('resource aks');
    expect(all).toContain('agentpool');
    expect(all).toContain('Standard_D2s_v3');
  });

  // Bug 15: kubectl top output preserves millicore values (250m, 500m)
  // without ANSI stripping corruption. The negative lookahead on the ANSI
  // orphan regex prevents [digit m followed by ] or whitespace from matching.
  it('15. kubectl top millicore values not corrupted', () => {
    const body = [
      'Resource usage:',
      '',
      panelLine('$ kubectl top pods -n production'),
      panelLine('NAME                     CPU(cores)   MEMORY(bytes)'),
      panelLine('my-app-7b94c5d4f-abc12   250m         128Mi'),
      panelLine('my-app-7b94c5d4f-def34   100m         96Mi'),
      panelLine('my-app-7b94c5d4f-ghi56   500m         256Mi'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('250m');
    expect(all).toContain('500m');
    expect(all).toContain('128Mi');
    expect(all).toContain('kubectl top');
  });
});
