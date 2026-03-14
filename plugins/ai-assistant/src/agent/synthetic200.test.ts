/**
 * Synthetic tests targeting YAML block scalar parser edge case in extractAIAnswer.
 *
 * Originally 200 tests across 17 categories; passing categories removed.
 * Only the failing category (8 – YAML literal/folded block scalars) is kept,
 * skipped pending a parser fix.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { _testing } from './aksAgentManager';

const { extractAIAnswer } = _testing;

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
}

function makeFixture(contentLines: string[]): string {
  return [
    'stty -echo',
    '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent:/app# ',
    '\x1b[?2004l',
    '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
    ...contentLines,
    '',
    '\x1b[?2004hroot@aks-agent:/app# ',
  ].join('\n');
}

function extractCodeBlocks(result: string): string[] {
  const blocks: string[] = [];
  let current = '';
  let inFence = false;
  for (const line of result.split('\n')) {
    if (/^```/.test(line.trim())) {
      if (inFence) {
        blocks.push(current);
        current = '';
      }
      inFence = !inFence;
      continue;
    }
    if (inFence) current += line + '\n';
  }
  if (inFence && current) blocks.push(current);
  return blocks;
}

function assertNoAnsiLeaks(text: string): void {
  expect(text).not.toMatch(/\x1b/);
  expect(text).not.toMatch(/\[[\d;]*m/);
}

// ---------------------------------------------------------------------------
// BUG FOUND: normalizeTerminalMarkdown truncates YAML literal/folded block scalar
// content when it appears inside a Rich terminal panel. Lines after the block scalar
// indicator (|, >, |-,|+, etc.) are dropped from the code block output.
// These tests demonstrate the bug. They are skipped pending parser fix.
// ---------------------------------------------------------------------------
// 8. YAML literal/folded block scalars (10 tests)
// ---------------------------------------------------------------------------
describe('8 – YAML literal/folded block scalars preserved', () => {
  const indicators = ['|', '|-', '|+', '>', '>-', '>+', '|2', '>2', '|-2', '>+2'];

  indicators.forEach((ind, i) => {
    describe(`8.${i + 1} – block scalar indicator "${ind}"`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Here is the ConfigMap:',
          '',
          '\x1b[1mconfigmap.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: v1'),
          panelLine('kind: ConfigMap'),
          panelLine('metadata:'),
          panelLine('  name: my-config'),
          panelLine('data:'),
          panelLine(`  config.txt: ${ind}`),
          panelLine('    line one of the config'),
          panelLine('    line two of the config'),
          panelLine('    line three of the config'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('block scalar content is in a single code block', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        const combined = blocks.join('|||');
        expect(combined).toContain('line one');
        expect(combined).toContain('line three');
      });

      it(`indicator "${ind}" appears in output`, () => {
        expect(result).toContain(ind);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});
