/**
 * findbugs3.test.ts — Round 3 synthetic fixtures targeting parser edge cases.
 * Each test was designed to expose a specific bug, then the bug was fixed.
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

describe('findbugs3: extractAIAnswer edge cases (round 3)', () => {
  // ── 1. Heredoc with quoted delimiter ──
  it("1. heredoc with quoted delimiter <<'YAML'", () => {
    const body = ["cat <<'YAML'", 'apiVersion: v1', 'kind: Service', 'YAML'];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    expect(result).toContain("cat <<'YAML'");
    const blocks = extractCodeBlocks(result);
    // Heredoc body should NOT be in a separate yaml block
    const yamlInSeparateBlock = blocks.some(
      b => b.includes('apiVersion:') && !b.includes("cat <<'YAML'")
    );
    expect(yamlInSeparateBlock).toBe(false);
  });

  // ── 2. Bare YAML list with nested keys ──
  it('2. bare YAML list with nested keys at column 0', () => {
    const body = [
      '- name: nginx',
      '  image: nginx:latest',
      '  ports:',
      '    - containerPort: 80',
      '- name: redis',
      '  image: redis:7',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks.join('\n')).toContain('- name: nginx');
    expect(blocks.join('\n')).toContain('containerPort: 80');
  });

  // ── 3. Numbered list with periods (1. 2. 3.) and code ──
  it('3. numbered list with periods and interleaved code panels', () => {
    const body = [
      '1. Create the file:',
      panelBlank(),
      panelLine('touch app.yaml'),
      panelBlank(),
      '2. Edit it:',
      panelBlank(),
      panelLine('vim app.yaml'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    // These already have proper formatting — they should pass through
    expect(result).toContain('1.');
    expect(result).toContain('2.');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  // ── 4. Makefile with .PHONY and multiple targets ──
  it('4. Makefile with .PHONY and multiple targets', () => {
    const body = [
      panelBlank(),
      panelLine('.PHONY: build test clean'),
      panelBlank(),
      panelLine('build:'),
      panelLine('\tgo build -o app .'),
      panelBlank(),
      panelLine('test:'),
      panelLine('\tgo test ./...'),
      panelBlank(),
      panelLine('clean:'),
      panelLine('\trm -f app'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const allContent = blocks.join('\n');
    expect(allContent).toContain('build:');
    expect(allContent).toContain('clean:');
  });

  // ── 5. tee heredoc — common K8s pattern ──
  it('5. tee heredoc for K8s manifest creation', () => {
    const body = [
      'kubectl apply -f - <<EOF',
      'apiVersion: v1',
      'kind: Namespace',
      'metadata:',
      '  name: test',
      'EOF',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    expect(result).toContain('kubectl apply');
    const blocks = extractCodeBlocks(result);
    // The heredoc body should be in the same block as kubectl apply
    const yamlInSeparateBlock = blocks.some(
      b => b.includes('apiVersion:') && !b.includes('kubectl apply')
    );
    expect(yamlInSeparateBlock).toBe(false);
  });

  // ── 6. CSS-like code in panel (not shell, not YAML) ──
  it('6. CSS code in panel should be wrapped', () => {
  const body = [
    panelBlank(),
    panelLine('body {'),
    panelLine('  margin: 0;'),
    panelLine('  padding: 0;'),
    panelLine('}'),
    panelBlank(),
  ];
  const result = extractAIAnswer(makeRaw(body));
  assertNoAnsiLeaks(result);
  const blocks = extractCodeBlocks(result);
  expect(blocks.length).toBeGreaterThanOrEqual(1);
  expect(blocks.join('\n')).toContain('body {');
});

// ── 7. SQL query in panel ──
it('7. SQL query in panel should be wrapped', () => {
  const body = [
    panelBlank(),
    panelLine('SELECT name, age'),
    panelLine('FROM users'),
    panelLine('WHERE age > 18'),
    panelLine('ORDER BY name;'),
    panelBlank(),
  ];
  const result = extractAIAnswer(makeRaw(body));
  assertNoAnsiLeaks(result);
  const blocks = extractCodeBlocks(result);
  expect(blocks.length).toBeGreaterThanOrEqual(1);
  expect(blocks.join('\n')).toContain('SELECT name');
});

// ── 8. Prose between two code panels ──
it('8. prose between two code panels stays as prose', () => {
  const body = [
    panelBlank(),
    panelLine('kubectl get pods'),
    panelBlank(),
    'Then check the logs with this command:',
    panelBlank(),
    panelLine('kubectl logs pod-name'),
    panelBlank(),
  ];
  const result = extractAIAnswer(makeRaw(body));
  assertNoAnsiLeaks(result);
  // Prose should NOT be in a code block
  const blocks = extractCodeBlocks(result);
  const allContent = blocks.join('\n');
  expect(allContent).not.toContain('Then check');
  // Both commands should be in code blocks
  expect(allContent).toContain('kubectl get pods');
  expect(allContent).toContain('kubectl logs pod-name');
});

// ── 9. JSON array output from kubectl ──
it('9. bare JSON array output wrapped in code block', () => {
  const body = [
    '[',
    '  {',
    '    "name": "pod-1",',
    '    "status": "Running"',
    '  },',
    '  {',
    '    "name": "pod-2",',
    '    "status": "Pending"',
    '  }',
    ']',
  ];
  const result = extractAIAnswer(makeRaw(body));
  assertNoAnsiLeaks(result);
  const blocks = extractCodeBlocks(result);
  expect(blocks.length).toBeGreaterThanOrEqual(1);
  expect(blocks.join('\n')).toContain('"name": "pod-1"');
});

// ── 10. Mixed heredoc types in one response ──
it('10. multiple heredocs in one response', () => {
  const body = [
    'cat > namespace.yaml <<EOF',
    'apiVersion: v1',
    'kind: Namespace',
    'metadata:',
    '  name: test',
    'EOF',
    '',
    'cat > deployment.yaml <<EOF',
    'apiVersion: apps/v1',
    'kind: Deployment',
    'metadata:',
    '  name: web',
    'EOF',
  ];
  const result = extractAIAnswer(makeRaw(body));
  assertNoAnsiLeaks(result);
  // Neither YAML body should be in a separate yaml block
  const blocks = extractCodeBlocks(result);
  const yamlOnly = blocks.filter(b => b.includes('apiVersion:') && !b.includes('cat >'));
  expect(yamlOnly.length).toBe(0);
});
});
