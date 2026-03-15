/**
 * debug12.test.ts — Debug test to understand why tests 5, 9, 10, 11, 12 pass
 * when they should fail due to deep-indent breaks.
 */
import { describe, it } from 'vitest';
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

function extractCodeBlocks(result: string): Array<{type: string, content: string}> {
  const blocks: Array<{type: string, content: string}> = [];
  let inBlock = false;
  let blockType = '';
  let current: string[] = [];
  for (const line of result.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      if (inBlock) {
        blocks.push({ type: blockType, content: current.join('\n') });
        current = [];
        inBlock = false;
      } else {
        // Extract language after ```
        blockType = trimmed.substring(3).trim() || 'plain';
        inBlock = true;
      }
      continue;
    }
    if (inBlock) current.push(line);
  }
  return blocks;
}

describe('debug12: Understanding why tests 5, 9, 10, 11, 12 pass', () => {
  it('Debug test 5: bare etcd endpoint status CSV', () => {
    const body = [
      'Etcd endpoint status:',
      '',
      panelLine('https://10.0.0.10:2379, 8e9e05c52164694d, 3.5.9, 25 MB, true, false, 12, 1547564'),
      panelLine('https://10.0.0.11:2379, ade526d28b1f92f7, 3.5.9, 25 MB, false, false, 12, 1547564'),
      panelLine('https://10.0.0.12:2379, d282ac2ce600c1ce, 3.5.9, 25 MB, false, false, 12, 1547564'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    const blocks = extractCodeBlocks(result);
    console.log('\n========== TEST 5: etcd CSV ==========');
    console.log('Number of code blocks:', blocks.length);
    blocks.forEach((block, i) => {
      console.log(`\nBlock ${i} (type: ${block.type}):`);
      console.log('---');
      console.log(block.content);
      console.log('---');
    });
  });

  it('Debug test 9: HPA YAML with deep metrics', () => {
    const body = [
      'Create the HPA:',
      '',
      panelLine('apiVersion: autoscaling/v2'),
      panelLine('kind: HorizontalPodAutoscaler'),
      panelLine('metadata:'),
      panelLine('  name: my-app-hpa'),
      panelLine('spec:'),
      panelLine('  scaleTargetRef:'),
      panelLine('    apiVersion: apps/v1'),
      panelLine('    kind: Deployment'),
      panelLine('    name: my-app'),
      panelLine('  minReplicas: 2'),
      panelLine('  maxReplicas: 10'),
      panelLine('  metrics:'),
      panelLine('  - type: Resource'),
      panelLine('    resource:'),
      panelLine('      name: cpu'),
      panelLine('      target:'),
      panelLine('        type: Utilization'),
      panelLine('        averageUtilization: 70'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    const blocks = extractCodeBlocks(result);
    console.log('\n========== TEST 9: HPA YAML ==========');
    console.log('Number of code blocks:', blocks.length);
    blocks.forEach((block, i) => {
      console.log(`\nBlock ${i} (type: ${block.type}):`);
      console.log('---');
      console.log(block.content);
      console.log('---');
    });
  });

  it('Debug test 10: Istio DestinationRule with deep traffic policy', () => {
    const body = [
      'Create the DestinationRule:',
      '',
      panelLine('apiVersion: networking.istio.io/v1beta1'),
      panelLine('kind: DestinationRule'),
      panelLine('metadata:'),
      panelLine('  name: my-app-dr'),
      panelLine('spec:'),
      panelLine('  host: my-app-svc'),
      panelLine('  trafficPolicy:'),
      panelLine('    connectionPool:'),
      panelLine('      tcp:'),
      panelLine('        maxConnections: 100'),
      panelLine('      http:'),
      panelLine('        h2UpgradePolicy: DEFAULT'),
      panelLine('        maxRequestsPerConnection: 10'),
      panelLine('    outlierDetection:'),
      panelLine('      consecutive5xxErrors: 5'),
      panelLine('      interval: 30s'),
      panelLine('      baseEjectionTime: 30s'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    const blocks = extractCodeBlocks(result);
    console.log('\n========== TEST 10: Istio DestinationRule ==========');
    console.log('Number of code blocks:', blocks.length);
    blocks.forEach((block, i) => {
      console.log(`\nBlock ${i} (type: ${block.type}):`);
      console.log('---');
      console.log(block.content);
      console.log('---');
    });
  });

  it('Debug test 11: Deployment with deep tolerations', () => {
    const body = [
      'Apply the Deployment:',
      '',
      panelLine('apiVersion: apps/v1'),
      panelLine('kind: Deployment'),
      panelLine('metadata:'),
      panelLine('  name: my-app'),
      panelLine('spec:'),
      panelLine('  template:'),
      panelLine('    spec:'),
      panelLine('      tolerations:'),
      panelLine('      - key: "node.kubernetes.io/not-ready"'),
      panelLine('        operator: "Exists"'),
      panelLine('        effect: "NoExecute"'),
      panelLine('        tolerationSeconds: 300'),
      panelLine('      containers:'),
      panelLine('      - name: my-app'),
      panelLine('        image: myapp:latest'),
      panelLine('        resources:'),
      panelLine('          requests:'),
      panelLine('            cpu: 100m'),
      panelLine('            memory: 128Mi'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    const blocks = extractCodeBlocks(result);
    console.log('\n========== TEST 11: Deployment with tolerations ==========');
    console.log('Number of code blocks:', blocks.length);
    blocks.forEach((block, i) => {
      console.log(`\nBlock ${i} (type: ${block.type}):`);
      console.log('---');
      console.log(block.content);
      console.log('---');
    });
  });

  it('Debug test 12: StatefulSet with deep volumeClaimTemplates', () => {
    const body = [
      'Create the StatefulSet:',
      '',
      panelLine('apiVersion: apps/v1'),
      panelLine('kind: StatefulSet'),
      panelLine('metadata:'),
      panelLine('  name: postgres'),
      panelLine('spec:'),
      panelLine('  serviceName: postgres'),
      panelLine('  replicas: 3'),
      panelLine('  template:'),
      panelLine('    spec:'),
      panelLine('      containers:'),
      panelLine('      - name: postgres'),
      panelLine('        image: postgres:15'),
      panelLine('        volumeMounts:'),
      panelLine('        - name: data'),
      panelLine('          mountPath: /var/lib/postgresql/data'),
      panelLine('  volumeClaimTemplates:'),
      panelLine('  - metadata:'),
      panelLine('      name: data'),
      panelLine('    spec:'),
      panelLine('      accessModes: ["ReadWriteOnce"]'),
      panelLine('      storageClassName: managed-premium'),
      panelLine('      resources:'),
      panelLine('        requests:'),
      panelLine('          storage: 10Gi'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    const blocks = extractCodeBlocks(result);
    console.log('\n========== TEST 12: StatefulSet with volumeClaimTemplates ==========');
    console.log('Number of code blocks:', blocks.length);
    blocks.forEach((block, i) => {
      console.log(`\nBlock ${i} (type: ${block.type}):`);
      console.log('---');
      console.log(block.content);
      console.log('---');
    });
  });
});
