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

describe('BUG REPRO: Dockerfile FROM as heading', () => {
  // Scenario: numbered step + bold Dockerfile heading + panel Dockerfile content
  const input1 = [
    'stty -echo', '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent:/app# ', '\x1b[?2004l', '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
    '  1  Create a tiny Rust HTTP app',
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
    '          2) Containerize it (multi-stage Docker build)',
    '',
    '  \x1b[1mDockerfile\x1b[0m',
    '',
    panelBlank(),
    panelLine('FROM rust:1.76 AS builder'),
    panelLine('WORKDIR /app'),
    panelLine('COPY Cargo.toml Cargo.lock ./'),
    panelLine('RUN mkdir -p src && echo "fn main(){}" > src/main.rs'),
    panelLine('RUN cargo build --release'),
    panelLine('RUN rm -rf src'),
    panelLine('COPY . .'),
    panelLine('RUN cargo build --release'),
    panelLine('FROM gcr.io/distroless/cc-debian12:nonroot'),
    panelLine('WORKDIR /app'),
    panelLine('COPY --from=builder /app/target/release/myapp /app/myapp'),
    panelLine('USER nonroot:nonroot'),
    panelLine('EXPOSE 8080'),
    panelLine('ENTRYPOINT ["/app/myapp"]'),
    panelBlank(),
    '',
    '\x1b[?2004hroot@aks-agent:/app# ',
  ].join('\n');

  let result1: string;
  beforeAll(() => { result1 = extractAIAnswer(input1); });

  it('should print parsed output for debugging', () => {
    console.log('\n=== PARSED OUTPUT ===');
    console.log(result1);
    console.log('=== END ===\n');
  });

  it('FROM line should be inside a code block', () => {
    const blocks = extractCodeBlocks(result1);
    const hasFrom = blocks.some(b => b.includes('FROM rust:1.76'));
    expect(hasFrom).toBe(true);
  });

  it('FROM line should NOT be in prose', () => {
    const prose = getProseLines(result1);
    const fromInProse = prose.some(l => /FROM\s+rust/.test(l));
    expect(fromInProse).toBe(false);
  });

  it('no markdown heading wrapping FROM', () => {
    const prose = getProseLines(result1);
    const headingFrom = prose.some(l => /^#{1,6}\s/.test(l) && l.includes('FROM'));
    expect(headingFrom).toBe(false);
  });

  it('Dockerfile content separate from Cargo.toml', () => {
    const blocks = extractCodeBlocks(result1);
    const tomlBlock = blocks.find(b => b.includes('[package]'));
    const dockerBlock = blocks.find(b => b.includes('FROM rust:1.76'));
    expect(tomlBlock).toBeDefined();
    expect(dockerBlock).toBeDefined();
    expect(tomlBlock).not.toContain('FROM rust');
  });

  // Scenario 2: Ordered list item "2  Containerize..." converted to "2. Containerize..."
  // then the Dockerfile heading may get absorbed into the list item as sub-content
  const input2 = [
    'stty -echo', '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent:/app# ', '\x1b[?2004l', '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
    '  2  Containerize it (multi-stage Dockerfile)',
    '',
    '  \x1b[1mDockerfile\x1b[0m',
    '',
    panelBlank(),
    panelLine('FROM rust:1.76 AS builder'),
    panelLine('WORKDIR /app'),
    panelLine('COPY Cargo.toml Cargo.lock ./'),
    panelLine('RUN cargo build --release'),
    panelLine('FROM gcr.io/distroless/cc-debian12:nonroot'),
    panelLine('COPY --from=builder /app/target/release/myapp /app/myapp'),
    panelLine('EXPOSE 8080'),
    panelLine('ENTRYPOINT ["/app/myapp"]'),
    panelBlank(),
    '',
    '\x1b[?2004hroot@aks-agent:/app# ',
  ].join('\n');

  let result2: string;
  beforeAll(() => { result2 = extractAIAnswer(input2); });

  it('(scenario 2) should print parsed output', () => {
    console.log('\n=== PARSED OUTPUT (scenario 2) ===');
    console.log(result2);
    console.log('=== END ===\n');
  });

  it('(scenario 2) FROM should be in code block', () => {
    const blocks = extractCodeBlocks(result2);
    expect(blocks.some(b => b.includes('FROM rust:1.76'))).toBe(true);
  });

  it('(scenario 2) FROM should NOT be prose', () => {
    const prose = getProseLines(result2);
    expect(prose.some(l => /FROM\s+rust/.test(l))).toBe(false);
  });
});
