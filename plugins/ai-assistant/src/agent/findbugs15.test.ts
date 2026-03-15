/**
 * findbugs15.test.ts — Round 15 synthetic fixtures: filename-hint code detection
 *
 * These tests verify that bare filenames (e.g. "requirements.txt", "main.py",
 * "Dockerfile") appearing before code content act as hints for the parser to
 * wrap the subsequent content in code fences.
 *
 * Also tests that numbered step headers like "3) Kubernetes (Deployment + Service)"
 * are NOT wrapped in code fences.
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
}

describe('findbugs15 — filename-hint code detection', () => {
  it('#1 requirements.txt followed by pinned dependencies', () => {
    // When "requirements.txt" appears as a bare filename heading, followed
    // by pip-style pinned deps, the deps should be in a code block.
    const body = [
      panelLine('Here are the project files:'),
      panelBlank(),
      boldLine('requirements.txt'),
      panelBlank(),
      panelLine(' fastapi==0.110.0'),
      panelLine(' uvicorn[standard]==0.27.1'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    // The pinned deps should be in a code block
    const depBlock = blocks.find(
      b => b.includes('fastapi==0.110.0') && b.includes('uvicorn')
    );
    expect(depBlock).toBeDefined();
  });

  it('#2 main.py followed by Python code', () => {
    // When "main.py" appears as a bare filename heading, followed by Python
    // code, the code should be in a code block.
    const body = [
      panelLine('Create this file:'),
      panelBlank(),
      boldLine('main.py'),
      panelBlank(),
      panelLine(' from fastapi import FastAPI'),
      panelLine(' import os'),
      panelLine(' app = FastAPI()'),
      panelLine(' @app.get("/")'),
      panelLine(' def root():'),
      panelLine('     return {"message": "hello"}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    const pyBlock = blocks.find(
      b => b.includes('from fastapi import FastAPI') && b.includes('def root():')
    );
    expect(pyBlock).toBeDefined();
  });

  it('#3 numbered step header is NOT a code block', () => {
    // "3) Kubernetes (Deployment + Service + optional Ingress)" should NOT
    // be wrapped in a code block — it's a section heading.
    const body = [
      panelLine('                3) Kubernetes (Deployment + Service + optional Ingress)'),
      panelBlank(),
      panelLine('Create a deployment manifest:'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    // Should NOT be in a code block
    expect(result).toContain('3) Kubernetes');
    const blocks = extractCodeBlocks(result);
    const headingBlock = blocks.find(b => b.includes('3) Kubernetes'));
    expect(headingBlock).toBeUndefined();
  });

  it('#4 Dockerfile filename followed by Dockerfile content', () => {
    // "Dockerfile" heading followed by Dockerfile content should wrap it in code.
    const body = [
      boldLine('Dockerfile'),
      panelBlank(),
      panelLine(' FROM python:3.12-slim AS builder'),
      panelLine(' WORKDIR /app'),
      panelLine(' COPY requirements.txt .'),
      panelLine(' RUN pip install --no-cache-dir -r requirements.txt'),
      panelBlank(),
      panelLine(' FROM python:3.12-slim'),
      panelLine(' WORKDIR /app'),
      panelLine(' COPY --from=builder /app /app'),
      panelLine(' CMD ["uvicorn", "main:app", "--host", "0.0.0.0"]'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    const dockerBlock = blocks.find(
      b => b.includes('FROM python:3.12-slim') && b.includes('CMD')
    );
    expect(dockerBlock).toBeDefined();
  });

  it('#5 requirements.txt followed by deps (non-panel format)', () => {
    // Non-panel format: bare "requirements.txt" on own line, then deps below.
    // After normalizeTerminalMarkdown, this would appear as column-0 lines.
    // wrapBareCodeBlocks should use the filename hint.
    const body = [
      'Here are the files:',
      '',
      'requirements.txt',
      '',
      'fastapi==0.110.0',
      'uvicorn[standard]==0.27.1',
      '',
    ];
    const raw = [
      'stty -echo',
      '\x1b[?2004l',
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
      '\x1b[?2004l',
      '',
      "Loaded models: ['azure/gpt-4']",
      '\x1b[1;96mAI:\x1b[0m ',
      '',
      ...body,
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
    ].join('\n');
    const result = extractAIAnswer(raw);
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    const depBlock = blocks.find(b => b.includes('fastapi==0.110.0'));
    expect(depBlock).toBeDefined();
  });

  it('#6 main.py followed by Python code (non-panel format)', () => {
    const body = [
      'Create this file:',
      '',
      'main.py',
      '',
      'from fastapi import FastAPI',
      'import os',
      'app = FastAPI()',
      '@app.get("/")',
      'def root():',
      '    return {"message": "hello"}',
      '',
    ];
    const raw = [
      'stty -echo',
      '\x1b[?2004l',
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
      '\x1b[?2004l',
      '',
      "Loaded models: ['azure/gpt-4']",
      '\x1b[1;96mAI:\x1b[0m ',
      '',
      ...body,
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
    ].join('\n');
    const result = extractAIAnswer(raw);
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    const pyBlock = blocks.find(
      b => b.includes('from fastapi import FastAPI') && b.includes('def root():')
    );
    expect(pyBlock).toBeDefined();
  });

  it('#7 numbered header 3) is NOT code in non-panel format', () => {
    const body = [
      '3) Kubernetes (Deployment + Service + optional Ingress)',
      '',
      'Create a deployment YAML for your app.',
    ];
    const raw = [
      'stty -echo',
      '\x1b[?2004l',
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
      '\x1b[?2004l',
      '',
      "Loaded models: ['azure/gpt-4']",
      '\x1b[1;96mAI:\x1b[0m ',
      '',
      ...body,
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
    ].join('\n');
    const result = extractAIAnswer(raw);
    assertNoAnsiLeaks(result);
    expect(result).toContain('3)');
    const blocks = extractCodeBlocks(result);
    const headingBlock = blocks.find(b => b.includes('Kubernetes'));
    expect(headingBlock).toBeUndefined();
  });

  it('#8 Cargo.toml: with trailing colon wraps TOML content', () => {
    // "Cargo.toml:" (filename with trailing colon) should trigger filename
    // hint detection and wrap subsequent TOML content in a code block.
    const body = [
      'Cargo.toml:',
      '',
      '[package]',
      'name = "myapp"',
      'version = "0.1.0"',
      '',
      '[dependencies]',
      'tokio = { version = "1", features = ["full"] }',
      '',
    ];
    const raw = [
      'stty -echo',
      '\x1b[?2004l',
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
      '\x1b[?2004l',
      '',
      "Loaded models: ['azure/gpt-4']",
      '\x1b[1;96mAI:\x1b[0m ',
      '',
      ...body,
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
    ].join('\n');
    const result = extractAIAnswer(raw);
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    const tomlBlock = blocks.find(
      b => b.includes('[package]') && b.includes('name = "myapp"')
    );
    expect(tomlBlock).toBeDefined();
  });

  it('#9 deployment.yaml heading keeps YAML separate from filename', () => {
    // "deployment.yaml" heading followed by K8s YAML should have the YAML
    // wrapped (either as yaml or generic code fence).
    const body = [
      panelLine('Create this manifest:'),
      panelBlank(),
      boldLine('deployment.yaml'),
      panelBlank(),
      panelLine(' apiVersion: apps/v1'),
      panelLine(' kind: Deployment'),
      panelLine(' metadata:'),
      panelLine('   name: myapp'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    expect(result).toContain('deployment.yaml');
    const blocks = extractCodeBlocks(result);
    const yamlBlock = blocks.find(
      b => b.includes('apiVersion: apps/v1') && b.includes('kind: Deployment')
    );
    expect(yamlBlock).toBeDefined();
  });

  it('#10 src/main.rs: with trailing colon wraps Rust code', () => {
    // "src/main.rs:" (path with trailing colon) should wrap Rust content.
    const body = [
      'src/main.rs:',
      '',
      'fn main() {',
      '    println!("Hello, world!");',
      '}',
      '',
    ];
    const raw = [
      'stty -echo',
      '\x1b[?2004l',
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
      '\x1b[?2004l',
      '',
      "Loaded models: ['azure/gpt-4']",
      '\x1b[1;96mAI:\x1b[0m ',
      '',
      ...body,
      '\x1b[?2004hroot@aks-agent-abc123:/app# ',
    ].join('\n');
    const result = extractAIAnswer(raw);
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    const rustBlock = blocks.find(
      b => b.includes('fn main()') && b.includes('println!')
    );
    expect(rustBlock).toBeDefined();
  });

  it('#11 indented numbered step header after Go code is NOT a code block', () => {
    // When a Go code block is followed by "    2) Containerize (multi-stage
    // Dockerfile, static binary, nonroot)", the numbered step header should NOT
    // be captured as part of the code block or wrapped in its own code fences.
    const body = [
      boldLine('1. Minimal Go HTTP server'),
      panelBlank(),
      panelLine(' package main'),
      panelLine(' import ('),
      panelLine('     "fmt"'),
      panelLine('     "log"'),
      panelLine('     "net/http"'),
      panelLine('     "os"'),
      panelLine(' )'),
      panelLine(' func main() {'),
      panelLine('     mux := http.NewServeMux()'),
      panelLine('     mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {'),
      panelLine('         fmt.Fprintln(w, "hello from go")'),
      panelLine('     })'),
      panelLine('     port := os.Getenv("PORT")'),
      panelLine('     if port == "" {'),
      panelLine('         port = "8080"'),
      panelLine('     }'),
      panelLine('     addr := "0.0.0.0:" + port'),
      panelLine('     log.Printf("listening on %s\\n", addr)'),
      panelLine('     log.Fatal(http.ListenAndServe(addr, mux))'),
      panelLine(' }'),
      panelBlank(),
      panelLine('    2) Containerize (multi-stage Dockerfile, static binary, nonroot)'),
      panelBlank(),
      panelLine('Create a Dockerfile:'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    // The Go code should be in a code block
    const blocks = extractCodeBlocks(result);
    const goBlock = blocks.find(b => b.includes('package main') && b.includes('func main()'));
    expect(goBlock).toBeDefined();

    // The numbered step header should NOT be in a code block
    const stepBlock = blocks.find(b => b.includes('2) Containerize'));
    expect(stepBlock).toBeUndefined();
    expect(result).toContain('2) Containerize');
  });

  // ── #12: Capitalized prose heading "Assumptions:" between Go code and Dockerfile ──
  it('#12 — Assumptions: between Go code and Dockerfile is prose, not code', () => {
    // When "Assumptions:" appears between a Go code block and a Dockerfile,
    // it should be treated as a prose heading — NOT absorbed into either
    // code block.  No empty code blocks should be produced.
    const body = [
      boldLine('Go + AKS deployment'),
      panelBlank(),
      boldLine('1. Minimal Go HTTP server (healthz + bind 0.0.0.0:8080)'),
      panelBlank(),
      panelLine(' package main'),
      panelLine(' import ('),
      panelLine('     "fmt"'),
      panelLine('     "net/http"'),
      panelLine(' )'),
      panelLine(' func main() {'),
      panelLine('     mux := http.NewServeMux()'),
      panelLine('     mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {'),
      panelLine('         fmt.Fprintln(w, "hello from go")'),
      panelLine('     })'),
      panelLine('     port := os.Getenv("PORT")'),
      panelLine('     if port == "" {'),
      panelLine('         port = "8080"'),
      panelLine('     }'),
      panelLine('     log.Fatal(http.ListenAndServe(":8080", nil))'),
      panelLine(' }'),
      panelBlank(),
      panelLine('Assumptions:'),
      panelBlank(),
      panelLine('FROM maven:3.9.8-eclipse-temurin-21 AS builder'),
      panelLine('WORKDIR /src'),
      panelLine('COPY pom.xml .'),
      panelLine('COPY src ./src'),
      panelLine('RUN mvn -q -DskipTests package'),
      panelLine('# runtime stage'),
      panelLine('FROM eclipse-temurin:21-jre-jammy'),
      panelLine('WORKDIR /app'),
      panelLine('COPY --from=builder /src/target/*.jar /app/app.jar'),
      panelLine('# optional hardening'),
      panelLine('RUN useradd -r -u 10001 appuser && chown -R 10001:10001 /app'),
      panelLine('USER 10001'),
      panelLine('EXPOSE 8080'),
      panelLine('ENV JAVA_OPTS="-XX:MaxRAMPercentage=75 -XX:+UseG1GC"'),
      panelLine('ENTRYPOINT ["sh","-c","java $JAVA_OPTS -jar /app/app.jar"]'),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);

    // Assumptions: should appear as prose, NOT in any code block
    const blocks = extractCodeBlocks(result);
    const assumptionsBlock = blocks.find(b => b.includes('Assumptions:'));
    expect(assumptionsBlock).toBeUndefined();
    expect(result).toContain('Assumptions:');

    // No empty code blocks
    const emptyBlock = blocks.find(b => b.trim() === '');
    expect(emptyBlock).toBeUndefined();

    // Go code should be in a code block
    const goBlock = blocks.find(b => b.includes('package main') && b.includes('func main()'));
    expect(goBlock).toBeDefined();

    // Dockerfile should be in a separate code block
    const dockerBlock = blocks.find(b => b.includes('FROM maven'));
    expect(dockerBlock).toBeDefined();
  });
});
