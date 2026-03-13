/**
 * Shared test fixtures for real-world AI agent response parsing scenarios.
 * Used by both parsing.test.ts and ContentRenderer.stories.tsx.
 */

/**
 * Helper: simulate a Rich-terminal-formatted line.
 * Real terminal output pads each content line to ~80 chars with ANSI color codes.
 */
function termLine(content: string, color = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${color}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

/** Helper: YAML comment line (grey on black) */
function commentLine(content: string): string {
  return termLine(content, '37;40');
}

/** Helper: YAML key line (red key, white colon/value) */
function yamlKeyLine(content: string): string {
  return termLine(content, '91;40');
}

/** Helper: Cyan-coloured code line (embedded Python in YAML) */
function codeLine(content: string): string {
  return termLine(content, '96;40');
}

// ─── Fixture 1: Microservices YAML with embedded Python & terminal line wrapping ─

/**
 * Reproduces a real-world scenario where the AI returns a large multi-document
 * YAML manifest with:
 * - YAML comments containing paths (e.g. "# - ingress routes /api/* and /")
 *   that looksLikeShellOrDockerCodeLine falsely matches as shell code
 * - A long YAML comment split at 80-char boundary ("this would\ncall /api/*")
 * - Embedded Python code inside a YAML `args: - |` block
 * - Multiple YAML documents separated by ---
 *
 * Key bugs this fixture exposed:
 * 1. normalizeTerminalMarkdown wrapped "# - ingress routes /api/*" as shell code
 * 2. Terminal-wrapped "call /api/*" continuation got its own code fence
 * 3. These spurious fences broke the YAML into fragments in ContentRenderer
 */
export const rawMicroservicesPythonYaml = [
  '\x1b[?2004l',
  '',
  '\x1b[?2004h> ',
  '\x1b[?2004l',
  '\x1b[?2004h> ',
  '\x1b[?2004l',
  "Loaded models: \x1b[1m[\x1b[0m\x1b[32m'azure/gpt-5.2'\x1b[0m\x1b[1m]\x1b[0m",
  '\x1b[1;33mThis tool uses AI to generate responses and may not always be accurate.\x1b[0m',
  '\x1b[1;97mUser:\x1b[0m Show me a microservices demo with Python',
  '\x1b[1;96mAI:\x1b[0m ',
  // Terminal-formatted YAML comments
  commentLine('# microservices-demo.yaml'),
  commentLine('# Example "many microservices" app:'),
  commentLine('# - web (public entrypoint)'),
  commentLine('# - user + catalog (internal APIs)'),
  commentLine('# - orders (internal API) calls user+catalog via env vars'),
  commentLine('# - redis (state)'),
  // This comment contains /api/* path — triggers shell code false positive
  commentLine('# - ingress routes /api/* and /'),
  termLine(''),
  // First YAML document: Namespace
  termLine('apiVersion: v1'),
  termLine('kind: Namespace'),
  termLine('metadata:'),
  termLine('  name: micro-demo'),
  termLine('---'),
  // Second YAML document: Deployment with embedded Python
  termLine('apiVersion: apps/v1'),
  termLine('kind: Deployment'),
  termLine('metadata:'),
  termLine('  name: web'),
  termLine('  namespace: micro-demo'),
  termLine('spec:'),
  termLine('  replicas: 2'),
  termLine('  selector:'),
  termLine('    matchLabels: { app: web }'),
  termLine('  template:'),
  termLine('    metadata:'),
  termLine('      labels: { app: web }'),
  termLine('    spec:'),
  termLine('      containers:'),
  termLine('        - name: web'),
  termLine('          image: python:3.12-slim'),
  termLine('          ports:'),
  termLine('            - name: http'),
  termLine('              containerPort: 8080'),
  // This long YAML comment gets split at 80-char terminal boundary
  commentLine('          # Simple "web" that serves a landing page; in real setups this would'),
  // "call /api/*" is the continuation — looks like shell code but is YAML comment
  commentLine('call /api/*'),
  termLine('          command: ["python"]'),
  termLine('          args:'),
  termLine('            - -c'),
  termLine('            - |'),
  // Embedded Python code inside YAML args block
  codeLine('              from http.server import BaseHTTPRequestHandler, HTTPServer'),
  codeLine('              class H(BaseHTTPRequestHandler):'),
  codeLine('                def do_GET(self):'),
  codeLine('                  self.send_response(200)'),
  codeLine('                  self.send_header("Content-Type","text/plain")'),
  codeLine('                  self.end_headers()'),
  codeLine('                  self.wfile.write(b"web OK\\n")'),
  codeLine('              HTTPServer(("0.0.0.0",8080),H).serve_forever()'),
  termLine('          readinessProbe:'),
  termLine('            httpGet: { path: "/", port: 8080 }'),
  termLine('            initialDelaySeconds: 2'),
  termLine('          resources:'),
  termLine('            requests: { cpu: 25m, memory: 64Mi }'),
  termLine('            limits: { cpu: 200m, memory: 256Mi }'),
  termLine('---'),
  // Third YAML document: Service
  termLine('apiVersion: v1'),
  termLine('kind: Service'),
  termLine('metadata:'),
  termLine('  name: web'),
  termLine('  namespace: micro-demo'),
  termLine('spec:'),
  termLine('  selector: { app: web }'),
  termLine('  ports:'),
  termLine('    - name: http'),
  termLine('      port: 80'),
  termLine('      targetPort: 8080'),
  termLine('---'),
  // Fourth YAML document: Redis Deployment
  termLine('apiVersion: apps/v1'),
  termLine('kind: Deployment'),
  termLine('metadata:'),
  termLine('  name: redis'),
  termLine('  namespace: micro-demo'),
  termLine('spec:'),
  termLine('  replicas: 1'),
  termLine('  selector:'),
  termLine('    matchLabels: { app: redis }'),
  termLine('  template:'),
  termLine('    metadata:'),
  termLine('      labels: { app: redis }'),
  termLine('    spec:'),
  termLine('      containers:'),
  termLine('        - name: redis'),
  termLine('          image: redis:7-alpine'),
  termLine('          ports:'),
  termLine('            - name: redis'),
  termLine('              containerPort: 6379'),
  termLine('          resources:'),
  termLine('            requests: { cpu: 25m, memory: 64Mi }'),
  termLine('            limits: { cpu: 300m, memory: 256Mi }'),
  termLine('---'),
  // Fifth YAML document: Redis Service
  termLine('apiVersion: v1'),
  termLine('kind: Service'),
  termLine('metadata:'),
  termLine('  name: redis'),
  termLine('  namespace: micro-demo'),
  termLine('spec:'),
  termLine('  selector: { app: redis }'),
  termLine('  ports:'),
  termLine('    - name: redis'),
  termLine('      port: 6379'),
  termLine('      targetPort: 6379'),
  '',
  '',
  // Trailing kubectl commands
  termLine('kubectl apply -f microservices-demo.yaml'),
  termLine(''),
  termLine('kubectl get all -n micro-demo'),
  '',
  '\x1b[?2004hroot@aks-agent-649f94dbb9-whtf8:/app# ',
].join('\r\n');

// ─── Fixture 2: Python Flask app with __name__ dunder pattern ────────────────

/**
 * Reproduces a scenario where the AI returns bare Python code with __name__
 * that gets interpreted as markdown bold (**name**) if not properly fenced.
 *
 * Key bugs this fixture exposed:
 * 1. "app = Flask(__name__)" → __name__ rendered as <strong>name</strong>
 * 2. "from flask import Flask" not detected as code
 * 3. "@app.route" decorator not detected as code
 */
export const rawPythonFlaskApp = [
  '\x1b[1;96mAI:\x1b[0m ',
  'Here is a simple Flask app:',
  '',
  'from flask import Flask, jsonify',
  'app = Flask(__name__)',
  '',
  '@app.route("/")',
  'def index():',
  '    return jsonify({"status": "ok"})',
  '',
  'if __name__ == "__main__":',
  '    app.run(host="0.0.0.0", port=5000)',
  '',
  'Save this as app.py and run it.',
  '',
  '\x1b[?2004hroot@aks-agent-pod:/app# ',
].join('\r\n');

// ─── Fixture 3: Python imports (bare, no Flask) ─────────────────────────────

/**
 * Simple scenario: bare Python imports that should be fenced as code.
 */
export const rawPythonImports = [
  '\x1b[1;96mAI:\x1b[0m ',
  'Use this script:',
  '',
  'import os',
  'from pathlib import Path',
  '',
  'That will work.',
  '',
  '\x1b[?2004hroot@aks-agent-pod:/app# ',
].join('\r\n');
