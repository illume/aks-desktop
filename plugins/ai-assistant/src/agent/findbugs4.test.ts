/**
 * findbugs4.test.ts — Round 4 synthetic fixtures targeting parser edge cases
 * discovered after the earlier skipped-test fixes.
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

describe('findbugs4: extractAIAnswer edge cases (round 4)', () => {
  it('1. shell heredoc with <<-EOF keeps YAML body in same block', () => {
    const body = ['cat <<-EOF', 'apiVersion: v1', 'kind: ConfigMap', 'EOF'];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(result).not.toContain('```yaml');
    const yamlInSeparateBlock = blocks.some(
      b => b.includes('apiVersion: v1') && !b.includes('cat <<-EOF')
    );
    expect(yamlInSeparateBlock).toBe(false);
  });

  it('2. YAML merge-key line <<: *defaults stays inside yaml block', () => {
    const body = [
      panelBlank(),
      panelLine('defaults: &defaults'),
      panelLine('  image: nginx'),
      panelLine('deployment:'),
      panelLine('  <<: *defaults'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('defaults: &defaults');
    expect(blocks[0]).toContain('<<: *defaults');
  });

  it('3. Makefile .PHONY and dependency targets stay in one code block', () => {
    const body = [
      panelBlank(),
      panelLine('.PHONY: build deps clean'),
      panelLine('build: deps'),
      panelLine('\tgo build ./...'),
      panelLine('deps:'),
      panelLine('\tgo mod download'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    expect(blocks[0]).toContain('.PHONY: build deps clean');
    expect(blocks[0]).toContain('build: deps');
    expect(blocks[0]).toContain('deps:');
  });

  it('4. lowercase SQL panel content stays in one code block', () => {
    const body = [
      panelBlank(),
      panelLine('select name, age'),
      panelLine('from users'),
      panelLine('where age > 18'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toContain('select name, age');
    expect(blocks[0]).toContain('from users');
    expect(blocks[0]).toContain('where age > 18');
  });

  it('5. Dockerfile panel with image tag keeps following lines in same block', () => {
    const body = [
      panelBlank(),
      panelLine('FROM gcr.io/distroless/cc-debian12:nonroot'),
      panelLine('WORKDIR /app'),
      panelLine('COPY --from=builder /app/bin /app/bin'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBe(1);
    expect(blocks[0]).toContain('FROM gcr.io/distroless/cc-debian12:nonroot');
    expect(blocks[0]).toContain('WORKDIR /app');
    expect(blocks[0]).toContain('COPY --from=builder /app/bin /app/bin');
  });
});
