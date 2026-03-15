/**
 * Trace test to show intermediate transformations
 */
import { describe, it } from 'vitest';
import { _testing } from './aksAgentManager';

const { normalizeTerminalMarkdown, wrapBareYamlBlocks } = _testing;

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

describe('trace12: Trace transformations', () => {
  it('Trace Test 9: HPA YAML flow through normalizeTerminalMarkdown and wrapBareYamlBlocks', () => {
    const hpaBody = [
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

    const raw = makeRaw(hpaBody);
    
    // Step 1: Strip ANSI codes
    const stripped = raw.replace(/\x1b\[[0-9;]*m/g, '');
    
    console.log('\n========== STEP 1: After ANSI strip (lines 7-27) ==========');
    stripped.split('\n').slice(7, 28).forEach((line, i) => {
      const indent = line.match(/^ */)?.[0].length || 0;
      console.log(`Line ${i.toString().padEnd(2)}: indent=${indent.toString().padEnd(2)} | ${line.slice(0, 60)}`);
    });
    
    // Step 2: normalizeTerminalMarkdown
    console.log('\n========== STEP 2: After normalizeTerminalMarkdown ==========');
    const afterNormalize = normalizeTerminalMarkdown(stripped);
    let inFence = false;
    let fenceType = '';
    let blockNum = 0;
    afterNormalize.split('\n').forEach((line, i) => {
      if (/^```/.test(line.trim())) {
        if (inFence) {
          console.log(`Block ${blockNum} END\n`);
        } else {
          blockNum++;
          fenceType = line.trim().substring(3) || 'plain';
          console.log(`Block ${blockNum} START (type: ${fenceType || 'plain'})`);
        }
        inFence = !inFence;
      } else if (inFence) {
        const indent = line.match(/^ */)?.[0].length || 0;
        console.log(`  indent=${indent.toString().padEnd(2)} | ${line.slice(0, 55)}`);
      }
    });
    
    // Step 3: wrapBareYamlBlocks
    console.log('\n========== STEP 3: After wrapBareYamlBlocks ==========');
    const afterYaml = wrapBareYamlBlocks(afterNormalize);
    inFence = false;
    blockNum = 0;
    afterYaml.split('\n').forEach((line, i) => {
      if (/^```/.test(line.trim())) {
        if (inFence) {
          console.log(`Block ${blockNum} END\n`);
        } else {
          blockNum++;
          fenceType = line.trim().substring(3) || 'plain';
          console.log(`Block ${blockNum} START (type: ${fenceType || 'plain'})`);
        }
        inFence = !inFence;
      } else if (inFence) {
        const indent = line.match(/^ */)?.[0].length || 0;
        console.log(`  indent=${indent.toString().padEnd(2)} | ${line.slice(0, 55)}`);
      }
    });
  });
});
