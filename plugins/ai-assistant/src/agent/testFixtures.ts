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

/** Helper: Cyan-coloured code line (embedded Python in YAML) */
function codeLine(content: string): string {
  return termLine(content, '96;40');
}

/**
 * Helper: simulate a Rich code panel line.
 * Rich renders code blocks as panels with [40m background on every line,
 * with individual characters colored via different SGR codes.
 * The optional second color parameter mirrors the real terminal format
 * where keys and values have different colors, but our simplified helper
 * only applies the first color.
 */
function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

/** Helper: blank panel line (just [40m background filling the whole width) */
function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
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

// ─── Fixture 4: Rust Axum app with indented method chains and {-blocks ────────

/**
 * Reproduces a real-world scenario where the AI returns Rust code with:
 * - Rust `use` imports, `async fn`, `let` bindings
 * - Method chains (.route(...)) indented under a let binding
 * - #[tokio::main] attribute
 * - Closing braces `}` on their own lines
 * - Mixed content: shell commands, Cargo.toml, Rust source, Dockerfile, YAML
 *
 * Key bugs this fixture exposes:
 * 1. normalizeTerminalMarkdown wraps Rust code but closes at indented .route()
 * 2. Closing `}` leaks as plain text paragraph
 * 3. Indented method chains broken into separate code blocks
 */
