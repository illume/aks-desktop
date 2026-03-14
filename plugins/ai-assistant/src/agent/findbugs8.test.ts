/**
 * findbugs8.test.ts — Round 8 synthetic fixtures targeting parser edge cases.
 * Each test is designed to expose a potential parser bug.
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

describe('findbugs8: extractAIAnswer edge cases (round 8)', () => {
  // Bug 1: Go struct literal with field: value syntax looks like YAML
  it('1. Go struct literal with field: value stays in code block', () => {
    const body = [
      'Create the config:',
      '',
      panelLine('config := &Config{'),
      panelLine('    Host:     "localhost",'),
      panelLine('    Port:     8080,'),
      panelLine('    Debug:    true,'),
      panelLine('    MaxConns: 100,'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('config :=');
    expect(all).toContain('Host:');
    expect(all).toContain('MaxConns: 100');
  });

  // Bug 2: Python keyword arguments that look like YAML
  it('2. Python function call with kwargs stays in code block', () => {
    const body = [
      'Configure logging:',
      '',
      panelLine('logging.basicConfig('),
      panelLine('    level=logging.DEBUG,'),
      panelLine('    format="%(asctime)s %(levelname)s %(message)s",'),
      panelLine('    handlers=['),
      panelLine('        logging.StreamHandler(),'),
      panelLine('        logging.FileHandler("app.log"),'),
      panelLine('    ]'),
      panelLine(')'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('logging.basicConfig');
    expect(all).toContain('FileHandler');
  });

  // Bug 3: Shell trap and source commands
  it('3. Shell trap and source commands detected as code', () => {
    const body = [
      'Set up signal handling:',
      '',
      panelLine('#!/bin/bash'),
      panelLine('source /etc/profile.d/kubernetes.sh'),
      panelLine(''),
      panelLine('trap "kubectl delete pod cleanup-$$" EXIT'),
      panelLine('trap "echo interrupted; exit 1" INT TERM'),
      panelLine(''),
      panelLine('kubectl run cleanup-$$ --image=busybox -- sleep 3600'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('#!/bin/bash');
    expect(all).toContain('trap');
  });

  // Bug 4: GitHub Actions workflow YAML with run: multi-line
  it('4. GitHub Actions YAML workflow stays in one block', () => {
    const body = [
      'Add this workflow:',
      '',
      panelLine('name: Deploy'),
      panelLine('on:'),
      panelLine('  push:'),
      panelLine('    branches: [main]'),
      panelLine('jobs:'),
      panelLine('  deploy:'),
      panelLine('    runs-on: ubuntu-latest'),
      panelLine('    steps:'),
      panelLine('      - uses: actions/checkout@v4'),
      panelLine('      - name: Deploy to AKS'),
      panelLine('        run: kubectl apply -f k8s/'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('name: Deploy');
    expect(all).toContain('runs-on');
  });

  // Bug 5: Rust with closures and iterators
  it('5. Rust closures and iterator chains stay in one block', () => {
    const body = [
      'Process the data:',
      '',
      panelLine('let results: Vec<String> = items'),
      panelLine('    .iter()'),
      panelLine('    .filter(|item| item.active)'),
      panelLine('    .map(|item| format!("{}: {}", item.name, item.value))'),
      panelLine('    .collect();'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('let results');
    expect(all).toContain('.collect()');
  });

  // Bug 6: Mixed shell and YAML in a heredoc (already handled?)
  it('6. Shell heredoc with YAML content stays in one block', () => {
    const body = [
      'Create the config:',
      '',
      panelLine('cat <<EOF | kubectl apply -f -'),
      panelLine('apiVersion: v1'),
      panelLine('kind: ConfigMap'),
      panelLine('metadata:'),
      panelLine('  name: app-config'),
      panelLine('data:'),
      panelLine('  DATABASE_URL: postgres://localhost/mydb'),
      panelLine('EOF'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('cat <<EOF');
    expect(all).toContain('apiVersion: v1');
    expect(all).toContain('EOF');
  });

  // Bug 7: Docker Compose with build context and args
  it('7. Docker Compose with build context stays in one block', () => {
    const body = [
      'Create docker-compose.yaml:',
      '',
      panelLine('version: "3.8"'),
      panelLine('services:'),
      panelLine('  api:'),
      panelLine('    build:'),
      panelLine('      context: .'),
      panelLine('      dockerfile: Dockerfile'),
      panelLine('      args:'),
      panelLine('        - RUST_VERSION=1.76'),
      panelLine('    ports:'),
      panelLine('      - "8080:8080"'),
      panelLine('    environment:'),
      panelLine('      - DATABASE_URL=postgres://db:5432/myapp'),
      panelLine('    depends_on:'),
      panelLine('      - db'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('version:');
    expect(all).toContain('depends_on');
  });

  // Bug 8: Shell function definition
  it('8. Shell function definition stays in one block', () => {
    const body = [
      'Add the helper function:',
      '',
      panelLine('check_pod_ready() {'),
      panelLine('  local pod=$1'),
      panelLine('  local ns=${2:-default}'),
      panelLine('  local status'),
      panelLine('  status=$(kubectl get pod "$pod" -n "$ns" -o jsonpath="{.status.phase}")'),
      panelLine('  [ "$status" = "Running" ]'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('check_pod_ready()');
    expect(all).toContain('kubectl get pod');
  });

  // Bug 9: Python with list comprehension and nested function calls
  it('9. Python nested expressions stay in code block', () => {
    const body = [
      'Process pods:',
      '',
      panelLine('import json'),
      panelLine('from kubernetes import client, config'),
      panelLine(''),
      panelLine('config.load_kube_config()'),
      panelLine('v1 = client.CoreV1Api()'),
      panelLine('pods = v1.list_namespaced_pod("default")'),
      panelLine('names = [p.metadata.name for p in pods.items if p.status.phase == "Running"]'),
      panelLine('print(json.dumps(names, indent=2))'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('import json');
    expect(all).toContain('json.dumps');
  });

  // Bug 10: Terraform with providers and multiple blocks
  it('10. Terraform with multiple resource types stays in one block', () => {
    const body = [
      'Add the Terraform config:',
      '',
      panelLine('provider "azurerm" {'),
      panelLine('  features {}'),
      panelLine('}'),
      panelLine(''),
      panelLine('resource "azurerm_kubernetes_cluster" "aks" {'),
      panelLine('  name                = "myaks"'),
      panelLine('  location            = "eastus"'),
      panelLine('  resource_group_name = azurerm_resource_group.rg.name'),
      panelLine('  dns_prefix          = "myaks"'),
      panelLine(''),
      panelLine('  default_node_pool {'),
      panelLine('    name       = "default"'),
      panelLine('    node_count = 3'),
      panelLine('    vm_size    = "Standard_DS2_v2"'),
      panelLine('  }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('provider "azurerm"');
    expect(all).toContain('resource "azurerm_kubernetes_cluster"');
  });

  // Bug 11: SQL with JOIN and subquery
  it('11. SQL JOIN query stays in one code block', () => {
    const body = [
      'Query the data:',
      '',
      panelLine('SELECT'),
      panelLine('    p.name,'),
      panelLine('    p.namespace,'),
      panelLine('    n.capacity_cpu,'),
      panelLine('    n.capacity_memory'),
      panelLine('FROM pods p'),
      panelLine('INNER JOIN nodes n ON p.node_name = n.name'),
      panelLine("WHERE p.status = 'Running'"),
      panelLine('ORDER BY p.name ASC'),
      panelLine('LIMIT 50;'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('SELECT');
    expect(all).toContain('INNER JOIN');
  });

  // Bug 12: Kubernetes CRD YAML
  it('12. K8s CRD definition stays in one YAML block', () => {
    const body = [
      'Create the CRD:',
      '',
      panelLine('apiVersion: apiextensions.k8s.io/v1'),
      panelLine('kind: CustomResourceDefinition'),
      panelLine('metadata:'),
      panelLine('  name: databases.myapp.io'),
      panelLine('spec:'),
      panelLine('  group: myapp.io'),
      panelLine('  versions:'),
      panelLine('    - name: v1'),
      panelLine('      served: true'),
      panelLine('      storage: true'),
      panelLine('      schema:'),
      panelLine('        openAPIV3Schema:'),
      panelLine('          type: object'),
      panelLine('          properties:'),
      panelLine('            spec:'),
      panelLine('              type: object'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('apiextensions.k8s.io');
    expect(all).toContain('openAPIV3Schema');
  });

  // Bug 13: Swift struct with computed properties
  it('13. Swift struct with properties stays in code block', () => {
    const body = [
      'Define the model:',
      '',
      panelLine('struct PodInfo: Codable {'),
      panelLine('    let name: String'),
      panelLine('    let namespace: String'),
      panelLine('    let status: String'),
      panelLine('    var isReady: Bool {'),
      panelLine('        status == "Running"'),
      panelLine('    }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('struct PodInfo');
    expect(all).toContain('isReady');
  });

  // Bug 14: Makefile with ifeq conditional
  it('14. Makefile with ifeq conditional stays in one block', () => {
    const body = [
      'Create the Makefile:',
      '',
      panelLine('REGISTRY ?= docker.io'),
      panelLine('TAG ?= latest'),
      panelLine(''),
      panelLine('ifeq ($(CI),true)'),
      panelLine('  TAG := $(shell git rev-parse --short HEAD)'),
      panelLine('endif'),
      panelLine(''),
      panelLine('.PHONY: build'),
      panelLine('build:'),
      panelLine('\tdocker build -t $(REGISTRY)/myapp:$(TAG) .'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('REGISTRY');
    expect(all).toContain('docker build');
  });

  // Bug 15: Elixir module with functions
  it('15. Elixir module with functions stays in one block', () => {
    const body = [
      'Create the module:',
      '',
      panelLine('defmodule MyApp.K8sClient do'),
      panelLine('  def get_pods(namespace \\\\ "default") do'),
      panelLine('    {:ok, pods} = K8s.Client.list("v1", "Pod", namespace: namespace)'),
      panelLine('    Enum.map(pods, &(&1["metadata"]["name"]))'),
      panelLine('  end'),
      panelLine('end'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('defmodule');
    expect(all).toContain('get_pods');
  });
});
