/**
 * findbugs13.test.ts — Round 13 synthetic fixtures: negative examples.
 * These tests verify that non-code prose and markdown formatting are NOT
 * incorrectly detected as code and wrapped in code fences.
 * Each test was first written as a failing test, then the parser bug was fixed.
 * Coverage: prose with colons, markdown headers, bullet lists, numbered lists,
 * bold/italic formatting, questions, URLs, parentheticals, technical prose,
 * multi-paragraph explanations, and mixed formatting.
 */
import { describe, expect, it } from 'vitest';
import { _testing } from './aksAgentManager';

const { extractAIAnswer } = _testing;

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
  expect(result).not.toMatch(/\[\d+m(?![)\]}\w])/);
}

describe('findbugs13: negative examples — non-code prose should NOT be in code fences', () => {
  // Negative 1: Prose sentence ending with colon should not become a code block.
  // "Send one of these and I'll diagnose it:" is pure prose that was being
  // misclassified as a YAML key due to the trailing colon.
  it('1. prose sentence ending with colon is not code', () => {
    const body = [
      "Send one of these and I'll diagnose it:",
      '',
      'You can also describe what went wrong in your own words.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    // The prose should NOT be inside any code block
    for (const block of blocks) {
      expect(block).not.toContain('diagnose it');
    }
    // No empty code blocks should be generated
    for (const block of blocks) {
      expect(block.trim()).not.toBe('');
    }
  });

  // Negative 2: "No obvious pod problems right now:" followed by prose explanation.
  // The colon at the end triggered YAML key detection, producing an empty code block.
  it('2. diagnostic summary ending with colon is not code', () => {
    const body = [
      'No obvious pod problems right now:',
      '',
      'If you want, I can dig into why those restarted by describing those pods and',
      'pulling their previous logs.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('pod problems');
      expect(block.trim()).not.toBe('');
    }
    expect(result).toContain('No obvious pod problems right now:');
  });

  // Negative 3: "Build + push:" heading followed by actual code.
  // The colon triggered YAML detection, producing an empty code block before the real code.
  it('3. step heading ending with colon does not produce empty code block', () => {
    const body = [
      'Build + push:',
      '',
      'export IMAGE=ghcr.io/<you>/rust-app:0.1.0',
      'docker build -t $IMAGE .',
      'docker push $IMAGE',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    // No empty code blocks
    for (const block of blocks) {
      expect(block.trim()).not.toBe('');
    }
    // "Build + push:" should be prose, not inside a code block
    for (const block of blocks) {
      expect(block).not.toContain('Build + push:');
    }
  });

  // Negative 4: "Assumes:" heading followed by Dockerfile content.
  // Produces empty code block from "Assumes:" then separates Dockerfile into another block.
  it('4. assumptions heading with colon does not produce empty code block', () => {
    const body = [
      'Assumes:',
      '',
      'FROM golang:1.22-bookworm AS builder',
      'WORKDIR /src',
      'COPY go.mod go.sum ./',
      'RUN go mod download',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    // No empty code blocks
    for (const block of blocks) {
      expect(block.trim()).not.toBe('');
    }
    // "Assumes:" should be prose
    for (const block of blocks) {
      expect(block).not.toContain('Assumes:');
    }
  });

  // Negative 5: Markdown bold text with technical terms should not be code.
  // Bold formatting like **deployment** or **pod** should stay as markdown.
  it('5. markdown bold text with k8s terms is not code', () => {
    const body = [
      'The **deployment** is running in the **kube-system** namespace.',
      'Check the **pod** status with the command above.',
      'The **service** endpoint should be reachable at port 443.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('deployment');
      expect(block).not.toContain('kube-system');
    }
  });

  // Negative 6: Markdown bullet list with technical terms should not be code.
  // Lines starting with "- " followed by prose are markdown lists, not shell code.
  it('6. markdown bullet list with technical terms is not code', () => {
    const body = [
      'Common reasons for pod restarts:',
      '',
      '- Out of memory (OOMKilled)',
      '- Liveness probe failure',
      '- Image pull errors',
      '- CrashLoopBackOff due to application bugs',
      '- Volume mount failures',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('OOMKilled');
      expect(block).not.toContain('Liveness probe');
      expect(block).not.toContain('CrashLoopBackOff');
    }
  });

  // Negative 7: Numbered list with steps should not be code.
  // "1. Create the deployment" looks like an ordered list, not code.
  it('7. numbered step list with k8s actions is not code', () => {
    const body = [
      'Follow these steps:',
      '',
      '1. Create the deployment using the YAML above',
      '2. Verify pods are running with kubectl get pods',
      '3. Check the service endpoints',
      '4. Test connectivity from another pod',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('Create the deployment');
      expect(block).not.toContain('Verify pods are');
    }
  });

  // Negative 8: Markdown headers should not be code.
  // "## Troubleshooting" and "### Step 1" are markdown headers, not YAML comments.
  it('8. markdown headers are not YAML comments or code', () => {
    const body = [
      '## Troubleshooting Pod Restarts',
      '',
      'Here are some things to check when pods keep restarting.',
      '',
      '### Step 1: Check Pod Events',
      '',
      'Look at the events section of the pod describe output.',
      '',
      '### Step 2: Check Logs',
      '',
      'Pull the previous container logs to see what happened.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('Troubleshooting');
      expect(block).not.toContain('Step 1');
      expect(block).not.toContain('Step 2');
    }
  });

  // Negative 9: Prose with URLs should not be code.
  // URLs contain slashes which trigger file-path detection.
  it('9. prose with URLs is not code', () => {
    const body = [
      'For more information, see the Kubernetes documentation:',
      'https://kubernetes.io/docs/concepts/workloads/pods/',
      '',
      'You can also check the Azure AKS troubleshooting guide at',
      'https://learn.microsoft.com/en-us/azure/aks/troubleshooting',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('kubernetes.io');
      expect(block).not.toContain('microsoft.com');
    }
  });

  // Negative 10: Prose explanation with "Note:" prefix.
  // "Note: ..." with a short explanation was being treated as YAML.
  it('10. note prefix with explanation is not code', () => {
    const body = [
      'Note: the above configuration assumes you have cluster-admin permissions.',
      'If you are using a restricted RBAC role, you may need to request additional',
      'access from your platform team.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('cluster-admin');
      expect(block).not.toContain('assumes you');
    }
  });

  // Negative 11: Multi-paragraph explanation with technical terms.
  // Prose paragraphs discussing technical topics should not be detected as code.
  it('11. multi-paragraph technical explanation is not code', () => {
    const body = [
      'The pod is in CrashLoopBackOff because the container exits immediately.',
      'This usually means the application crashed during startup.',
      '',
      'Common causes include missing environment variables, incorrect',
      'database connection strings, or insufficient memory limits.',
      '',
      'I recommend checking the previous container logs first.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('CrashLoopBackOff');
      expect(block).not.toContain('Common causes');
      expect(block).not.toContain('recommend');
    }
  });

  // Negative 12: Prose with inline code backticks.
  // Text like "use `kubectl get pods`" should keep the backtick inline code
  // but the surrounding prose should not become a code block.
  it('12. prose with inline code backticks is not wrapped in code fence', () => {
    const body = [
      'You can check the status by running `kubectl get pods -n kube-system`.',
      'The output should show all pods in Running state.',
      'If any show `CrashLoopBackOff`, check their logs with `kubectl logs`.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('You can check the status');
      expect(block).not.toContain('output should show');
    }
  });

  // Negative 13: Short colon-prefixed labels that look like YAML keys.
  // Lines like "Status: Running" in prose context should not start YAML blocks
  // when they are part of a descriptive sentence.
  it('13. prose with colon-separated key-value descriptions is not YAML', () => {
    const body = [
      "Here's what I found:",
      '',
      'The cluster has 3 node pools with a total of 12 nodes.',
      'All nodes show Ready status and have sufficient resources.',
      'The API server is responding normally with no error spikes.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('cluster has');
      expect(block).not.toContain('All nodes');
      expect(block.trim()).not.toBe('');
    }
  });

  // Negative 14: Prose question with technical terms.
  // Questions like "Which namespace is the deployment in?" should not be code.
  it('14. questions about k8s resources are not code', () => {
    const body = [
      'A few questions to narrow this down:',
      '',
      'Which namespace is the deployment in?',
      'How many replicas are configured?',
      'Are there any resource limits set on the containers?',
      'Is the cluster using a custom CNI plugin?',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('namespace');
      expect(block).not.toContain('replicas');
      expect(block).not.toContain('resource limits');
    }
  });

  // Negative 15: Mixed markdown formatting (bold, italic, lists, headers).
  // Complex markdown with multiple formatting types should all remain as prose.
  it('15. mixed markdown formatting is not code', () => {
    const body = [
      '## Summary',
      '',
      "Your cluster looks **healthy** overall. Here's what I checked:",
      '',
      '- **Node status**: all 6 nodes are _Ready_',
      '- **Pod health**: 42/45 pods running (3 in Pending)',
      '- **Resource usage**: ~60% CPU, ~70% memory',
      '',
      'The 3 pending pods are waiting for node scale-up.',
      'This should resolve within 5-10 minutes as the autoscaler kicks in.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('healthy');
      expect(block).not.toContain('Node status');
      expect(block).not.toContain('Pod health');
      expect(block).not.toContain('pending pods');
    }
  });
});
