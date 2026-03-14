/**
 * findbugs9.test.ts — Round 9 synthetic fixtures targeting parser edge cases.
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

describe('findbugs9: extractAIAnswer edge cases (round 9)', () => {
  // Bug 1: TypeScript with generics that look like HTML
  it('1. TypeScript generic types not confused with HTML tags', () => {
    const body = [
      'Create the type-safe client:',
      '',
      panelLine('const client = new KubernetesClient<PodSpec>({'),
      panelLine('  namespace: "default",'),
      panelLine('  timeout: 30000,'),
      panelLine('});'),
      panelLine('const pods = await client.list<Pod>();'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('KubernetesClient');
    expect(all).toContain('client.list');
  });

  // Bug 2: PHP class with namespace
  it('2. PHP class with namespace stays in one block', () => {
    const body = [
      'Create the controller:',
      '',
      panelLine('<?php'),
      panelLine('namespace App\\Controllers;'),
      panelLine(''),
      panelLine('class PodController extends Controller'),
      panelLine('{'),
      panelLine('    public function index(): JsonResponse'),
      panelLine('    {'),
      panelLine("        $pods = $this->k8s->getPods('default');"),
      panelLine('        return response()->json($pods);'),
      panelLine('    }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('<?php');
    expect(all).toContain('class PodController');
  });

  // Bug 3: Scala case class and object
  it('3. Scala case class detected as code', () => {
    const body = [
      'Define the model:',
      '',
      panelLine('case class Pod('),
      panelLine('  name: String,'),
      panelLine('  namespace: String,'),
      panelLine('  status: String'),
      panelLine(')'),
      panelLine(''),
      panelLine('object PodService {'),
      panelLine('  def listPods(ns: String): List[Pod] = {'),
      panelLine('    client.pods.inNamespace(ns).list().getItems.asScala.toList'),
      panelLine('  }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('case class Pod');
    expect(all).toContain('object PodService');
  });

  // Bug 4: Shell with array variables
  it('4. Shell arrays and parameter expansion stay in code block', () => {
    const body = [
      'Deploy to multiple namespaces:',
      '',
      panelLine('NAMESPACES=(staging production canary)'),
      panelLine(''),
      panelLine('for ns in "${NAMESPACES[@]}"; do'),
      panelLine('  echo "Deploying to $ns..."'),
      panelLine('  kubectl apply -f manifests/ -n "$ns"'),
      panelLine('  kubectl rollout status deployment/myapp -n "$ns"'),
      panelLine('done'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('NAMESPACES=');
    expect(all).toContain('done');
  });

  // Bug 5: INI-style config file
  it('5. INI config file detected as code block', () => {
    const body = [
      'Create the config file:',
      '',
      panelLine('[global]'),
      panelLine('scrape_interval = 15s'),
      panelLine('evaluation_interval = 15s'),
      panelLine(''),
      panelLine('[scrape_config]'),
      panelLine('job_name = "kubernetes-pods"'),
      panelLine('kubernetes_sd_configs = ['),
      panelLine('  {role = "pod"}'),
      panelLine(']'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('[global]');
    expect(all).toContain('scrape_interval');
  });

  // Bug 6: Rust with turbofish operator
  it('6. Rust with turbofish and type annotations stays in code block', () => {
    const body = [
      'Parse the config:',
      '',
      panelLine('let config: Config = serde_json::from_str(&data)?;'),
      panelLine('let items = vec.iter().collect::<Vec<_>>();'),
      panelLine('let count = "42".parse::<u32>().unwrap();'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('serde_json');
    expect(all).toContain('collect::<Vec');
  });

  // Bug 7: Multi-line Python string assignment
  it('7. Python multi-line string stays in code block', () => {
    const body = [
      'Create the template:',
      '',
      panelLine('YAML_TEMPLATE = """'),
      panelLine('apiVersion: apps/v1'),
      panelLine('kind: Deployment'),
      panelLine('metadata:'),
      panelLine('  name: {name}'),
      panelLine('  namespace: {namespace}'),
      panelLine('"""'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('YAML_TEMPLATE');
    expect(all).toContain('kind: Deployment');
  });

  // Bug 8: Java Spring Boot with annotations
  it('8. Java Spring Boot service stays in one block', () => {
    const body = [
      'Create the service:',
      '',
      panelLine('@Service'),
      panelLine('public class KubeService {'),
      panelLine('    private final ApiClient client;'),
      panelLine(''),
      panelLine('    @Autowired'),
      panelLine('    public KubeService(ApiClient client) {'),
      panelLine('        this.client = client;'),
      panelLine('    }'),
      panelLine(''),
      panelLine('    public List<V1Pod> listPods() throws ApiException {'),
      panelLine('        CoreV1Api api = new CoreV1Api(client);'),
      panelLine('        return api.listNamespacedPod("default",'),
      panelLine('            null, null, null, null, null, null, null, null, null, null)'),
      panelLine('            .getItems();'),
      panelLine('    }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('@Service');
    expect(all).toContain('listPods');
  });

  // Bug 9: Shell with here-string
  it('9. Shell with here-string stays in code block', () => {
    const body = [
      'Parse the JSON:',
      '',
      panelLine('NODES=$(kubectl get nodes -o json)'),
      panelLine(''),
      panelLine('while read -r name status; do'),
      panelLine('  echo "Node: $name ($status)"'),
      panelLine(
        'done <<< $(echo $NODES | jq -r \'.items[] | "\\(.metadata.name) \\(.status.conditions[-1].type)"\')'
      ),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl get nodes');
    expect(all).toContain('done');
  });

  // Bug 10: Mixed curl commands with JSON body
  it('10. curl with JSON body stays in one block', () => {
    const body = [
      'Test the API:',
      '',
      panelLine('curl -X POST http://localhost:8080/api/deploy \\'),
      panelLine("  -H 'Content-Type: application/json' \\"),
      panelLine("  -d '{"),
      panelLine('    "image": "myapp:v2",'),
      panelLine('    "replicas": 3,'),
      panelLine('    "namespace": "production"'),
      panelLine("  }'"),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('curl -X POST');
    expect(all).toContain('"namespace"');
  });

  // Bug 11: Kotlin coroutine with suspend function
  it('11. Kotlin suspend function stays in code block', () => {
    const body = [
      'Create the repository:',
      '',
      panelLine('suspend fun getPods(namespace: String): List<Pod> {'),
      panelLine('    return withContext(Dispatchers.IO) {'),
      panelLine('        client.pods()'),
      panelLine('            .inNamespace(namespace)'),
      panelLine('            .list()'),
      panelLine('            .items'),
      panelLine('    }'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('suspend fun');
    expect(all).toContain('withContext');
  });

  // Bug 12: HCL locals and data sources
  it('12. Terraform locals and data sources stay in one block', () => {
    const body = [
      'Add the locals:',
      '',
      panelLine('locals {'),
      panelLine('  cluster_name = "${var.prefix}-aks"'),
      panelLine('  tags = {'),
      panelLine('    environment = var.environment'),
      panelLine('    managed_by  = "terraform"'),
      panelLine('  }'),
      panelLine('}'),
      panelLine(''),
      panelLine('data "azurerm_client_config" "current" {}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('locals {');
    expect(all).toContain('data "azurerm_client_config"');
  });

  // Bug 13: Markdown table should not be wrapped as code
  it('13. Markdown table passes through without code wrapping', () => {
    const body = [
      'Here are the pod statuses:',
      '',
      '| Name | Status | Restarts |',
      '|------|--------|----------|',
      '| pod-1 | Running | 0 |',
      '| pod-2 | CrashLoopBackOff | 5 |',
      '| pod-3 | Running | 0 |',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    // Tables should NOT be in code blocks
    expect(result).toContain('| Name | Status |');
    const blocks = extractCodeBlocks(result);
    const all = blocks.join('\n');
    expect(all).not.toContain('| Name |');
  });

  // Bug 14: Shell with process substitution
  it('14. Shell process substitution stays in code block', () => {
    const body = [
      'Compare configs:',
      '',
      panelLine('diff <(kubectl get cm config-a -o yaml) <(kubectl get cm config-b -o yaml)'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('diff');
    expect(all).toContain('kubectl get cm');
  });

  // Bug 15: Python requirements.txt content
  it('15. Requirements.txt content stays in code block', () => {
    const body = [
      'Install these dependencies:',
      '',
      panelLine('flask==3.0.0'),
      panelLine('kubernetes==28.1.0'),
      panelLine('requests>=2.31.0'),
      panelLine('gunicorn~=21.2'),
      panelLine('prometheus-client>=0.17'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('flask==3.0.0');
    expect(all).toContain('kubernetes==28.1.0');
  });
});