export const rawRustAxumApp = [
  '\x1b[?2004l',
  '',
  '\x1b[?2004h> ',
  '\x1b[?2004l',
  "Loaded models: \x1b[1m[\x1b[0m\x1b[32m'azure/gpt-5.2'\x1b[0m\x1b[1m]\x1b[0m",
  '\x1b[1;33mThis tool uses AI to generate responses and may not always be accurate.\x1b[0m',
  '\x1b[1;97mUser:\x1b[0m Show me how to deploy a rust example app to kubernetes?',
  '\x1b[1;96mAI:\x1b[0m ',
  // Section heading (centered, bold+underline) — real Rich terminal format
  '                         \x1b[1;4m1) Create a tiny Rust HTTP app\x1b[0m                         ',
  '',
  // Bold heading for file name (NOT inside panel — Rich renders these outside)
  '\x1b[1mCargo.toml\x1b[0m'.padEnd(80),
  '',
  // Rich code panel: [40m background on EVERY line, each char individually colored
  panelBlank(),
  panelLine('[package]', '96;40'),
  panelLine('name = "rust-k8s-example"', '97;40'),
  panelLine('version = "0.1.0"', '97;40'),
  panelLine('edition = "2021"', '97;40'),
  panelBlank(),
  panelLine('[dependencies]', '96;40'),
  panelLine('axum = "0.7"', '97;40'),
  panelLine('tokio = { version = "1", features = ["macros", "rt-multi-thread"] }', '97;40'),
  panelBlank(),
  '',
  // Bold heading for Rust source file
  '\x1b[1msrc/main.rs\x1b[0m'.padEnd(80),
  '',
  panelBlank(),
  panelLine('use axum::{routing::get, Router};', '96;40'),
  panelLine('use std::net::SocketAddr;', '96;40'),
  panelBlank(),
  panelLine("async fn healthz() -> &'static str {", '96;40'),
  panelLine('    "ok"', '93;40'),
  panelLine('}'),
  panelBlank(),
  panelLine("async fn root() -> &'static str {", '96;40'),
  panelLine('    "hello from rust"', '93;40'),
  panelLine('}'),
  panelBlank(),
  panelLine('#[tokio::main]', '37;40'),
  panelLine('async fn main() {', '96;40'),
  panelLine('    let app = Router::new()', '96;40'),
  panelLine('        .route("/", get(root))', '97;40'),
  panelLine('        .route("/healthz", get(healthz));', '97;40'),
  panelBlank(),
  panelLine('    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));', '96;40'),
  panelLine('    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();', '97;40'),
  panelLine('    axum::serve(listener, app).await.unwrap();', '97;40'),
  panelLine('}'),
  panelBlank(),
  '',
  '',
  // Section 2 heading
  '                 \x1b[1;4m2) Containerize it (multi-stage Docker build)\x1b[0m                  ',
  '',
  // Bold heading for Dockerfile
  '\x1b[1mDockerfile\x1b[0m'.padEnd(80),
  '',
  panelBlank(),
  panelLine('# build stage', '37;40'),
  panelLine('FROM rust:1.76 as builder', '96;40'),
  panelLine('WORKDIR /app', '96;40'),
  panelLine('COPY Cargo.toml Cargo.lock ./', '96;40'),
  panelLine('RUN mkdir -p src && echo "fn main(){}" > src/main.rs', '96;40'),
  panelLine('RUN cargo build --release', '96;40'),
  panelLine('COPY src ./src', '96;40'),
  panelLine('RUN cargo build --release', '96;40'),
  panelBlank(),
  panelLine('# runtime stage', '37;40'),
  panelLine('FROM gcr.io/distroless/cc-debian12:nonroot', '96;40'),
  panelLine('WORKDIR /app', '96;40'),
  panelLine(
    'COPY --from=builder /app/target/release/rust-k8s-example /app/rust-k8s-example',
    '96;40'
  ),
  panelLine('EXPOSE 8080', '96;40'),
  panelLine('USER nonroot:nonroot', '96;40'),
  panelLine('ENTRYPOINT ["/app/rust-k8s-example"]', '96;40'),
  panelBlank(),
  '',
  'Build + push (example with Docker Hub):'.padEnd(80),
  '',
  panelBlank(),
  panelLine('export IMAGE=docker.io/<youruser>/rust-k8s-example:0.1.0', '97;40'),
  panelLine('docker build -t $IMAGE .', '97;40'),
  panelLine('docker push $IMAGE', '97;40'),
  panelBlank(),
  '',
  '',
  // Section 3 heading
  '                            \x1b[1;4m3) Deploy to Kubernetes\x1b[0m                             ',
  '',
  'Save as \x1b[1;36;40mk8s.yaml\x1b[0m (replace \x1b[1;36;40mimage:\x1b[0m with your pushed image):'.padEnd(
    80
  ),
  '',
  panelBlank(),
  panelLine('apiVersion: v1', '91;40'),
  panelLine('kind: Namespace', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: rust-demo', '91;40'),
  panelLine('---', '97;40'),
  panelLine('apiVersion: apps/v1', '91;40'),
  panelLine('kind: Deployment', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: rust-k8s-example', '91;40'),
  panelLine('  namespace: rust-demo', '91;40'),
  panelLine('spec:', '91;40'),
  panelLine('  replicas: 2', '91;40'),
  panelLine('  selector:', '91;40'),
  panelLine('    matchLabels:', '91;40'),
  panelLine('      app: rust-k8s-example', '91;40'),
  panelLine('  template:', '91;40'),
  panelLine('    metadata:', '91;40'),
  panelLine('      labels:', '91;40'),
  panelLine('        app: rust-k8s-example', '91;40'),
  panelLine('    spec:', '91;40'),
  panelLine('      containers:', '91;40'),
  panelLine('        - name: app', '91;40'),
  panelLine('          image: docker.io/<youruser>/rust-k8s-example:0.1.0', '91;40'),
  panelLine('          ports:', '91;40'),
  panelLine('            - containerPort: 8080', '91;40'),
  panelLine('          readinessProbe:', '91;40'),
  panelLine('            httpGet:', '91;40'),
  panelLine('              path: /healthz', '91;40'),
  panelLine('              port: 8080', '91;40'),
  panelLine('            initialDelaySeconds: 2', '91;40'),
  panelLine('            periodSeconds: 5', '91;40'),
  panelLine('          livenessProbe:', '91;40'),
  panelLine('            httpGet:', '91;40'),
  panelLine('              path: /healthz', '91;40'),
  panelLine('              port: 8080', '91;40'),
  panelLine('            initialDelaySeconds: 10', '91;40'),
  panelLine('            periodSeconds: 10', '91;40'),
  panelLine('          resources:', '91;40'),
  panelLine('            requests:', '91;40'),
  panelLine('              cpu: 50m', '91;40'),
  panelLine('              memory: 64Mi', '91;40'),
  panelLine('            limits:', '91;40'),
  panelLine('              cpu: 250m', '91;40'),
  panelLine('              memory: 256Mi', '91;40'),
  panelLine('---', '97;40'),
  panelLine('apiVersion: v1', '91;40'),
  panelLine('kind: Service', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: rust-k8s-example', '91;40'),
  panelLine('  namespace: rust-demo', '91;40'),
  panelLine('spec:', '91;40'),
  panelLine('  selector:', '91;40'),
  panelLine('    matchLabels:', '91;40'),
  panelLine('      app: rust-k8s-example', '91;40'),
  panelLine('  ports:', '91;40'),
  panelLine('    - name: http', '91;40'),
  panelLine('      port: 80', '91;40'),
  panelLine('      targetPort: 8080', '91;40'),
  panelLine('  type: ClusterIP', '91;40'),
  panelBlank(),
  '',
  'Apply + test:'.padEnd(80),
  '',
  panelBlank(),
  panelLine('kubectl apply -f k8s.yaml', '97;40'),
  panelLine('kubectl -n rust-demo get pods', '97;40'),
  panelLine('kubectl -n rust-demo port-forward svc/rust-k8s-example 8080:80', '97;40'),
  panelLine('curl http://localhost:8080/', '97;40'),
  panelLine('curl http://localhost:8080/healthz', '97;40'),
  panelBlank(),
  '',
  'If you want it exposed externally, tell me what you have (Ingress controller?',
  "AKS LoadBalancer?) and I'll give the exact Service/Ingress YAML.",
  '\x1b[?2004hroot@aks-agent-649f94dbb9-whtf8:/app# ',
].join('\r\n');

// ─── Fixture 4: Rust K8s deployment with bold section headings & large YAML ──

/**
 * Reproduces a real-world scenario where:
 * - The AI doesn't use "# filename" headers; instead Rich renders bold section
 *   headings like "Dockerfile (multi-stage, small runtime image)" centered.
 * - A bold section heading wraps across two terminal lines:
 *   "Kubernetes manifests (Namespace + ConfigMap + Deployment + Service + optional"
 *   "                            Ingress + optional HPA)"
 * - A YAML key is split by a newline inside the code panel:
 *   "averageUtilization\n: 70"
 * - The YAML block is large (Namespace + ConfigMap + Deployment + Service +
 *   Ingress + HPA) and needs to stay as one ```yaml``` block.
 *
 * Key bugs this fixture exposes:
 * 1. Bold wrapped section heading gets partially absorbed into code block
 * 2. YAML key split by newline produces "averageUtilization" code block + ": 70" text
 * 3. The Dockerfile code block may absorb the next section heading
 */
export const rawRustK8sDeployment = [
  '\x1b[?2004l',
  '',
  '\x1b[?2004h> ',
  '\x1b[?2004l',
  "Loaded models: \x1b[1m[\x1b[0m\x1b[32m'azure/gpt-5.2'\x1b[0m\x1b[1m]\x1b[0m",
  '\x1b[1;33mThis tool uses AI to generate responses and may not always be accurate.\x1b[0m',
  '\x1b[1;97mUser:\x1b[0m Show me an example rust deployment to kubernetes?',
  '\x1b[1;96mAI:\x1b[0m ',
  // Prose intro
  'Example Rust HTTP service (listens on \x1b[1;36;40m0.0.0.0:8080\x1b[0m, has \x1b[1;36;40m/healthz\x1b[0m and \x1b[1;36;40m/readyz\x1b[0m)'.padEnd(
    80
  ),
  'deployed to Kubernetes.'.padEnd(80),
  '',
  // Bold centered section heading: "Dockerfile (multi-stage, small runtime image)"
  '                 \x1b[1mDockerfile (multi-stage, small runtime image)\x1b[0m'.padEnd(80),
  '',
  // Dockerfile panel
  panelBlank(),
  panelLine('# syntax=docker/dockerfile:1', '37;40'),
  panelLine('', '40'),
  panelLine('FROM rust:1.76-bullseye AS builder', '96;40'),
  panelLine('WORKDIR /app', '96;40'),
  panelLine('', '40'),
  panelLine('# Cache deps', '37;40'),
  panelLine('COPY Cargo.toml Cargo.lock ./', '96;40'),
  panelLine('RUN mkdir -p src && echo "fn main() {}" > src/main.rs', '96;40'),
  panelLine('RUN cargo build --release', '96;40'),
  panelLine('', '40'),
  panelLine('# Build real app', '37;40'),
  panelLine('COPY . .', '96;40'),
  panelLine('RUN cargo build --release', '96;40'),
  panelLine('', '40'),
  panelLine('# Minimal runtime', '37;40'),
  panelLine('FROM debian:bookworm-slim', '96;40'),
  panelLine('RUN useradd -u 10001 -m appuser \\', '96;40'),
  panelLine('  && apt-get update \\', '96;40'),
  panelLine('  && apt-get install -y --no-install-recommends ca-certificates \\', '96;40'),
  panelLine('  && rm -rf /var/lib/apt/lists/*', '96;40'),
  panelLine('WORKDIR /app', '96;40'),
  panelLine('COPY --from=builder /app/target/release/my-rust-app /app/my-rust-app', '96;40'),
  panelLine('USER 10001:10001', '96;40'),
  panelLine('EXPOSE 8080', '96;40'),
  panelLine('ENV RUST_LOG=info', '96;40'),
  panelLine('ENTRYPOINT ["/app/my-rust-app"]', '96;40'),
  panelBlank(),
  '',
  // Bold section heading that wraps across TWO terminal lines
  ' \x1b[1mKubernetes manifests (Namespace + ConfigMap + Deployment + Service + optional\x1b[0m'.padEnd(
    80
  ),
  '                            \x1b[1mIngress + optional HPA)\x1b[0m'.padEnd(80),
  '',
  // YAML panel — large manifest
  panelBlank(),
  panelLine('apiVersion: v1', '91;40'),
  panelLine('kind: Namespace', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: rust-demo', '91;40'),
  panelLine('---', '97;40'),
  panelLine('apiVersion: v1', '91;40'),
  panelLine('kind: ConfigMap', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: my-rust-app-config', '91;40'),
  panelLine('  namespace: rust-demo', '91;40'),
  panelLine('data:', '91;40'),
  panelLine('  RUST_LOG: "info"', '91;40'),
  panelLine('  APP_GREETING: "hello from rust"', '91;40'),
  panelLine('---', '97;40'),
  panelLine('apiVersion: apps/v1', '91;40'),
  panelLine('kind: Deployment', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: my-rust-app', '91;40'),
  panelLine('  namespace: rust-demo', '91;40'),
  panelLine('  labels:', '91;40'),
  panelLine('    app: my-rust-app', '91;40'),
  panelLine('spec:', '91;40'),
  panelLine('  replicas: 2', '91;40'),
  panelLine('  selector:', '91;40'),
  panelLine('    matchLabels:', '91;40'),
  panelLine('      app: my-rust-app', '91;40'),
  panelLine('  template:', '91;40'),
  panelLine('    metadata:', '91;40'),
  panelLine('      labels:', '91;40'),
  panelLine('        app: my-rust-app', '91;40'),
  panelLine('    spec:', '91;40'),
  panelLine('      securityContext:', '91;40'),
  panelLine('        seccompProfile:', '91;40'),
  panelLine('          type: RuntimeDefault', '91;40'),
  panelLine('      containers:', '91;40'),
  panelLine('        - name: app', '91;40'),
  panelLine('          image: ghcr.io/your-org/my-rust-app:1.0.0', '91;40'),
  panelLine('          imagePullPolicy: IfNotPresent', '91;40'),
  panelLine('          ports:', '91;40'),
  panelLine('            - name: http', '91;40'),
  panelLine('              containerPort: 8080', '91;40'),
  panelLine('          envFrom:', '91;40'),
  panelLine('            - configMapRef:', '91;40'),
  panelLine('                name: my-rust-app-config', '91;40'),
  panelLine('          resources:', '91;40'),
  panelLine('            requests:', '91;40'),
  panelLine('              cpu: 50m', '91;40'),
  panelLine('              memory: 64Mi', '91;40'),
  panelLine('            limits:', '91;40'),
  panelLine('              cpu: 500m', '91;40'),
  panelLine('              memory: 256Mi', '91;40'),
  panelLine('          securityContext:', '91;40'),
  panelLine('            allowPrivilegeEscalation: false', '91;40'),
  panelLine('            readOnlyRootFilesystem: true', '91;40'),
  panelLine('            runAsNonRoot: true', '91;40'),
  panelLine('            runAsUser: 10001', '91;40'),
  panelLine('            capabilities:', '91;40'),
  panelLine('              drop: ["ALL"]', '91;40'),
  panelLine('          livenessProbe:', '91;40'),
  panelLine('            httpGet:', '91;40'),
  panelLine('              path: /healthz', '91;40'),
  panelLine('              port: http', '91;40'),
  panelLine('            initialDelaySeconds: 10', '91;40'),
  panelLine('            periodSeconds: 10', '91;40'),
  panelLine('            timeoutSeconds: 2', '91;40'),
  panelLine('            failureThreshold: 3', '91;40'),
  panelLine('          readinessProbe:', '91;40'),
  panelLine('            httpGet:', '91;40'),
  panelLine('              path: /readyz', '91;40'),
  panelLine('              port: http', '91;40'),
  panelLine('            initialDelaySeconds: 3', '91;40'),
  panelLine('            periodSeconds: 5', '91;40'),
  panelLine('            timeoutSeconds: 2', '91;40'),
  panelLine('            failureThreshold: 3', '91;40'),
  panelLine('---', '97;40'),
  panelLine('apiVersion: v1', '91;40'),
  panelLine('kind: Service', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: my-rust-app', '91;40'),
  panelLine('  namespace: rust-demo', '91;40'),
  panelLine('spec:', '91;40'),
  panelLine('  selector:', '91;40'),
  panelLine('    app: my-rust-app', '91;40'),
  panelLine('  ports:', '91;40'),
  panelLine('    - name: http', '91;40'),
  panelLine('      port: 80', '91;40'),
  panelLine('      targetPort: http', '91;40'),
  panelLine('  type: ClusterIP', '91;40'),
  panelLine('---', '97;40'),
  panelLine('# Optional: Ingress (requires an Ingress controller, e.g., nginx)', '37;40'),
  panelLine('apiVersion: networking.k8s.io/v1', '91;40'),
  panelLine('kind: Ingress', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: my-rust-app', '91;40'),
  panelLine('  namespace: rust-demo', '91;40'),
  panelLine('spec:', '91;40'),
  panelLine('  ingressClassName: nginx', '91;40'),
  panelLine('  rules:', '91;40'),
  panelLine('    - host: my-rust-app.example.com', '91;40'),
  panelLine('      http:', '91;40'),
  panelLine('        paths:', '91;40'),
  panelLine('          - path: /', '91;40'),
  panelLine('            pathType: Prefix', '91;40'),
  panelLine('            backend:', '91;40'),
  panelLine('              service:', '91;40'),
  panelLine('                name: my-rust-app', '91;40'),
  panelLine('                port:', '91;40'),
  panelLine('                  number: 80', '91;40'),
  panelLine('---', '97;40'),
  panelLine('# Optional: HPA (requires metrics-server)', '37;40'),
  panelLine('apiVersion: autoscaling/v2', '91;40'),
  panelLine('kind: HorizontalPodAutoscaler', '91;40'),
  panelLine('metadata:', '91;40'),
  panelLine('  name: my-rust-app', '91;40'),
  panelLine('  namespace: rust-demo', '91;40'),
  panelLine('spec:', '91;40'),
  panelLine('  scaleTargetRef:', '91;40'),
  panelLine('    apiVersion: apps/v1', '91;40'),
  panelLine('    kind: Deployment', '91;40'),
  panelLine('    name: my-rust-app', '91;40'),
  panelLine('  minReplicas: 2', '91;40'),
  panelLine('  maxReplicas: 10', '91;40'),
  panelLine('  metrics:', '91;40'),
  panelLine('    - type: Resource', '91;40'),
  panelLine('      resource:', '91;40'),
  panelLine('        name: cpu', '91;40'),
  panelLine('        target:', '91;40'),
  panelLine('          type: Utilization', '91;40'),
  // The real terminal output has a newline splitting the YAML key from its colon
  // This simulates: "averageUtilization\n: 70" as seen in the actual console log
  panelLine('          averageUtilization', '91;40'),
  panelLine(': 70', '91;40'),
  panelBlank(),
  '',
  'Apply:'.padEnd(80),
  '',
  panelBlank(),
  panelLine('kubectl apply -f k8s.yaml', '97;40'),
  panelBlank(),
  '\x1b[?2004hroot@aks-agent-649f94dbb9-whtf8:/app# ',
].join('\r\n');
