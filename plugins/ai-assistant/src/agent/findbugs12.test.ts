/**
 * findbugs12.test.ts — Round 12 synthetic fixtures targeting K8s/AKS parser edge cases.
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
  // Check for orphaned ANSI codes but exclude Prometheus durations like [5m], [30m]
  // which legitimately appear in PromQL expressions
  expect(result).not.toMatch(/\[\d+m(?![)\]}\w])/);
}

describe('findbugs12: K8s/AKS-focused extractAIAnswer edge cases round 3', () => {
  // Bug 1: Bare PromQL expressions — sum(rate(...)) is not detected as code by any tier.
  // PromQL functions like sum(), rate(), histogram_quantile() don't match known commands,
  // shell syntax, or YAML patterns, so they fall through as prose.
  it('1. bare PromQL expressions detected as code', () => {
    const body = [
      'Use these PromQL queries to monitor:',
      '',
      panelLine('sum(rate(container_cpu_usage_seconds_total{namespace="prod"}[5m])) by (pod)'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('container_cpu_usage_seconds_total');
    expect(all).toContain('[5m]');
  });

  // Bug 2: Bare K8s event messages — "Pulling image ..." is command output that should
  // be in a code block, but starts with an English word not in any command set.
  it('2. bare K8s event messages detected as code', () => {
    const body = [
      'The pod events show:',
      '',
      panelLine('Pulling image "nginx:1.25"'),
      panelLine('Successfully assigned production/web-abc12 to aks-node-0'),
      panelLine('Container image "nginx:1.25" already present on machine'),
      panelLine('Created container nginx'),
      panelLine('Started container nginx'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('Pulling image');
    expect(all).toContain('Started container nginx');
  });

  // Bug 3: Bare scheduling failure messages — "0/3 nodes are available:" from
  // kubectl describe pod output. Starts with "0/3" which doesn't match resource/action.
  it('3. bare scheduling failure messages detected as code', () => {
    const body = [
      'The scheduling error shows:',
      '',
      panelLine('0/3 nodes are available: 1 Insufficient cpu, 2 node(s) had taint'),
      panelLine('{node.kubernetes.io/not-ready: }, that the pod did not tolerate.'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('0/3 nodes are available');
  });

  // Bug 4: Bare Prometheus metric names — metric{label="value"} NNN format is not
  // detected by any code tier. The curly braces don't trigger short-line-with-{.
  it('4. bare Prometheus metric query results detected as code', () => {
    const body = [
      'Current metric values:',
      '',
      panelLine('container_memory_working_set_bytes{namespace="prod",pod="api-abc12"} 134217728'),
      panelLine('container_cpu_usage_seconds_total{namespace="prod",pod="api-abc12"} 45.23'),
      panelLine('kube_pod_status_phase{namespace="prod",phase="Running"} 5'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('container_memory_working_set_bytes');
    expect(all).toContain('kube_pod_status_phase');
  });

  // Bug 5: Bare readiness probe failure messages — English sentences from kubectl
  // describe events. "Readiness" is not a known command, no shell syntax or YAML.
  it('5. bare readiness probe failure messages detected as code', () => {
    const body = [
      'The health check errors show:',
      '',
      panelLine('Readiness probe failed: Get "http://10.0.0.5:8080/healthz": connection refused'),
      panelLine('Liveness probe failed: HTTP probe failed with statuscode: 503'),
      panelLine('Startup probe failed: Get "http://10.0.0.5:8080/ready": context deadline exceeded'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('Readiness probe failed');
    expect(all).toContain('Startup probe failed');
  });

  // Bug 6: CoreDNS Corefile deep nesting — lines at indent > baseIndent+4 that
  // don't match looksLikeShellOrDockerCodeLine (like "lameduck 5s", "pods insecure")
  // trigger the deep-indent break and get dropped from the code block.
  it('6. CoreDNS Corefile with deep nesting stays complete', () => {
    const body = [
      'The CoreDNS Corefile should look like:',
      '',
      panelLine('.:53 {'),
      panelLine('    errors'),
      panelLine('    health {'),
      panelLine('        lameduck 5s'),
      panelLine('    }'),
      panelLine('    ready'),
      panelLine('    kubernetes cluster.local in-addr.arpa ip6.arpa {'),
      panelLine('        pods insecure'),
      panelLine('        fallthrough in-addr.arpa ip6.arpa'),
      panelLine('        ttl 30'),
      panelLine('    }'),
      panelLine('    prometheus :9153'),
      panelLine('    forward . /etc/resolv.conf'),
      panelLine('    cache 30'),
      panelLine('    loop'),
      panelLine('    reload'),
      panelLine('    loadbalance'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('.:53 {');
    expect(all).toContain('kubernetes cluster.local');
    expect(all).toContain('lameduck 5s');
    expect(all).toContain('pods insecure');
    expect(all).toContain('forward . /etc/resolv.conf');
  });

  // Bug 7: PrometheusRule CRD YAML truncation — deep YAML keys like "for: 5m",
  // "labels:", "severity:" at indent > baseIndent+4 trigger the deep-indent break
  // because looksLikeShellOrDockerCodeLine returns false for YAML keys.
  it('7. PrometheusRule CRD YAML with deep rules stays complete', () => {
    const body = [
      'Create the PrometheusRule:',
      '',
      panelLine('apiVersion: monitoring.coreos.com/v1'),
      panelLine('kind: PrometheusRule'),
      panelLine('metadata:'),
      panelLine('  name: app-alerts'),
      panelLine('spec:'),
      panelLine('  groups:'),
      panelLine('  - name: app.rules'),
      panelLine('    rules:'),
      panelLine('    - alert: HighErrorRate'),
      panelLine('      expr: sum(rate(http_requests_total{code=~"5.."}[5m])) > 0.1'),
      panelLine('      for: 5m'),
      panelLine('      labels:'),
      panelLine('        severity: critical'),
      panelLine('      annotations:'),
      panelLine('        summary: High error rate detected'),
      panelLine('        description: Error rate is above 10% for 5 minutes'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('monitoring.coreos.com/v1');
    expect(all).toContain('HighErrorRate');
    expect(all).toContain('severity: critical');
    expect(all).toContain('for: 5m');
  });

  // Bug 8: Deeply nested JSON from az aks show — JSON values at indent > baseIndent+4
  // (e.g. inside nested objects/arrays) trigger the deep-indent break.
  it('8. deeply nested az aks JSON output stays complete', () => {
    const body = [
      'Node pool details:',
      '',
      panelLine('{'),
      panelLine('  "agentPoolProfiles": ['),
      panelLine('    {'),
      panelLine('      "name": "nodepool1",'),
      panelLine('      "count": 3,'),
      panelLine('      "vmSize": "Standard_DS2_v2",'),
      panelLine('      "provisioningState": "Succeeded",'),
      panelLine('      "powerState": {'),
      panelLine('        "code": "Running"'),
      panelLine('      },'),
      panelLine('      "nodeLabels": {'),
      panelLine('        "env": "production"'),
      panelLine('      }'),
      panelLine('    }'),
      panelLine('  ]'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('"name": "nodepool1"');
    expect(all).toContain('"code": "Running"');
    expect(all).toContain('"env": "production"');
  });

  // Bug 9: Bare container crash/restart messages — "Back-off restarting" and
  // "Killing container" are kubectl describe output that should be code.
  it('9. bare container crash messages detected as code', () => {
    const body = [
      'The pod restart events:',
      '',
      panelLine('Back-off restarting failed container my-app in pod my-app-abc12'),
      panelLine('Killing container with a]id docker://abc123def to re-create'),
      panelLine('Container my-app definition changed, will be restarted'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('Back-off restarting');
    expect(all).toContain('definition changed');
  });

  // Bug 10: Bare volume mount failure messages — "MountVolume.SetUp" and "Unable to
  // attach" are kubectl describe output that should be in code blocks.
  it('10. bare volume mount failure messages detected as code', () => {
    const body = [
      'The storage errors show:',
      '',
      panelLine('MountVolume.SetUp failed for volume "data-vol" : secret "app-secret" not found'),
      panelLine('Unable to attach or mount volumes: timed out waiting for the condition'),
      panelLine('AttachVolume.Attach failed for volume "pvc-abc123" : disk not found'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('MountVolume.SetUp failed');
    expect(all).toContain('AttachVolume.Attach failed');
  });

  // Bug 11: Bare image pull failure messages — "Failed to pull image" and similar
  // are kubectl describe output. Starts with English words not in command sets.
  it('11. bare image pull failure messages detected as code', () => {
    const body = [
      'The image pull errors:',
      '',
      panelLine('Failed to pull image "myregistry.azurecr.io/myapp:v2.0.0": rpc error'),
      panelLine('Error response from daemon: manifest for myapp:v2.0.0 not found'),
      panelLine('Normal BackOff 5m (x3 over 10m) kubelet Back-off pulling image'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('Failed to pull image');
    expect(all).toContain('Error response from daemon');
  });

  // Bug 12: Bare node scheduling failure details — "Insufficient cpu" and similar
  // scheduling messages from kubectl describe. Not in any command set.
  it('12. bare scheduling detail messages detected as code', () => {
    const body = [
      'Scheduling failure details:',
      '',
      panelLine('Insufficient cpu (1500m requested vs 1000m available)'),
      panelLine('Insufficient memory (2Gi requested vs 512Mi available)'),
      panelLine('node(s) had volume node affinity conflict'),
      panelLine('node(s) did not match Pod topologySpreadConstraints'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('Insufficient cpu');
    expect(all).toContain('topologySpreadConstraints');
  });

  // Bug 13: Bare container CRI-O log format — "stdout F message" lines without
  // ISO timestamps are not detected by any code tier.
  it('13. bare CRI-O container log lines detected as code', () => {
    const body = [
      'Raw container runtime logs:',
      '',
      panelLine('stdout F Starting application v2.1.0'),
      panelLine('stdout F Connected to database at postgres:5432'),
      panelLine('stdout F Listening on port 8080'),
      panelLine('stderr F Error: connection reset by peer'),
      panelLine('stdout F GET /api/health 200 2ms'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('stdout F Starting application');
    expect(all).toContain('stderr F Error');
  });

  // Bug 14: Bare container event messages (multi-line) — English sentences from
  // kubectl describe events that should be in code blocks. Words like "Pulling",
  // "Created", "Started" are not in any command set.
  it('14. bare multi-line container lifecycle events detected as code', () => {
    const body = [
      'Container lifecycle events:',
      '',
      panelLine('Pulling image "myapp:v2.0.0"'),
      panelLine('Successfully pulled image "myapp:v2.0.0" in 3.2s'),
      panelLine('Created container my-app'),
      panelLine('Started container my-app'),
      panelLine('Liveness probe failed: HTTP probe failed with statuscode: 503'),
      panelLine('Container my-app failed liveness probe, will be restarted'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('Pulling image');
    expect(all).toContain('Liveness probe failed');
  });

  // Bug 15: Bare key=value diagnostic output — lowercase key=value pairs from
  // K8s diagnostic tools (not logfmt with level= prefix, not uppercase ENV vars).
  it('15. bare key=value diagnostic output detected as code', () => {
    const body = [
      'Container runtime info:',
      '',
      panelLine('runtime.name=containerd runtime.version=1.7.2'),
      panelLine('runtime.endpoint=/run/containerd/containerd.sock'),
      panelLine('pod.name=my-app-abc12 namespace=production node=aks-node-0'),
      panelLine('container.id=abc123def456 image=myapp:v2.0.0 state=running'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('runtime.name=containerd');
    expect(all).toContain('container.id=abc123def456');
  });
});
