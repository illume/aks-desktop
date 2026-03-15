/**
 * Shared test fixture data extracted from findbugs.test.ts (round 1),
 * findbugs2.test.ts (round 2), findbugs3.test.ts (round 3), and
 * findbugs4.test.ts (round 4).
 *
 * Each fixture is the raw terminal output for a single test case,
 * exported as a named constant following the convention fb{round}_{shortName}.
 *
 * Used by tests and (optionally) Storybook stories.
 */
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate a Rich-terminal formatted code-panel line (80 chars wide). */
function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

/** Empty panel line (80 spaces with ANSI background). */
function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
}

/** Wrap a body array with the standard terminal prefix / suffix. */
function makeRaw(body: string[]): string {
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
  return [...prefix, ...body, ...suffix].join('\n');
}

/** Extract markdown fenced code blocks from a parsed result string. */
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

/**
 * Assert that no ANSI escape sequences leaked into the output.
 * Throws an Error (no vitest dependency) so it works in any context.
 */
function assertNoAnsiLeaks(result: string): void {
  if (/\x1b/.test(result)) {
    throw new Error('ANSI escape (\\x1b) found in result');
  }
  if (/\x1b\[\d+m/.test(result)) {
    throw new Error('ANSI color code (ESC[Nm) found in result');
  }
}

export { panelLine, panelBlank, makeRaw, extractCodeBlocks, assertNoAnsiLeaks };

// ===========================================================================
// Round 1 – findbugs.test.ts
// ===========================================================================

/** Two file headings with no blank line between panels */
export const fb1_twoFileHeadings = makeRaw([
  panelBlank(),
  '                             Cargo.toml',
  panelBlank(),
  panelLine('[package]'),
  panelLine('name = "myapp"'),
  '                             src/main.rs',
  panelBlank(),
  panelLine('fn main() {'),
  panelLine('    println!("hello");'),
  panelLine('}'),
]);

/** File heading with extension-only name .env */
export const fb1_dotEnvHeading = makeRaw([
  panelBlank(),
  '                             .env',
  panelBlank(),
  panelLine('DB_HOST=localhost'),
  panelLine('DB_PORT=5432'),
]);

/** File heading with deep path src/handlers/auth.rs */
export const fb1_deepPathHeading = makeRaw([
  panelBlank(),
  '                             src/handlers/auth.rs',
  panelBlank(),
  panelLine('pub fn authenticate(req: &Request) -> bool {'),
  panelLine('    true'),
  panelLine('}'),
]);

/** Prose with 4 words should NOT break file-header block */
export const fb1_fourWordProse = makeRaw([
  panelBlank(),
  '                             config.yaml',
  panelBlank(),
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('good luck with this'),
  panelLine('data:'),
  panelLine('  key: value'),
]);

/** Prose with 5 words SHOULD break file-header block */
export const fb1_fiveWordProse = makeRaw([
  panelBlank(),
  '                             config.yaml',
  panelBlank(),
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('This creates the main application'),
  panelLine('data:'),
  panelLine('  key: value'),
]);

/** YAML annotation with pipe literal block scalar */
export const fb1_yamlPipeLiteral = makeRaw([
  'apiVersion: networking.k8s.io/v1',
  'kind: Ingress',
  'metadata:',
  '  annotations:',
  '    nginx.ingress.kubernetes.io/configuration-snippet: |',
  '      more_set_headers "X-Frame-Options: DENY";',
  '      more_set_headers "X-XSS-Protection: 1";',
  'spec:',
  '  rules: []',
]);

/** Bare YAML with 2 lines should NOT be wrapped */
export const fb1_bareYaml2Lines = makeRaw([
  'Here is the config:',
  '',
  'name: myapp',
  'version: "1.0"',
]);

/** Bare YAML with 3 lines SHOULD be wrapped */
export const fb1_bareYaml3Lines = makeRaw([
  'Here is the config:',
  '',
  'name: myapp',
  'version: "1.0"',
  'description: "A test"',
]);

/** Dockerfile heading with deeply indented continuation lines */
export const fb1_dockerfileContinuation = makeRaw([
  panelBlank(),
  '                             Dockerfile',
  panelBlank(),
  panelLine('FROM ubuntu:22.04'),
  panelLine('RUN apt-get update && \\'),
  panelLine('    apt-get install -y \\'),
  panelLine('    curl \\'),
  panelLine('    wget'),
]);

/** docker-compose.yml bold heading */
export const fb1_dockerCompose = makeRaw([
  panelBlank(),
  '                             docker-compose.yml',
  panelBlank(),
  panelLine('version: "3.8"'),
  panelLine('services:'),
  panelLine('  web:'),
  panelLine('    image: nginx:latest'),
]);

/** Panel code starting with port number */
export const fb1_portNumber = makeRaw([
  panelBlank(),
  '                             server.conf',
  panelBlank(),
  panelLine('3000'),
  panelLine('listen_address: 0.0.0.0'),
]);

/** ANSI 256-color code fully stripped */
export const fb1_ansi256Color = makeRaw([
  '\x1b[38;5;208mWarning: resource limit exceeded\x1b[0m',
  'Please adjust your quota.',
]);

/** Go interface{} type should not cause issues */
export const fb1_goInterface = makeRaw([
  panelBlank(),
  '                             main.go',
  panelBlank(),
  panelLine('package main'),
  panelLine(''),
  panelLine('var result interface{}'),
  panelLine(''),
  panelLine('func main() {'),
  panelLine('    result = "hello"'),
  panelLine('}'),
]);

/** Two YAML blocks separated by prose */
export const fb1_twoYamlBlocks = makeRaw([
  'First, create the namespace:',
  '',
  'apiVersion: v1',
  'kind: Namespace',
  'metadata:',
  '  name: production',
  '',
  'Then create the deployment:',
  '',
  'apiVersion: apps/v1',
  'kind: Deployment',
  'metadata:',
  '  name: web',
]);

/** Shell backtick substitution at column 0 */
export const fb1_shellBacktick = makeRaw([
  'Run this command:',
  '',
  'PODS=`kubectl get pods -o name`',
  'echo $PODS',
]);

/** Makefile heading with tab-indented content */
export const fb1_makefileTab = makeRaw([
  panelBlank(),
  '                             Makefile',
  panelBlank(),
  panelLine('build:'),
  panelLine('\t@echo "Building..."'),
  panelLine('\tgo build -o app .'),
]);

/** YAML folded scalar with > indicator */
export const fb1_yamlFoldedScalar = makeRaw([
  panelBlank(),
  '                             values.yaml',
  panelBlank(),
  panelLine('app:'),
  panelLine('  description: >'),
  panelLine('    This is a long description'),
  panelLine('    that spans multiple lines'),
  panelLine('  port: 8080'),
]);

/** Indented code after numbered list item */
export const fb1_indentedCodeAfterList = makeRaw([
  '1. Create the deployment file:',
  '',
  panelLine('kubectl apply -f deployment.yaml'),
  panelLine('kubectl rollout status deployment/web'),
]);

/** requirements.txt with pip freeze output */
export const fb1_requirementsTxt = makeRaw([
  panelBlank(),
  '                             requirements.txt',
  panelBlank(),
  panelLine('flask==2.3.0'),
  panelLine('requests==2.31.0'),
  panelLine('gunicorn==21.2.0'),
]);

/** Bare code followed by bare YAML creates 2 blocks */
export const fb1_bareCodeThenYaml = makeRaw([
  'First, run:',
  '',
  'kubectl create namespace production',
  'kubectl config set-context --current --namespace=production',
  '',
  'Then apply this manifest:',
  '',
  'apiVersion: v1',
  'kind: Service',
  'metadata:',
  '  name: web',
]);

/** Hyphenated filename my-app.yaml */
export const fb1_hyphenatedFilename = makeRaw([
  panelBlank(),
  '                             my-app.yaml',
  panelBlank(),
  panelLine('apiVersion: v1'),
  panelLine('kind: Pod'),
]);

/** ANSI code split across line boundary */
export const fb1_ansiSplitLine = makeRaw([
  'The config is:\x1b[',
  '97;40m This is the value\x1b[0m',
  'End of output.',
]);

/** Windows-style paths in panel content */
export const fb1_windowsPaths = makeRaw([
  panelBlank(),
  '                             config.yaml',
  panelBlank(),
  panelLine('source: C:\\Users\\app\\config.yaml'),
  panelLine('dest: C:\\Program Files\\app\\out'),
]);

/** Very long line in panel exceeding 78 chars */
export const fb1_longPanelLine = makeRaw([
  panelBlank(),
  '                             Dockerfile',
  panelBlank(),
  panelLine('FROM ubuntu:22.04'),
  panelLine(
    'RUN apt-get update && apt-get install -y curl wget git build-essential libssl-dev pkg-config'
  ),
]);

/** Dockerfile.prod compound extension heading */
export const fb1_dockerfileProd = makeRaw([
  panelBlank(),
  '                             Dockerfile.prod',
  panelBlank(),
  panelLine('FROM node:20-slim AS builder'),
  panelLine('WORKDIR /app'),
]);

/** YAML flow-style mapping */
export const fb1_yamlFlowMapping = makeRaw([
  'apiVersion: v1',
  'kind: ConfigMap',
  'metadata:',
  '  name: test',
  '  labels: { app: web, env: prod }',
  'data:',
  '  key: value',
]);

/** kubectl command with tabular output */
export const fb1_kubectlTabular = makeRaw([
  'Check pod status:',
  '',
  'kubectl get pods',
  'NAME          STATUS    RESTARTS   AGE',
  'web-abc123    Running   0          5m',
  'api-def456    Running   1          3m',
]);

/** Panel code containing triple backticks */
export const fb1_panelTripleBacktick = makeRaw([
  panelBlank(),
  '                             README.md',
  panelBlank(),
  panelLine('# My App'),
  panelLine(''),
  panelLine('```bash'),
  panelLine('npm install'),
  panelLine('```'),
]);

/** tsconfig.json with JSON content */
export const fb1_tsconfigJson = makeRaw([
  panelBlank(),
  '                             tsconfig.json',
  panelBlank(),
  panelLine('{'),
  panelLine('  "compilerOptions": {'),
  panelLine('    "target": "ES2020",'),
  panelLine('    "module": "commonjs"'),
  panelLine('  }'),
  panelLine('}'),
]);

/** Indented line with flags should not be treated as prose */
export const fb1_flagsNotProse = makeRaw([
  panelBlank(),
  '                             deploy.sh',
  panelBlank(),
  panelLine('#!/bin/bash'),
  panelLine('kubectl apply -f manifest.yaml'),
  panelLine('  --namespace production --replicas 3 --dry-run client'),
]);

// ===========================================================================
// Round 2 – findbugs2.test.ts
// ===========================================================================

/** Non-K8s YAML ending with prose line containing colon */
export const fb2_nonK8sYamlProse = makeRaw([
  'name: my-app',
  'version: "1.0"',
  'description: short',
  'Note: you can also use Helm to install this chart',
]);

/** Bold file heading .gitignore */
export const fb2_gitignoreHeading = makeRaw([
  panelBlank(),
  '                             .gitignore',
  panelBlank(),
  panelLine('node_modules/'),
  panelLine('dist/'),
  panelLine('.env'),
]);

/** Bold file heading .dockerignore */
export const fb2_dockerignoreHeading = makeRaw([
  panelBlank(),
  '                             .dockerignore',
  panelBlank(),
  panelLine('node_modules'),
  panelLine('.git'),
  panelLine('Dockerfile'),
]);

/** YAML with --- separator between two documents */
export const fb2_yamlDocSeparator = makeRaw([
  'apiVersion: v1',
  'kind: Namespace',
  'metadata:',
  '  name: test',
  '---',
  'apiVersion: v1',
  'kind: Service',
  'metadata:',
  '  name: my-svc',
]);

/** Shell heredoc at column 0 with YAML-like body */
export const fb2_shellHeredoc = makeRaw([
  'cat <<EOF',
  'apiVersion: v1',
  'kind: Pod',
  'EOF',
]);

/** Ordered list items with code panels after each (space-prefixed numbers match original terminal output) */
export const fb2_orderedListPanels = makeRaw([
  ' 1 Create the namespace:',
  panelBlank(),
  panelLine('kubectl create namespace test'),
  panelBlank(),
  ' 2 Apply the deployment:',
  panelBlank(),
  panelLine('kubectl apply -f deploy.yaml'),
  panelBlank(),
  ' 3 Check the status:',
  panelBlank(),
  panelLine('kubectl get pods'),
]);

/** Bold file heading with unicode naïve.py */
export const fb2_unicodeFilename = makeRaw([
  panelBlank(),
  '                             naïve.py',
  panelBlank(),
  panelLine('def hello():'),
  panelLine('    print("hello")'),
]);

/** Panel content exactly 78 chars */
export const fb2_exact78Chars = makeRaw([
  panelBlank(),
  panelLine('x'.repeat(78)),
  panelBlank(),
]);

/** Bare non-K8s YAML starting with name: */
export const fb2_bareNonK8sYaml = makeRaw([
  'name: my-app',
  'version: "1.0"',
  'description: short',
  'author: someone',
]);

/** --- separator between two non-K8s YAML sections */
export const fb2_nonK8sYamlSeparator = makeRaw([
  'name: app1',
  'version: "1.0"',
  'port: 8080',
  '---',
  'name: app2',
  'version: "2.0"',
  'port: 9090',
]);

/** Panel content with nested ANSI reset mid-line — manually built (not via panelLine) to embed \x1b[0m inside content */
export const fb2_nestedAnsiReset = makeRaw([
  panelBlank(),
  `\x1b[40m \x1b[0m\x1b[97;40m${'echo \x1b[0m"hello world"'.padEnd(78)}\x1b[0m\x1b[40m \x1b[0m`,
  panelBlank(),
]);

/** Bold file heading Cargo.lock followed by TOML */
export const fb2_cargoLockToml = makeRaw([
  panelBlank(),
  '                             Cargo.lock',
  panelBlank(),
  panelLine('[[package]]'),
  panelLine('name = "serde"'),
  panelLine('version = "1.0.197"'),
]);

/** Prose with period should not be file heading */
export const fb2_proseNotHeading = makeRaw([
  'Hello world.',
  '',
  'This is a paragraph.',
]);

/** Markdown ## heading after code panel */
export const fb2_markdownHeadingAfterCode = makeRaw([
  panelBlank(),
  panelLine('kubectl get pods'),
  panelBlank(),
  '',
  '## Next Steps',
  '',
  'Do something else.',
]);

/** Python f-string with colon not confused as YAML */
export const fb2_pythonFString = makeRaw(['print(f"Hello: {name}")']);

/** Panel content with tab characters */
export const fb2_makefileTabChars = makeRaw([
  panelBlank(),
  panelLine('build:'),
  panelLine('\tgo build -o app .'),
  panelLine('test:'),
  panelLine('\tgo test ./...'),
  panelBlank(),
]);

/** Deeply nested YAML stays in one block */
export const fb2_deeplyNestedYaml = makeRaw([
  'apiVersion: v1',
  'kind: ConfigMap',
  'metadata:',
  '  name: deep',
  'data:',
  '  config: |',
  '    level1:',
  '      level2:',
  '        level3:',
  '          level4:',
  '            level5:',
  '              level6: value',
]);

/** Bold heading then blank line then YAML panel */
export const fb2_headingBlankLinePanel = makeRaw([
  panelBlank(),
  '                             values.yaml',
  panelBlank(),
  '',
  panelLine('replicaCount: 3'),
  panelLine('image:'),
  panelLine('  repository: nginx'),
]);

/** Closing brace at column 0 after code block */
export const fb2_closingBrace = makeRaw([
  'fn main() {',
  '    println!("Hello, world!");',
  '}',
]);

/** Consecutive blank panel lines */
export const fb2_consecutiveBlanks = makeRaw([
  panelBlank(),
  panelLine('line one'),
  panelBlank(),
  panelBlank(),
  panelBlank(),
  panelLine('line two'),
  panelBlank(),
]);

/** README.md heading with markdown content in panels */
export const fb2_readmeMdContent = makeRaw([
  panelBlank(),
  '                             README.md',
  panelBlank(),
  panelLine('# My Project'),
  panelLine(''),
  panelLine('This is a readme.'),
]);

/** ANSI bold inside panel content — manually built (not via panelLine) to embed \x1b[1m bold inside content */
export const fb2_ansiBoldPanel = makeRaw([
  panelBlank(),
  `\x1b[40m \x1b[0m\x1b[97;40m${'\x1b[1mImportant\x1b[0m: Run this command'.padEnd(78)}\x1b[0m\x1b[40m \x1b[0m`,
  panelBlank(),
]);

/** Two bare apiVersion blocks with no separator */
export const fb2_twoApiVersionBlocks = makeRaw([
  'apiVersion: v1',
  'kind: Namespace',
  'metadata:',
  '  name: ns1',
  'apiVersion: apps/v1',
  'kind: Deployment',
  'metadata:',
  '  name: deploy1',
]);

/** File heading path with double slash */
export const fb2_doubleSlashPath = makeRaw([
  panelBlank(),
  '                             src//main.rs',
  panelBlank(),
  panelLine('fn main() {}'),
]);

/** Panel content starting with bullet dash item */
export const fb2_panelDashList = makeRaw([
  panelBlank(),
  panelLine('- name: nginx'),
  panelLine('  image: nginx:latest'),
  panelLine('- name: redis'),
  panelLine('  image: redis:7'),
  panelBlank(),
]);

/** Bare python import at column 0 */
export const fb2_pythonImport = makeRaw([
  'import os',
  'import sys',
  'from pathlib import Path',
]);

/** Prose lines with word-colon pattern and many words */
export const fb2_proseWordColon = makeRaw([
  'Here: is a sentence that has lots of words after the colon.',
  'Another: sentence also has a very long tail with many words.',
  'Third: this one likewise has a very long sequence of words.',
]);

/** File heading with spaces in path */
export const fb2_spacesInPath = makeRaw([
  'My App/config.yaml',
  '',
  'Edit the config file above.',
]);

/** Literal backslash-x1b text in panel content */
export const fb2_literalEscapeText = makeRaw([
  panelBlank(),
  panelLine('Use \\x1b[31m for red text'),
  panelBlank(),
]);

/** YAML key split across lines by terminal wrapping */
export const fb2_yamlKeySplit = makeRaw([
  'apiVersion: autoscaling/v2',
  'kind: HorizontalPodAutoscaler',
  'spec:',
  '  metrics:',
  '    - type: Resource',
  '      resource:',
  '        name: cpu',
  '        target:',
  '          type: Utilization',
  '          averageUtilization',
  ': 70',
]);

// ===========================================================================
// Round 3 – findbugs3.test.ts
// ===========================================================================

/** Heredoc with quoted delimiter <<'YAML' */
export const fb3_heredocQuotedDelim = makeRaw([
  "cat <<'YAML'",
  'apiVersion: v1',
  'kind: Service',
  'YAML',
]);

/** Bare YAML list with nested keys at column 0 */
export const fb3_bareYamlList = makeRaw([
  '- name: nginx',
  '  image: nginx:latest',
  '  ports:',
  '    - containerPort: 80',
  '- name: redis',
  '  image: redis:7',
]);

/** Numbered list with periods and interleaved code panels */
export const fb3_numberedListPanels = makeRaw([
  '1. Create the file:',
  panelBlank(),
  panelLine('touch app.yaml'),
  panelBlank(),
  '2. Edit it:',
  panelBlank(),
  panelLine('vim app.yaml'),
  panelBlank(),
]);

/** Makefile with .PHONY and multiple targets */
export const fb3_makefilePhony = makeRaw([
  panelBlank(),
  panelLine('.PHONY: build test clean'),
  panelBlank(),
  panelLine('build:'),
  panelLine('\tgo build -o app .'),
  panelBlank(),
  panelLine('test:'),
  panelLine('\tgo test ./...'),
  panelBlank(),
  panelLine('clean:'),
  panelLine('\trm -f app'),
  panelBlank(),
]);

/** tee heredoc for K8s manifest creation */
export const fb3_teeHeredoc = makeRaw([
  'kubectl apply -f - <<EOF',
  'apiVersion: v1',
  'kind: Namespace',
  'metadata:',
  '  name: test',
  'EOF',
]);

/** CSS code in panel should be wrapped */
export const fb3_cssPanel = makeRaw([
  panelBlank(),
  panelLine('body {'),
  panelLine('  margin: 0;'),
  panelLine('  padding: 0;'),
  panelLine('}'),
  panelBlank(),
]);

/** SQL query in panel should be wrapped */
export const fb3_sqlPanel = makeRaw([
  panelBlank(),
  panelLine('SELECT name, age'),
  panelLine('FROM users'),
  panelLine('WHERE age > 18'),
  panelLine('ORDER BY name;'),
  panelBlank(),
]);

/** Prose between two code panels stays as prose */
export const fb3_proseBetweenPanels = makeRaw([
  panelBlank(),
  panelLine('kubectl get pods'),
  panelBlank(),
  'Then check the logs with this command:',
  panelBlank(),
  panelLine('kubectl logs pod-name'),
  panelBlank(),
]);

/** Bare JSON array output wrapped in code block */
export const fb3_bareJsonArray = makeRaw([
  '[',
  '  {',
  '    "name": "pod-1",',
  '    "status": "Running"',
  '  },',
  '  {',
  '    "name": "pod-2",',
  '    "status": "Pending"',
  '  }',
  ']',
]);

/** Multiple heredocs in one response */
export const fb3_multipleHeredocs = makeRaw([
  'cat > namespace.yaml <<EOF',
  'apiVersion: v1',
  'kind: Namespace',
  'metadata:',
  '  name: test',
  'EOF',
  '',
  'cat > deployment.yaml <<EOF',
  'apiVersion: apps/v1',
  'kind: Deployment',
  'metadata:',
  '  name: web',
  'EOF',
]);

// ===========================================================================
// Round 4 – findbugs4.test.ts
// ===========================================================================

/** Shell heredoc with <<-EOF keeps YAML body in same block */
export const fb4_heredocDashEof = makeRaw([
  'cat <<-EOF',
  'apiVersion: v1',
  'kind: ConfigMap',
  'EOF',
]);

/** YAML merge-key line <<: *defaults stays inside yaml block */
export const fb4_yamlMergeKey = makeRaw([
  panelBlank(),
  panelLine('defaults: &defaults'),
  panelLine('  image: nginx'),
  panelLine('deployment:'),
  panelLine('  <<: *defaults'),
  panelBlank(),
]);

/** Makefile .PHONY and dependency targets stay in one code block */
export const fb4_makefilePhonyDeps = makeRaw([
  panelBlank(),
  panelLine('.PHONY: build deps clean'),
  panelLine('build: deps'),
  panelLine('\tgo build ./...'),
  panelLine('deps:'),
  panelLine('\tgo mod download'),
  panelBlank(),
]);

/** Lowercase SQL panel content stays in one code block */
export const fb4_lowercaseSql = makeRaw([
  panelBlank(),
  panelLine('select name, age'),
  panelLine('from users'),
  panelLine('where age > 18'),
  panelBlank(),
]);

/** Dockerfile panel with image tag keeps following lines in same block */
export const fb4_dockerfileImageTag = makeRaw([
  panelBlank(),
  panelLine('FROM gcr.io/distroless/cc-debian12:nonroot'),
  panelLine('WORKDIR /app'),
  panelLine('COPY --from=builder /app/bin /app/bin'),
  panelBlank(),
]);
