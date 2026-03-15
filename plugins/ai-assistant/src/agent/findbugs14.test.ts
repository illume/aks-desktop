/**
 * findbugs14.test.ts — Round 14 synthetic fixtures: prose-colon false positives
 * in panel recovery and indented-block collector.
 *
 * These tests verify that prose headings ending with colons (e.g. "Also confirm:",
 * "Build + push:") are NOT pulled into code blocks when they follow shell commands
 * in Rich panel output.
 *
 * Root cause: the panel recovery handler (column-0 code + shallow-indented
 * continuation) used `|| /^\s/.test(pl)` which matched ANY indented line,
 * including prose headings.  The fix adds a prose-heading break check before
 * the broad continuation condition.
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

function boldLine(content: string): string {
  return `\x1b[40m \x1b[0m\x1b[1;97;40m${content.padEnd(78)}\x1b[0m\x1b[40m \x1b[0m`;
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
    if (/^`{3}/.test(line.trim())) {
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

describe('findbugs14: prose-colon false positives in panel recovery', () => {
  // Bug 1: "Also confirm:" after kubectl commands gets pulled into code block.
  // The panel recovery handler's broad `|| /^\s/.test(pl)` matched any indented
  // line, collecting prose headings as code panel content.
  it('1. "Also confirm:" after shell commands is not code', () => {
    const body = [
      ' kubectl get pods -n production',
      ' kubectl get svc -n production',
      '',
      ' Also confirm:',
      '',
      ' - the image tag matches what was pushed',
      ' - the pull secret exists in the namespace',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    // No empty code blocks
    for (const block of blocks) {
      expect(block.trim()).not.toBe('');
    }
    // "Also confirm" should NOT be inside any code block
    for (const block of blocks) {
      expect(block).not.toContain('Also confirm');
    }
    // kubectl commands SHOULD be in a code block
    const allCode = blocks.join('\n');
    expect(allCode).toContain('kubectl get pods');
  });

  // Bug 2: "Also confirm:" immediately after shell (no blank line) still pulled in.
  it('2. "Also confirm:" without blank line after shell is not code', () => {
    const body = [' kubectl get pods -n production', ' Also confirm:', ' - the image tag matches'];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('Also confirm');
    }
  });

  // Bug 3: Double blank lines before "Also confirm:" — collapseBlankLines
  // was removing the blank because isTermCodeLine returned true for prose headings.
  it('3. "Also confirm:" after double blank is not code', () => {
    const body = [
      ' kubectl get pods -n production',
      ' kubectl get svc -n production',
      '',
      '',
      ' Also confirm:',
      '',
      ' - the image tag matches',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('Also confirm');
    }
  });

  // Bug 4: "Build + push:" prose heading should not become code.
  it('4. "Build + push:" prose heading is not code', () => {
    const body = [
      ' docker build -t myapp:latest .',
      ' Build + push:',
      ' You can push with docker push.',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block).not.toContain('Build + push');
    }
  });

  // Bug 5: Rich panel with code followed by "Also confirm:" prose section.
  it('5. Rich panel code then "Also confirm:" stays prose', () => {
    const body = [
      boldLine('Commands'),
      panelBlank(),
      panelLine('kubectl get deploy -n prod'),
      panelLine('kubectl get svc -n prod'),
      panelBlank(),
      '',
      'Also confirm:',
      '',
      '- the image tag matches',
      '- the pull secret exists',
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    for (const block of blocks) {
      expect(block.trim()).not.toBe('');
      expect(block).not.toContain('Also confirm');
    }
  });
});
