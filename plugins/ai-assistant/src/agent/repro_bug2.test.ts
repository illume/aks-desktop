import { describe, it, expect, beforeAll } from 'vitest';
import { _testing } from './aksAgentManager';
const { extractAIAnswer } = _testing;

function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}
function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
}
function extractCodeBlocks(result: string): string[] {
  const blocks: string[] = [];
  let current = '';
  let inFence = false;
  for (const line of result.split('\n')) {
    if (/^```/.test(line.trim())) {
      if (inFence) { blocks.push(current); current = ''; }
      inFence = !inFence;
    } else if (inFence) { current += line + '\n'; }
  }
  return blocks;
}
function getProseLines(result: string): string[] {
  const lines = result.split('\n');
  let inFence = false;
  return lines.filter(l => {
    if (/^```/.test(l.trim())) { inFence = !inFence; return false; }
    return !inFence;
  });
}

// ===================================================================
// BUG 1 (original): Cargo.toml heading block absorbs src/main.rs
// The bold file heading "src/main.rs" should SPLIT the code block.
// ===================================================================
describe('BUG: bold file heading should split code blocks', () => {
  const input = [
    'stty -echo', '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent:/app# ', '\x1b[?2004l', '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
    '  \x1b[1mCargo.toml\x1b[0m',
    '',
    panelBlank(),
    panelLine('[package]'),
    panelLine('name = "rust-k8s-example"'),
    panelLine('version = "0.1.0"'),
    panelLine('[dependencies]'),
    panelLine('axum = "0.7"'),
    panelBlank(),
    '',
    '  \x1b[1msrc/main.rs\x1b[0m',
    '',
    panelBlank(),
    panelLine('use axum::{routing::get, Router};'),
    panelLine('async fn root() -> &\'static str { "hello" }'),
    panelLine('#[tokio::main]'),
    panelLine('async fn main() {'),
    panelLine('    let app = Router::new().route("/", get(root));'),
    panelLine('    axum::serve(listener, app).await.unwrap();'),
    panelLine('}'),
    panelBlank(),
    '',
    '\x1b[?2004hroot@aks-agent:/app# ',
  ].join('\n');

  let result: string;
  beforeAll(() => {
    result = extractAIAnswer(input);
    console.log('\n=== BUG1 PARSED OUTPUT ===');
    console.log(result);
    console.log('=== END ===\n');
  });

  it('Cargo.toml and src/main.rs should be in SEPARATE code blocks', () => {
    const blocks = extractCodeBlocks(result);
    const tomlBlock = blocks.find(b => b.includes('[package]'));
    const rustBlock = blocks.find(b => b.includes('use axum'));
    expect(tomlBlock).toBeDefined();
    expect(rustBlock).toBeDefined();
    // They must NOT be in the same block
    expect(tomlBlock).not.toContain('use axum');
    expect(rustBlock).not.toContain('[package]');
  });
});

// ===================================================================
// BUG 2 (new): Prose with bullet list miscategorized as YAML code
// "Example: Node.js ... with:\n - GET /healthz → 200" is PROSE, not YAML.
// ===================================================================
describe('BUG: prose with bullet list not miscategorized as YAML', () => {
  const input = [
    'stty -echo', '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent:/app# ', '\x1b[?2004l', '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
    'Example: Node.js (JavaScript) HTTP app listening on 0.0.0.0:8080 with:',
    '',
    ' - GET /healthz \u2192 200',
    ' - GET /readyz \u2192 200',
    '',
    'Containerize (Dockerfile)',
    '',
    panelBlank(),
    panelLine('FROM node:20-alpine'),
    panelLine('WORKDIR /app'),
    panelLine('ENV NODE_ENV=production'),
    panelLine('COPY package*.json ./'),
    panelLine('RUN npm ci --omit=dev'),
    panelLine('COPY . .'),
    panelLine('EXPOSE 8080'),
    panelLine('USER node'),
    panelLine('CMD ["node", "server.js"]'),
    panelBlank(),
    '',
    'Build + push:',
    '',
    panelBlank(),
    panelLine('docker build -t <registry>/myapp:1.0.0 .'),
    panelLine('docker push <registry>/myapp:1.0.0'),
    panelBlank(),
    '',
    '\x1b[?2004hroot@aks-agent:/app# ',
  ].join('\n');

  let result: string;
  beforeAll(() => {
    result = extractAIAnswer(input);
    console.log('\n=== BUG2 PARSED OUTPUT ===');
    console.log(result);
    console.log('=== END ===\n');
  });

  it('"Example: Node.js..." should be prose, NOT inside a code block', () => {
    const prose = getProseLines(result);
    const exampleInProse = prose.some(l => l.includes('Example:') && l.includes('Node.js'));
    expect(exampleInProse).toBe(true);
  });

  it('"GET /healthz" bullet items should be prose, NOT code', () => {
    const blocks = extractCodeBlocks(result);
    const healthzInCode = blocks.some(b => b.includes('/healthz'));
    expect(healthzInCode).toBe(false);
  });

  it('Dockerfile FROM should be inside a code block', () => {
    const blocks = extractCodeBlocks(result);
    expect(blocks.some(b => b.includes('FROM node:20-alpine'))).toBe(true);
  });

  it('docker build/push should be inside a code block', () => {
    const blocks = extractCodeBlocks(result);
    expect(blocks.some(b => b.includes('docker build'))).toBe(true);
  });
});
