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

function extractCodeBlocks(md: string): string[] {
  const blocks: string[] = [];
  const lines = md.split('\n');
  let inBlock = false;
  let current: string[] = [];
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
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

// Bug: "Optional: Ingress" centered heading absorbed into preceding k8s.yaml code block
const optionalIngressBug = [
  'stty -echo',
  '\x1b[?2004l',
  '\x1b[?2004hroot@aks-agent:/app# ',
  '\x1b[?2004l',
  '',
  "Loaded models: ['azure/gpt-4']",
  '\x1b[1;96mAI:\x1b[0m ',
  '',
  '  \x1b[1mk8s.yaml\x1b[0m',
  '',
  panelBlank(),
  panelLine('apiVersion: v1'),
  panelLine('kind: Service'),
  panelLine('metadata:'),
  panelLine('  name: myapp'),
  panelLine('spec:'),
  panelLine('  type: ClusterIP'),
  panelLine('  ports:'),
  panelLine('    - port: 80'),
  panelLine('      targetPort: 8080'),
  panelLine('  selector:'),
  panelLine('    app: myapp'),
  panelBlank(),
  '',
  '                           \x1b[1mOptional: Ingress\x1b[0m',
  '',
  '(Requires an Ingress controller installed, e.g., nginx)',
  '',
  panelBlank(),
  panelLine('apiVersion: networking.k8s.io/v1'),
  panelLine('kind: Ingress'),
  panelLine('metadata:'),
  panelLine('  name: myapp-ingress'),
  panelLine('spec:'),
  panelLine('  rules:'),
  panelLine('    - host: myapp.example.com'),
  panelLine('      http:'),
  panelLine('        paths:'),
  panelLine('          - path: /'),
  panelLine('            pathType: Prefix'),
  panelLine('            backend:'),
  panelLine('              service:'),
  panelLine('                name: myapp'),
  panelLine('                port:'),
  panelLine('                  number: 80'),
  panelBlank(),
  '',
  '\x1b[?2004hroot@aks-agent:/app# ',
].join('\n');

// Bug: Dockerfile h4 - "2) Containerize it" makes FROM render as h4
// Testing if the markdown `2) ` creates an ordered list in ReactMarkdown
// which then wraps the code block in list context
const dockerfileH4Bug = [
  'stty -echo',
  '\x1b[?2004l',
  '\x1b[?2004hroot@aks-agent:/app# ',
  '\x1b[?2004l',
  '',
  "Loaded models: ['azure/gpt-4']",
  '\x1b[1;96mAI:\x1b[0m ',
  '',
  '  \x1b[1m1. Create a tiny Rust HTTP app\x1b[0m',
  '',
  '  \x1b[1mCargo.toml\x1b[0m',
  '',
  panelBlank(),
  panelLine('[package]'),
  panelLine('name = "myapp"'),
  panelLine('version = "0.1.0"'),
  panelBlank(),
  '',
  '  \x1b[1msrc/main.rs\x1b[0m',
  '',
  panelBlank(),
  panelLine('use axum::{routing::get, Router};'),
  panelLine('async fn root() -> &\'static str { "hello" }'),
  panelLine('}'),
  panelLine('#[tokio::main]'),
  panelLine('async fn main() {'),
  panelLine('    let app = Router::new().route("/", get(root));'),
  panelLine('    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));'),
  panelLine('    axum::serve(listener, app).await.unwrap();'),
  panelLine('}'),
  panelBlank(),
  '',
  '                   \x1b[1m2) Containerize it (multi-stage Dockerfile)\x1b[0m',
  '',
  '  \x1b[1mDockerfile\x1b[0m',
  '',
  panelBlank(),
  panelLine('FROM rust:1.76 AS builder'),
  panelLine('WORKDIR /app'),
  panelLine('# Cache deps'),
  panelLine('COPY Cargo.toml Cargo.lock ./'),
  panelLine('RUN mkdir -p src && echo "fn main(){}" > src/main.rs'),
  panelLine('RUN cargo build --release'),
  panelLine('RUN rm -rf src'),
  panelLine('# Build real app'),
  panelLine('COPY . .'),
  panelLine('RUN cargo build --release'),
  panelLine('# ---- run ----'),
  panelLine('FROM gcr.io/distroless/cc-debian12:nonroot'),
  panelLine('WORKDIR /app'),
  panelLine('COPY --from=builder /app/target/release/myapp /app/myapp'),
  panelLine('USER nonroot:nonroot'),
  panelLine('EXPOSE 8080'),
  panelLine('ENTRYPOINT ["/app/myapp"]'),
  panelBlank(),
  '',
  '  \x1b[1mBuild + push (example with Docker Hub):\x1b[0m',
  '',
  panelBlank(),
  panelLine('export IMAGE=docker.io/<youruser>/myapp:0.1.0'),
  panelLine('docker build -t $IMAGE .'),
  panelLine('docker push $IMAGE'),
  panelBlank(),
  '',
  '                 \x1b[1m3. Deploy to Kubernetes\x1b[0m',
  '',
  '\x1b[?2004hroot@aks-agent:/app# ',
].join('\n');

describe('Bug: Optional Ingress in code block', () => {
  let result: string;
  beforeAll(() => {
    result = extractAIAnswer(optionalIngressBug);
    console.log('=== OPTIONAL INGRESS OUTPUT ===');
    console.log(result);
    console.log('=== END ===');
  });

  it('"Optional: Ingress" should NOT be in a code block', () => {
    const blocks = extractCodeBlocks(result);
    const inCode = blocks.some(b => b.includes('Optional: Ingress') || b.includes('Optional:'));
    expect(inCode).toBe(false);
  });

  it('parenthetical note should be prose, not code', () => {
    const blocks = extractCodeBlocks(result);
    expect(blocks.some(b => b.includes('Requires an Ingress controller'))).toBe(false);
  });

  it('Ingress YAML should be in code block', () => {
    const blocks = extractCodeBlocks(result);
    expect(blocks.some(b => b.includes('kind: Ingress'))).toBe(true);
  });
  
  it('Service YAML should be in code block', () => {
    const blocks = extractCodeBlocks(result);
    expect(blocks.some(b => b.includes('kind: Service'))).toBe(true);
  });
});

describe('Bug: Dockerfile h4 header', () => {
  let result: string;
  beforeAll(() => {
    result = extractAIAnswer(dockerfileH4Bug);
    console.log('=== DOCKERFILE H4 OUTPUT ===');
    console.log(result);
    console.log('=== END ===');
  });

  it('Dockerfile content should be in a code block', () => {
    const blocks = extractCodeBlocks(result);
    expect(blocks.some(b => b.includes('FROM rust:1.76 AS builder'))).toBe(true);
  });

  it('"2) Containerize" should NOT produce markdown heading syntax', () => {
    // The "2)" pattern can be interpreted as an ordered list by markdown parsers
    // It should be converted to "2." or similar safe format
    const lines = result.split('\n');
    const headingLines = lines.filter(l => /^#{1,6}\s/.test(l));
    // No heading should contain "Containerize" or FROM
    expect(headingLines.some(l => l.includes('FROM'))).toBe(false);
  });
  
  it('Cargo.toml and src/main.rs should be in separate code blocks', () => {
    const blocks = extractCodeBlocks(result);
    const tomlBlock = blocks.find(b => b.includes('[package]'));
    const rustBlock = blocks.find(b => b.includes('use axum'));
    expect(tomlBlock).toBeTruthy();
    expect(rustBlock).toBeTruthy();
    // They should be different blocks
    expect(tomlBlock).not.toBe(rustBlock);
  });
});
