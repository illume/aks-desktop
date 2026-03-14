/**
 * findbugs.test.ts — Synthetic fixtures targeting potential parser bugs
 * in the extractAIAnswer pipeline (normalizeTerminalMarkdown, wrapBareYamlBlocks,
 * wrapBareCodeBlocks).
 */
import { describe, expect, it } from 'vitest';
import { _testing } from './aksAgentManager';

const { extractAIAnswer } = _testing;

// ─── Helpers ───────────────────────────────────────────────────────────────

function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
}

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

function assertNoAnsiLeaks(text: string) {
  expect(text).not.toMatch(/\x1b/);
  expect(text).not.toMatch(/\[\d+m/);
  expect(text).not.toMatch(/\[0m/);
}

function makeRaw(body: string[]): string {
  return [...prefix, ...body, ...suffix].join('\n');
}

// Parser constants (defined in aksAgentManager.ts):
//   PROSE_WORD_THRESHOLD = 5  — lines with ≥5 words treated as prose
//   MIN_YAML_LINES = 3        — bare YAML needs ≥3 lines to be wrapped

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('findbugs: extractAIAnswer edge cases', () => {
  // ── 1. Two file headings with no blank line between panels ──
  it('1. two file headings with no blank line between panels', () => {
    const body = [
      panelBlank(),
      '                             Cargo.toml',
      panelBlank(),
      panelLine('[package]'),
      panelLine('name = "myapp"'),
      '                             src/main.rs',
      panelBlank(),
      panelLine('fn main() {'),
      panelLine('    println!("hello");'),
      panelLine('}'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(2);
    expect(blocks[0]).toContain('[package]');
    expect(blocks[1]).toContain('fn main()');
  });

  // ── 2. File heading with extension-only name ".env" ──
  it('2. file heading with extension-only name .env', () => {
    const body = [
      panelBlank(),
      '                             .env',
      panelBlank(),
      panelLine('DB_HOST=localhost'),
      panelLine('DB_PORT=5432'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('.env');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // Bold-file-heading path retains leading space (no dedent) because
    // isBoldFileHeading() wraps content as-is. If .env isn't matched by
    // the regex /^([\w.-]+\/)*[\w.-]+\.\w+$/, the indented-code path
    // dedents instead, removing leading space.
    const envBlock = blocks.find(b => b.includes('DB_HOST'));
    expect(envBlock).toBeDefined();
    expect(envBlock!).toMatch(/^ /m); // leading space = bold file heading path was used
  });

  // ── 3. File heading with deep path "src/handlers/auth.rs" ──
  it('3. file heading with deep path src/handlers/auth.rs', () => {
    const body = [
      panelBlank(),
      '                             src/handlers/auth.rs',
      panelBlank(),
      panelLine('pub fn authenticate(req: &Request) -> bool {'),
      panelLine('    true'),
      panelLine('}'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('src/handlers/auth.rs');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('authenticate');
  });

  // ── 4. Prose line with exactly 4 words inside file-header block ──
  it('4. prose with 4 words should NOT break file-header block', () => {
    const body = [
      panelBlank(),
      '                             config.yaml',
      panelBlank(),
      panelLine('apiVersion: v1'),
      panelLine('kind: ConfigMap'),
      panelLine('good luck with this'), // 4 words, below PROSE_WORD_THRESHOLD=5
      panelLine('data:'),
      panelLine('  key: value'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    // All content should be in one code block (4-word line doesn't break it)
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toContain('apiVersion');
    expect(blocks[0]).toContain('data:');
  });

  // ── 5. Prose line with exactly 5 words should break file-header block ──
  it('5. prose with 5 words SHOULD break file-header block', () => {
    const body = [
      panelBlank(),
      '                             config.yaml',
      panelBlank(),
      panelLine('apiVersion: v1'),
      panelLine('kind: ConfigMap'),
      panelLine('This creates the main application'), // 5 words = PROSE_WORD_THRESHOLD
      panelLine('data:'),
      panelLine('  key: value'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    // The 5-word prose line should cause the block to end before it.
    // The remaining YAML lines after the prose won't form a second block
    // because they're indented (from panel) and don't match shell/code patterns.
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('apiVersion');
    expect(blocks[0]).not.toContain('data:');
  });

  // ── 6. YAML with annotation value containing a pipe character ──
  it('6. YAML annotation with pipe literal block scalar', () => {
    const body = [
      'apiVersion: networking.k8s.io/v1',
      'kind: Ingress',
      'metadata:',
      '  annotations:',
      '    nginx.ingress.kubernetes.io/configuration-snippet: |',
      '      more_set_headers "X-Frame-Options: DENY";',
      '      more_set_headers "X-XSS-Protection: 1";',
      'spec:',
      '  rules: []',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const yamlBlock = blocks.find(b => b.includes('apiVersion'));
    expect(yamlBlock).toBeDefined();
    // Pipe content should stay within the same YAML block
    expect(yamlBlock!).toContain('more_set_headers');
    expect(yamlBlock!).toContain('spec:');
  });

  // ── 7. Bare YAML at column 0 with exactly 2 YAML-like lines (should NOT wrap) ──
  it('7. bare YAML with 2 lines should NOT be wrapped', () => {
    const body = ['Here is the config:', '', 'name: myapp', 'version: "1.0"'];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    // 2 lines < MIN_YAML_LINES=3, should not be wrapped in ```yaml
    expect(result).not.toMatch(/```yaml/);
    expect(result).toContain('name: myapp');
  });

  // ── 8. Bare YAML at column 0 with exactly 3 YAML-like lines (should wrap) ──
  it('8. bare YAML with 3 lines SHOULD be wrapped', () => {
    const body = [
      'Here is the config:',
      '',
      'name: myapp',
      'version: "1.0"',
      'description: "A test"',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toMatch(/```yaml/);
    const blocks = extractCodeBlocks(result);
    const yamlBlock = blocks.find(b => b.includes('name: myapp'));
    expect(yamlBlock).toBeDefined();
    expect(yamlBlock!).toContain('description');
  });

  // ── 9. Dockerfile bold heading with deeply indented continuation ──
  it('9. Dockerfile heading with deeply indented continuation lines', () => {
    const body = [
      panelBlank(),
      '                             Dockerfile',
      panelBlank(),
      panelLine('FROM ubuntu:22.04'),
      panelLine('RUN apt-get update && \\'),
      panelLine('    apt-get install -y \\'),
      panelLine('    curl \\'),
      panelLine('    wget'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('Dockerfile');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // All continuation lines should be in the same block
    expect(blocks[0]).toContain('FROM ubuntu:22.04');
    expect(blocks[0]).toContain('wget');
  });

  // ── 10. Bold heading for "docker-compose.yml" ──
  it('10. docker-compose.yml bold heading', () => {
    const body = [
      panelBlank(),
      '                             docker-compose.yml',
      panelBlank(),
      panelLine('version: "3.8"'),
      panelLine('services:'),
      panelLine('  web:'),
      panelLine('    image: nginx:latest'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('docker-compose.yml');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('services:');
  });

  // ── 11. Panel code starting with a number like "3000" ──
  it('11. panel code starting with port number', () => {
    const body = [
      panelBlank(),
      '                             server.conf',
      panelBlank(),
      panelLine('3000'),
      panelLine('listen_address: 0.0.0.0'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // "3000" should NOT become "3000. " (ordered list conversion)
    expect(result).not.toMatch(/^3000\./m);
  });

  // ── 12. ANSI 256-color code should be fully stripped ──
  it('12. ANSI 256-color code fully stripped', () => {
    const body = [
      '\x1b[38;5;208mWarning: resource limit exceeded\x1b[0m',
      'Please adjust your quota.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    expect(result).toContain('Warning: resource limit exceeded');
  });

  // ── 13. Go interface{} type ──
  it('13. Go interface{} type should not cause issues', () => {
    const body = [
      panelBlank(),
      '                             main.go',
      panelBlank(),
      panelLine('package main'),
      panelLine(''),
      panelLine('var result interface{}'),
      panelLine(''),
      panelLine('func main() {'),
      panelLine('    result = "hello"'),
      panelLine('}'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('interface{}');
  });

  // ── 14. Two consecutive bare YAML blocks separated by prose ──
  it('14. two YAML blocks separated by prose', () => {
    const body = [
      'First, create the namespace:',
      '',
      'apiVersion: v1',
      'kind: Namespace',
      'metadata:',
      '  name: production',
      '',
      'Then create the deployment:',
      '',
      'apiVersion: apps/v1',
      'kind: Deployment',
      'metadata:',
      '  name: web',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(2);
    expect(blocks[0]).toContain('Namespace');
    expect(blocks[1]).toContain('Deployment');
  });

  // ── 15. Shell command with backtick substitution at column 0 ──
  it('15. shell backtick substitution at column 0', () => {
    const body = [
      'Run this command:',
      '',
      'PODS=`kubectl get pods -o name`',
      'echo $PODS',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    // Both lines should be in a code block
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks.some(b => b.includes('kubectl get pods'))).toBe(true);
  });

  // ── 16. File heading "Makefile" with tab-indented content ──
  it('16. Makefile heading with tab-indented content', () => {
    const body = [
      panelBlank(),
      '                             Makefile',
      panelBlank(),
      panelLine('build:'),
      panelLine('\t@echo "Building..."'),
      panelLine('\tgo build -o app .'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('Makefile');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('build:');
  });

  // ── 17. YAML with multi-line string using > (folded scalar) ──
  it('17. YAML folded scalar with > indicator', () => {
    const body = [
      panelBlank(),
      '                             values.yaml',
      panelBlank(),
      panelLine('app:'),
      panelLine('  description: >'),
      panelLine('    This is a long description'),
      panelLine('    that spans multiple lines'),
      panelLine('  port: 8080'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // Folded scalar content should stay in the same block
    expect(blocks[0]).toContain('description: >');
    expect(blocks[0]).toContain('long description');
    expect(blocks[0]).toContain('port: 8080');
  });

  // ── 18. Indented code block after numbered list item ──
  it('18. indented code after numbered list item', () => {
    const body = [
      '1. Create the deployment file:',
      '',
      panelLine('kubectl apply -f deployment.yaml'),
      panelLine('kubectl rollout status deployment/web'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks.some(b => b.includes('kubectl apply'))).toBe(true);
  });

  // ── 19. Bold file heading "requirements.txt" with pip freeze output ──
  it('19. requirements.txt with pip freeze output', () => {
    const body = [
      panelBlank(),
      '                             requirements.txt',
      panelBlank(),
      panelLine('flask==2.3.0'),
      panelLine('requests==2.31.0'),
      panelLine('gunicorn==21.2.0'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('requirements.txt');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('flask==2.3.0');
    expect(blocks[0]).toContain('gunicorn==21.2.0');
  });

  // ── 20. Bare code block followed immediately by bare YAML ──
  it('20. bare code followed by bare YAML creates 2 blocks', () => {
    const body = [
      'First, run:',
      '',
      'kubectl create namespace production',
      'kubectl config set-context --current --namespace=production',
      '',
      'Then apply this manifest:',
      '',
      'apiVersion: v1',
      'kind: Service',
      'metadata:',
      '  name: web',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(2);
    expect(blocks.some(b => b.includes('kubectl create'))).toBe(true);
    expect(blocks.some(b => b.includes('apiVersion'))).toBe(true);
  });

  // ── 21. File heading with hyphenated name "my-app.yaml" ──
  it('21. hyphenated filename my-app.yaml', () => {
    const body = [
      panelBlank(),
      '                             my-app.yaml',
      panelBlank(),
      panelLine('apiVersion: v1'),
      panelLine('kind: Pod'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('my-app.yaml');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('apiVersion');
  });

  // ── 22. ANSI code split across line boundary ──
  it('22. ANSI code split across line boundary', () => {
    const body = [
      'The config is:\x1b[',
      '97;40m This is the value\x1b[0m',
      'End of output.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    expect(result).toContain('The config is');
    expect(result).toContain('End of output');
  });

  // ── 23. Panel content with Windows-style paths ──
  it('23. Windows-style paths in panel content', () => {
    const body = [
      panelBlank(),
      '                             config.yaml',
      panelBlank(),
      panelLine('source: C:\\Users\\app\\config.yaml'),
      panelLine('dest: C:\\Program Files\\app\\out'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('C:\\Users');
  });

  // ── 24. Very long single line in panel (>78 chars) ──
  it('24. very long line in panel exceeding 78 chars', () => {
    const longContent =
      'RUN apt-get update && apt-get install -y curl wget git build-essential libssl-dev pkg-config';
    const body = [
      panelBlank(),
      '                             Dockerfile',
      panelBlank(),
      panelLine('FROM ubuntu:22.04'),
      panelLine(longContent),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // Long line content should be preserved
    expect(blocks[0]).toContain('pkg-config');
  });

  // ── 25. Bold heading "Dockerfile.prod" (compound extension) ──
  it('25. Dockerfile.prod compound extension heading', () => {
    const body = [
      panelBlank(),
      '                             Dockerfile.prod',
      panelBlank(),
      panelLine('FROM node:20-slim AS builder'),
      panelLine('WORKDIR /app'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('Dockerfile.prod');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('FROM node:20-slim');
  });

  // ── 26. YAML with flow-style mapping { key: value } ──
  it('26. YAML flow-style mapping', () => {
    const body = [
      'apiVersion: v1',
      'kind: ConfigMap',
      'metadata:',
      '  name: test',
      '  labels: { app: web, env: prod }',
      'data:',
      '  key: value',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const yamlBlock = blocks.find(b => b.includes('apiVersion'));
    expect(yamlBlock).toBeDefined();
    // Flow mapping should stay inside the YAML block
    expect(yamlBlock!).toContain('{ app: web');
  });

  // ── 27. Bare kubectl command followed by tabular output ──
  it('27. kubectl command with tabular output', () => {
    const body = [
      'Check pod status:',
      '',
      'kubectl get pods',
      'NAME          STATUS    RESTARTS   AGE',
      'web-abc123    Running   0          5m',
      'api-def456    Running   1          3m',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // kubectl command and its output should be in the same block
    const kubectlBlock = blocks.find(b => b.includes('kubectl get pods'));
    expect(kubectlBlock).toBeDefined();
    expect(kubectlBlock!).toContain('web-abc123');
  });

  // ── 28. Panel code containing triple backticks ──
  it('28. panel code containing triple backticks', () => {
    const body = [
      panelBlank(),
      '                             README.md',
      panelBlank(),
      panelLine('# My App'),
      panelLine(''),
      panelLine('```bash'),
      panelLine('npm install'),
      panelLine('```'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    // The content should be handled gracefully
    // Even if backticks cause issues, the core content should be present
    expect(result).toContain('README.md');
    expect(result).toContain('npm install');
  });

  // ── 29. File heading "tsconfig.json" followed by JSON content ──
  it('29. tsconfig.json with JSON content', () => {
    const body = [
      panelBlank(),
      '                             tsconfig.json',
      panelBlank(),
      panelLine('{'),
      panelLine('  "compilerOptions": {'),
      panelLine('    "target": "ES2020",'),
      panelLine('    "module": "commonjs"'),
      panelLine('  }'),
      panelLine('}'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    expect(result).toContain('tsconfig.json');
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('compilerOptions');
  });

  // ── 30. Indented code with flag chars that look like prose ──
  it('30. indented line with flags should not be treated as prose', () => {
    const body = [
      panelBlank(),
      '                             deploy.sh',
      panelBlank(),
      panelLine('#!/bin/bash'),
      panelLine('kubectl apply -f manifest.yaml'),
      panelLine('  --namespace production --replicas 3 --dry-run client'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    // The flag line (6 words but has --flags) should stay in the same block
    expect(blocks[0]).toContain('#!/bin/bash');
    expect(blocks[0]).toContain('--namespace');
  });
});
