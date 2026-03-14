/**
 * findbugs7.test.ts — Round 7 synthetic fixtures targeting parser edge cases.
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

describe('findbugs7: extractAIAnswer edge cases (round 7)', () => {
  // Bug 1: Lua code with local/function/end not detected
  it('1. Lua code with local and function detected as code', () => {
    const body = [
      'Create the Lua module:',
      '',
      panelLine('local M = {}'),
      panelLine(''),
      panelLine('function M.setup(opts)'),
      panelLine('  opts = opts or {}'),
      panelLine('  M.debug = opts.debug or false'),
      panelLine('  return M'),
      panelLine('end'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('local M');
    expect(all).toContain('function M.setup');
  });

  // Bug 2: export VAR=value should be detected as shell
  it('2. Export environment variables detected as shell code', () => {
    const body = [
      'Set environment variables:',
      '',
      panelLine('export KUBECONFIG=~/.kube/config'),
      panelLine('export CLUSTER_NAME=my-aks-cluster'),
      panelLine('export RESOURCE_GROUP=my-rg'),
      panelLine('export REGISTRY=myacr.azurecr.io'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('export KUBECONFIG');
    expect(all).toContain('export REGISTRY');
  });

  // Bug 3: awk/sed one-liners should be detected as code
  it('3. awk and sed commands detected as code', () => {
    const body = [
      'Parse the logs:',
      '',
      panelLine("kubectl logs myapp | awk '{print $1, $NF}'"),
      panelLine("kubectl get pods -o json | jq '.items[].metadata.name'"),
      panelLine("sed -i 's/replicas: 1/replicas: 3/g' deployment.yaml"),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('awk');
    expect(all).toContain('sed');
  });

  // Bug 4: CSS/SCSS blocks
  it('4. CSS rules detected as code block', () => {
    const body = [
      'Add these styles:',
      '',
      panelLine('.container {'),
      panelLine('  display: flex;'),
      panelLine('  justify-content: center;'),
      panelLine('  align-items: center;'),
      panelLine('  min-height: 100vh;'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('.container {');
    expect(all).toContain('display: flex');
  });

  // Bug 5: Protocol buffer definitions
  it('5. Protobuf message definition detected as code', () => {
    const body = [
      'Define the protobuf message:',
      '',
      panelLine('syntax = "proto3";'),
      panelLine(''),
      panelLine('message PodMetrics {'),
      panelLine('  string name = 1;'),
      panelLine('  string namespace = 2;'),
      panelLine('  repeated ContainerMetrics containers = 3;'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('syntax = "proto3"');
    expect(all).toContain('message PodMetrics');
  });

  // Bug 6: Systemd unit file
  it('6. Systemd unit file stays in one block', () => {
    const body = [
      'Create the service file:',
      '',
      panelLine('[Unit]'),
      panelLine('Description=My Application'),
      panelLine('After=network.target'),
      panelLine(''),
      panelLine('[Service]'),
      panelLine('Type=simple'),
      panelLine('ExecStart=/usr/bin/myapp'),
      panelLine('Restart=always'),
      panelLine(''),
      panelLine('[Install]'),
      panelLine('WantedBy=multi-user.target'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('[Unit]');
    expect(all).toContain('[Service]');
  });

  // Bug 7: Shell pipe chain split across lines
  it('7. Shell pipe chain with line continuations stays together', () => {
    const body = [
      'Find the top pods:',
      '',
      panelLine('kubectl get pods --all-namespaces -o json \\'),
      panelLine("  | jq '.items[] | {name: .metadata.name, cpu: .spec.containers[].resources}' \\"),
      panelLine('  | sort -k2 -rn \\'),
      panelLine('  | head -10'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl get pods');
    expect(all).toContain('head -10');
  });

  // Bug 8: Mixed env vars and commands in a script
  it('8. Shell script with variables and commands stays together', () => {
    const body = [
      'Run the deploy script:',
      '',
      panelLine('#!/bin/bash'),
      panelLine('set -euo pipefail'),
      panelLine(''),
      panelLine('IMAGE="${REGISTRY}/${APP_NAME}:${VERSION}"'),
      panelLine('docker build -t "$IMAGE" .'),
      panelLine('docker push "$IMAGE"'),
      panelLine('kubectl set image deployment/${APP_NAME} app="$IMAGE"'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('#!/bin/bash');
    expect(all).toContain('kubectl set image');
  });

  // Bug 9: JSON object in panel (not kubectl output)
  it('9. JSON configuration object stays in one block', () => {
    const body = [
      'Add this to package.json scripts:',
      '',
      panelLine('{'),
      panelLine('  "scripts": {'),
      panelLine('    "start": "node server.js",'),
      panelLine('    "build": "tsc && npm run bundle",'),
      panelLine('    "test": "vitest run",'),
      panelLine('    "lint": "eslint src/"'),
      panelLine('  }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('"scripts"');
    expect(all).toContain('"test"');
  });

  // Bug 10: Ruby class with methods
  it('10. Ruby class with methods stays in one block', () => {
    const body = [
      'Create the Ruby model:',
      '',
      panelLine('class KubernetesClient'),
      panelLine('  def initialize(config)'),
      panelLine('    @config = config'),
      panelLine('    @client = Kubeclient::Client.new(config.api_endpoint)'),
      panelLine('  end'),
      panelLine(''),
      panelLine('  def get_pods(namespace)'),
      panelLine('    @client.get_pods(namespace: namespace)'),
      panelLine('  end'),
      panelLine('end'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('class KubernetesClient');
    expect(all).toContain('def get_pods');
  });

  // Bug 11: Kotlin data class
  it('11. Kotlin data class detected as code', () => {
    const body = [
      'Define the data class:',
      '',
      panelLine('data class PodInfo('),
      panelLine('    val name: String,'),
      panelLine('    val namespace: String,'),
      panelLine('    val status: String,'),
      panelLine('    val restarts: Int = 0'),
      panelLine(')'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('data class PodInfo');
    expect(all).toContain('val name');
  });

  // Bug 12: C struct with typedef
  it('12. C struct typedef stays in one code block', () => {
    const body = [
      'Define the struct:',
      '',
      panelLine('typedef struct {'),
      panelLine('    char name[256];'),
      panelLine('    int port;'),
      panelLine('    int replicas;'),
      panelLine('    bool ready;'),
      panelLine('} ServiceConfig;'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('typedef struct');
    expect(all).toContain('ServiceConfig');
  });

  // Bug 13: AKS az commands with --query parameter
  it('13. az CLI commands with JMESPath queries stay in one block', () => {
    const body = [
      'Query the AKS cluster:',
      '',
      panelLine('az aks show \\'),
      panelLine('  --resource-group mygroup \\'),
      panelLine('  --name mycluster \\'),
      panelLine("  --query '{name:name, state:powerState.code, k8s:kubernetesVersion}' \\"),
      panelLine('  --output table'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('az aks show');
    expect(all).toContain('--output table');
  });

  // Bug 14: Python async/await with type hints
  it('14. Python async function with type hints stays in one block', () => {
    const body = [
      'Create the async handler:',
      '',
      panelLine('async def get_pods('),
      panelLine('    client: KubernetesClient,'),
      panelLine('    namespace: str = "default",'),
      panelLine(') -> list[dict[str, Any]]:'),
      panelLine('    pods = await client.list_pods(namespace=namespace)'),
      panelLine('    return [{"name": p.name, "status": p.status} for p in pods]'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('async def get_pods');
    expect(all).toContain('await client');
  });

  // Bug 15: Mixed numbered steps with code (prose + code interlacing)
  it('15. Numbered steps with code blocks render separately', () => {
    const body = [
      '1. Create the secret:',
      '',
      panelLine('kubectl create secret generic db-creds \\'),
      panelLine('  --from-literal=username=admin \\'),
      panelLine('  --from-literal=password=s3cret'),
      panelBlank(),
      '',
      '2. Apply the deployment:',
      '',
      panelLine('kubectl apply -f deployment.yaml'),
      panelBlank(),
      '',
      '3. Verify everything is running:',
      '',
      panelLine('kubectl get all -n production'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    const all = blocks.join('\n');
    expect(all).toContain('create secret');
    expect(all).toContain('kubectl apply');
    expect(all).toContain('kubectl get all');
  });
});
