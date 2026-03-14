import { describe, it, expect } from 'vitest';
import { _testing } from './aksAgentManager';
const { extractAIAnswer, stripAnsi } = _testing;

function panelLine(c: string, k='97;40') {
  return `\x1b[40m \x1b[0m\x1b[${k}m${c.padEnd(78)}\x1b[0m\x1b[40m \x1b[0m`;
}
function panelBlank() {
  return '\x1b[40m'+' '.repeat(80)+'\x1b[0m';
}

describe('trace', () => {
  it('shows stripped lines', () => {
    const lines = [
      panelBlank(),
      panelLine('apiVersion: v1'),
      panelLine('kind: ConfigMap'),
      panelLine('metadata:'),
      panelLine('  name: my-config'),
      panelLine('data:'),
      panelLine('  config.txt: |'),
      panelLine('    line one of the config'),
      panelLine('    line two of the config'),
      panelLine('    line three of the config'),
      panelBlank(),
    ];
    console.log('=== STRIPPED LINES ===');
    for (const l of lines) {
      const s = stripAnsi(l).trimEnd();
      console.log(JSON.stringify(s));
    }
    console.log('=== END ===');
    expect(true).toBe(true);
  });
});
