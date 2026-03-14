import { describe, it, expect } from 'vitest';
import { _testing } from './aksAgentManager';
const { extractAIAnswer } = _testing;

function panelLine(c: string, k='97;40') {
  return `\x1b[40m \x1b[0m\x1b[${k}m${c.padEnd(78)}\x1b[0m\x1b[40m \x1b[0m`;
}
function panelBlank() {
  return '\x1b[40m'+' '.repeat(80)+'\x1b[0m';
}

describe('trace literal block bug', () => {
  it('shows output', () => {
    const fixture = [
      'stty -echo', '\x1b[?2004l', '\x1b[?2004hroot@aks-agent:/app# ', '\x1b[?2004l', '',
      "Loaded models: ['azure/gpt-4']", '\x1b[1;96mAI:\x1b[0m ', '',
      'Here is the ConfigMap:',
      '',
      '  \x1b[1mconfigmap.yaml\x1b[0m',
      '',
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
      '', '\x1b[?2004hroot@aks-agent:/app# ',
    ].join('\n');

    const result = extractAIAnswer(fixture);
    console.log('=== PARSED OUTPUT ===');
    console.log(JSON.stringify(result));
    console.log('=== END ===');
    // Just logging; don't assert yet
    expect(true).toBe(true);
  });
});
