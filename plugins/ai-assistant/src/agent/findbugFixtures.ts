/**
 * Shared test fixture data extracted from findbugs.test.ts (round 1),
 * findbugs2.test.ts (round 2), findbugs3.test.ts (round 3),
 * findbugs4.test.ts (round 4), findbugs5.test.ts (round 5),
 * findbugs6.test.ts (round 6), findbugs7.test.ts (round 7),
 * findbugs8.test.ts (round 8), findbugs9.test.ts (round 9),
 * findbugs10.test.ts (round 10), findbugs11.test.ts (round 11),
 * findbugs12.test.ts (round 12), findbugs13.test.ts (round 13),
 * findbugs14.test.ts (round 14), and findbugs15.test.ts (round 15).
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

/** Rich-terminal bold panel line (e.g. filename headings). Uses bold weight (1;97) unlike panelLine. */
function boldLine(content: string): string {
  return `\x1b[40m \x1b[0m\x1b[1;97;40m${content.padEnd(78)}\x1b[0m\x1b[40m \x1b[0m`;
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

export { panelLine, panelBlank, boldLine, makeRaw, extractCodeBlocks, assertNoAnsiLeaks };

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
export const fb2_shellHeredoc = makeRaw(['cat <<EOF', 'apiVersion: v1', 'kind: Pod', 'EOF']);

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
export const fb2_exact78Chars = makeRaw([panelBlank(), panelLine('x'.repeat(78)), panelBlank()]);

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
export const fb2_proseNotHeading = makeRaw(['Hello world.', '', 'This is a paragraph.']);

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
export const fb2_closingBrace = makeRaw(['fn main() {', '    println!("Hello, world!");', '}']);

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
  `\x1b[40m \x1b[0m\x1b[97;40m${'\x1b[1mImportant\x1b[0m: Run this command'.padEnd(
    78
  )}\x1b[0m\x1b[40m \x1b[0m`,
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
export const fb2_pythonImport = makeRaw(['import os', 'import sys', 'from pathlib import Path']);

/** Prose lines with word-colon pattern and many words */
export const fb2_proseWordColon = makeRaw([
  'Here: is a sentence that has lots of words after the colon.',
  'Another: sentence also has a very long tail with many words.',
  'Third: this one likewise has a very long sequence of words.',
]);

/** File heading with spaces in path */
export const fb2_spacesInPath = makeRaw(['My App/config.yaml', '', 'Edit the config file above.']);

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

// ===========================================================================
// Round 5 – findbugs5.test.ts
// ===========================================================================

/** C/C++ #include headers stay in one code block */
export const fb5_cIncludeHeaders = makeRaw([
  panelBlank(),
  panelLine('#include <stdio.h>'),
  panelLine('#include <stdlib.h>'),
  panelLine(''),
  panelLine('int main() {'),
  panelLine('    printf("Hello\\n");'),
  panelLine('    return 0;'),
  panelLine('}'),
  panelBlank(),
]);

/** Rust match arms with => are not converted to ordered lists */
export const fb5_rustMatchArms = makeRaw([
  panelBlank(),
  panelLine('match status {'),
  panelLine('    200 => println!("ok"),'),
  panelLine('    404 => println!("not found"),'),
  panelLine('    500 => println!("error"),'),
  panelLine('    _ => println!("unknown"),'),
  panelLine('}'),
  panelBlank(),
]);

/** Shell backslash continuation stays in one code block */
export const fb5_shellBackslashContinuation = makeRaw([
  panelBlank(),
  panelLine('docker run \\'),
  panelLine('  --name mycontainer \\'),
  panelLine('  -p 8080:80 \\'),
  panelLine('  -d nginx:latest'),
  panelBlank(),
]);

/** TypeScript interface is not split by YAML detection */
export const fb5_tsInterface = makeRaw([
  panelBlank(),
  panelLine('interface User {'),
  panelLine('  name: string;'),
  panelLine('  age: number;'),
  panelLine('  email: string;'),
  panelLine('}'),
  panelBlank(),
]);

/** JSON object in Rich panel keeps all content in code blocks */
export const fb5_jsonObject = makeRaw([
  panelBlank(),
  panelLine('{'),
  panelLine('  "apiVersion": "v1",'),
  panelLine('  "kind": "Pod",'),
  panelLine('  "metadata": {'),
  panelLine('    "name": "test-pod"'),
  panelLine('  }'),
  panelLine('}'),
  panelBlank(),
]);

/** Python triple-quote string with YAML-like content stays in one block */
export const fb5_pythonTripleQuoteYaml = makeRaw([
  panelBlank(),
  panelLine('yaml_template = """'),
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('metadata:'),
  panelLine('  name: my-config'),
  panelLine('"""'),
  panelBlank(),
]);

/** Go struct with JSON tags stays in one code block */
export const fb5_goStructJsonTags = makeRaw([
  panelBlank(),
  panelLine('type Pod struct {'),
  panelLine('    Name      string `json:"name"`'),
  panelLine('    Namespace string `json:"namespace"`'),
  panelLine('    Status    string `json:"status"`'),
  panelLine('}'),
  panelBlank(),
]);

/** kubectl get pods output stays in one code block */
export const fb5_kubectlGetPods = makeRaw([
  panelBlank(),
  panelLine('NAME                          READY   STATUS    RESTARTS   AGE'),
  panelLine('nginx-deployment-abc123-xyz   1/1     Running   0          5d'),
  panelLine('nginx-deployment-abc123-def   1/1     Running   0          5d'),
  panelLine('redis-master-0                1/1     Running   0          10d'),
  panelBlank(),
]);

/** Prose with panel code gets first code block wrapped */
export const fb5_proseWithPanelCode = makeRaw([
  'First, install the dependencies:',
  '',
  panelBlank(),
  panelLine('npm install express'),
  panelBlank(),
  '',
  'Then create the server:',
  '',
  panelBlank(),
  panelLine('const app = require("express")();'),
  panelLine('app.listen(3000);'),
  panelBlank(),
]);

/** YAML with boolean and numeric values stays in one block */
export const fb5_yamlBooleanValues = makeRaw([
  panelBlank(),
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('data:'),
  panelLine('  debug: "true"'),
  panelLine('  maxRetries: "3"'),
  panelLine('  verbose: "false"'),
  panelBlank(),
]);

/** Shell case statement stays in one code block */
export const fb5_shellCaseStatement = makeRaw([
  panelBlank(),
  panelLine('case "$1" in'),
  panelLine('  start)'),
  panelLine('    echo "Starting..."'),
  panelLine('    ;;'),
  panelLine('  stop)'),
  panelLine('    echo "Stopping..."'),
  panelLine('    ;;'),
  panelLine('esac'),
  panelBlank(),
]);

/** Terraform HCL resource block stays in one code block */
export const fb5_terraformHcl = makeRaw([
  panelBlank(),
  panelLine('resource "azurerm_kubernetes_cluster" "aks" {'),
  panelLine('  name                = "myAKSCluster"'),
  panelLine('  location            = azurerm_resource_group.rg.location'),
  panelLine('  resource_group_name = azurerm_resource_group.rg.name'),
  panelLine('  dns_prefix          = "myaks"'),
  panelLine('}'),
  panelBlank(),
]);

/** Docker Compose YAML stays in one block */
export const fb5_dockerComposeYaml = makeRaw([
  panelBlank(),
  panelLine('version: "3.8"'),
  panelLine('services:'),
  panelLine('  web:'),
  panelLine('    image: nginx:latest'),
  panelLine('    ports:'),
  panelLine('      - "8080:80"'),
  panelLine('  db:'),
  panelLine('    image: postgres:15'),
  panelLine('    environment:'),
  panelLine('      POSTGRES_PASSWORD: secret'),
  panelBlank(),
]);

/** Rust with lifetime annotations has code in blocks */
export const fb5_rustLifetimes = makeRaw([
  panelBlank(),
  panelLine("fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {"),
  panelLine('    if x.len() > y.len() {'),
  panelLine('        x'),
  panelLine('    } else {'),
  panelLine('        y'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** Numbered steps with shell commands render correctly */
export const fb5_numberedStepsShell = makeRaw([
  '1. Create the namespace:',
  '',
  panelBlank(),
  panelLine('kubectl create namespace prod'),
  panelBlank(),
  '',
  '2. Deploy the application:',
  '',
  panelBlank(),
  panelLine('kubectl apply -f deployment.yaml -n prod'),
  panelBlank(),
  '',
  '3. Check status:',
  '',
  panelBlank(),
  panelLine('kubectl get pods -n prod'),
  panelBlank(),
]);

// ===========================================================================
// Round 6 – findbugs6.test.ts
// ===========================================================================

/** Java try-catch-finally stays in one code block */
export const fb6_javaTryCatchFinally = makeRaw([
  'Here is the error handling:',
  '',
  panelLine('try {'),
  panelLine('    String result = fetchData();'),
  panelLine('    process(result);'),
  panelLine('} catch (IOException e) {'),
  panelLine('    log.error("Failed", e);'),
  panelLine('} finally {'),
  panelLine('    cleanup();'),
  panelLine('}'),
  panelBlank(),
]);

/** Print/log statements detected as code */
export const fb6_printLogStatements = makeRaw([
  'Debug the output:',
  '',
  panelLine('console.log("hello world");'),
  panelLine('fmt.Println("hello from Go")'),
  panelLine('println!("hello from Rust");'),
  panelLine('print("hello from Python")'),
  panelBlank(),
]);

/** Arrow functions and modern JS syntax in code block */
export const fb6_arrowFunctions = makeRaw([
  'Create the handler:',
  '',
  panelLine('const handler = async (req, res) => {'),
  panelLine('  const data = await fetchData(req.params.id);'),
  panelLine('  res.json({ status: "ok", data });'),
  panelLine('};'),
  panelBlank(),
]);

/** TypeScript interface with colon-typed members stays in code block */
export const fb6_tsInterfaceColonMembers = makeRaw([
  'Define the interface:',
  '',
  panelLine('interface PodStatus {'),
  panelLine('  name: string;'),
  panelLine('  namespace: string;'),
  panelLine('  ready: boolean;'),
  panelLine('  restartCount: number;'),
  panelLine('}'),
  panelBlank(),
]);

/** Shell until loop stays in one code block */
export const fb6_shellUntilLoop = makeRaw([
  'Wait for the pod:',
  '',
  panelLine('until kubectl get pod myapp -o jsonpath="{.status.phase}" | grep -q Running; do'),
  panelLine('  echo "Waiting for pod..."'),
  panelLine('  sleep 5'),
  panelLine('done'),
  panelBlank(),
]);

/** Prose between two code blocks keeps them separate */
export const fb6_proseBetweenCodeBlocks = makeRaw([
  'First, create the namespace:',
  '',
  panelLine('kubectl create namespace production'),
  panelBlank(),
  '',
  'Then deploy the application:',
  '',
  panelLine('kubectl apply -f deployment.yaml -n production'),
  panelBlank(),
]);

/** Python f-string with braces stays in code block */
export const fb6_pythonFStringBraces = makeRaw([
  'Log the request:',
  '',
  panelLine('logger.info(f"Request to {endpoint} returned {status_code}")'),
  panelLine('logger.debug(f"Headers: {dict(response.headers)}")'),
  panelLine('logger.error(f"Failed after {retries} retries: {str(err)}")'),
  panelBlank(),
]);

/** K8s YAML with anchors and aliases stays in one block */
export const fb6_yamlAnchorsAliases = makeRaw([
  'Use YAML anchors for shared config:',
  '',
  panelLine('apiVersion: apps/v1'),
  panelLine('kind: Deployment'),
  panelLine('metadata:'),
  panelLine('  name: myapp'),
  panelLine('spec:'),
  panelLine('  template:'),
  panelLine('    spec:'),
  panelLine('      containers:'),
  panelLine('        - name: app'),
  panelLine('          resources: &default_resources'),
  panelLine('            requests:'),
  panelLine('              cpu: 100m'),
  panelLine('              memory: 128Mi'),
  panelLine('            limits:'),
  panelLine('              cpu: 500m'),
  panelLine('              memory: 512Mi'),
  panelBlank(),
]);

/** Rust enum with derive and variants stays in one block */
export const fb6_rustEnumDerive = makeRaw([
  'Define the error type:',
  '',
  panelLine('#[derive(Debug, thiserror::Error)]'),
  panelLine('pub enum AppError {'),
  panelLine('    #[error("not found: {0}")]'),
  panelLine('    NotFound(String),'),
  panelLine('    #[error("unauthorized")]'),
  panelLine('    Unauthorized,'),
  panelLine('    #[error("internal: {0}")]'),
  panelLine('    Internal(#[from] anyhow::Error),'),
  panelLine('}'),
  panelBlank(),
]);

/** Shell if/elif/else/fi stays in one block */
export const fb6_shellIfElifElse = makeRaw([
  'Check the cluster status:',
  '',
  panelLine('if kubectl cluster-info &>/dev/null; then'),
  panelLine('  echo "Cluster is running"'),
  panelLine('elif az aks show -g mygroup -n mycluster &>/dev/null; then'),
  panelLine('  echo "AKS exists but not configured"'),
  panelLine('else'),
  panelLine('  echo "No cluster found"'),
  panelLine('  exit 1'),
  panelLine('fi'),
  panelBlank(),
]);

/** Go goroutine with channel stays in code block */
export const fb6_goGoroutineChannel = makeRaw([
  'Run background worker:',
  '',
  panelLine('func worker(jobs <-chan int, results chan<- int) {'),
  panelLine('    for j := range jobs {'),
  panelLine('        fmt.Println("processing job", j)'),
  panelLine('        time.Sleep(time.Second)'),
  panelLine('        results <- j * 2'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** Docker run with backslash continuation stays together */
export const fb6_dockerRunBackslash = makeRaw([
  'Run the container:',
  '',
  panelLine('docker run -d \\'),
  panelLine('  --name myapp \\'),
  panelLine('  --restart unless-stopped \\'),
  panelLine('  -p 8080:8080 \\'),
  panelLine('  -e DATABASE_URL="postgres://localhost/db" \\'),
  panelLine('  -v /data:/app/data \\'),
  panelLine('  myimage:latest'),
  panelBlank(),
]);

/** Java annotations and class stay in one block */
export const fb6_javaAnnotationsClass = makeRaw([
  'Create the controller:',
  '',
  panelLine('@RestController'),
  panelLine('@RequestMapping("/api/users")'),
  panelLine('public class UserController {'),
  panelLine('    @Autowired'),
  panelLine('    private UserService userService;'),
  panelLine(''),
  panelLine('    @GetMapping("/{id}")'),
  panelLine('    public ResponseEntity<User> getUser(@PathVariable Long id) {'),
  panelLine('        return ResponseEntity.ok(userService.findById(id));'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** kubectl patch with inline JSON stays in one block */
export const fb6_kubectlPatchJson = makeRaw([
  'Scale the deployment:',
  '',
  panelLine('kubectl patch deployment myapp -p \'{"spec":{"replicas":5}}\''),
  panelLine('kubectl rollout status deployment/myapp'),
  panelLine('kubectl get pods -l app=myapp -o wide'),
  panelBlank(),
]);

/** YAML and shell blocks separated by prose */
export const fb6_yamlShellProseSeparated = makeRaw([
  'Save this as service.yaml:',
  '',
  panelLine('apiVersion: v1'),
  panelLine('kind: Service'),
  panelLine('metadata:'),
  panelLine('  name: myapp-svc'),
  panelLine('spec:'),
  panelLine('  type: LoadBalancer'),
  panelLine('  ports:'),
  panelLine('    - port: 80'),
  panelLine('      targetPort: 8080'),
  panelBlank(),
  '',
  'Then apply it:',
  '',
  panelLine('kubectl apply -f service.yaml'),
  panelLine('kubectl get svc myapp-svc'),
  panelBlank(),
]);

// ===========================================================================
// Round 7 – findbugs7.test.ts
// ===========================================================================

/** Lua code with local and function detected as code */
export const fb7_luaLocalFunction = makeRaw([
  'Create the Lua module:',
  '',
  panelLine('local M = {}'),
  panelLine(''),
  panelLine('function M.setup(opts)'),
  panelLine('  opts = opts or {}'),
  panelLine('  M.debug = opts.debug or false'),
  panelLine('  return M'),
  panelLine('end'),
  panelBlank(),
]);

/** Export environment variables detected as shell code */
export const fb7_exportEnvVars = makeRaw([
  'Set environment variables:',
  '',
  panelLine('export KUBECONFIG=~/.kube/config'),
  panelLine('export CLUSTER_NAME=my-aks-cluster'),
  panelLine('export RESOURCE_GROUP=my-rg'),
  panelLine('export REGISTRY=myacr.azurecr.io'),
  panelBlank(),
]);

/** awk and sed commands detected as code */
export const fb7_awkSedCommands = makeRaw([
  'Parse the logs:',
  '',
  panelLine("kubectl logs myapp | awk '{print $1, $NF}'"),
  panelLine("kubectl get pods -o json | jq '.items[].metadata.name'"),
  panelLine("sed -i 's/replicas: 1/replicas: 3/g' deployment.yaml"),
  panelBlank(),
]);

/** CSS rules detected as code block */
export const fb7_cssRules = makeRaw([
  'Add these styles:',
  '',
  panelLine('.container {'),
  panelLine('  display: flex;'),
  panelLine('  justify-content: center;'),
  panelLine('  align-items: center;'),
  panelLine('  min-height: 100vh;'),
  panelLine('}'),
  panelBlank(),
]);

/** Protobuf message definition detected as code */
export const fb7_protobufMessage = makeRaw([
  'Define the protobuf message:',
  '',
  panelLine('syntax = "proto3";'),
  panelLine(''),
  panelLine('message PodMetrics {'),
  panelLine('  string name = 1;'),
  panelLine('  string namespace = 2;'),
  panelLine('  repeated ContainerMetrics containers = 3;'),
  panelLine('}'),
  panelBlank(),
]);

/** Systemd unit file stays in one block */
export const fb7_systemdUnitFile = makeRaw([
  'Create the service file:',
  '',
  panelLine('[Unit]'),
  panelLine('Description=My Application'),
  panelLine('After=network.target'),
  panelLine(''),
  panelLine('[Service]'),
  panelLine('Type=simple'),
  panelLine('ExecStart=/usr/bin/myapp'),
  panelLine('Restart=always'),
  panelLine(''),
  panelLine('[Install]'),
  panelLine('WantedBy=multi-user.target'),
  panelBlank(),
]);

/** Shell pipe chain with line continuations stays together */
export const fb7_shellPipeChain = makeRaw([
  'Find the top pods:',
  '',
  panelLine('kubectl get pods --all-namespaces -o json \\'),
  panelLine("  | jq '.items[] | {name: .metadata.name, cpu: .spec.containers[].resources}' \\"),
  panelLine('  | sort -k2 -rn \\'),
  panelLine('  | head -10'),
  panelBlank(),
]);

/** Shell script with variables and commands stays together */
export const fb7_shellScriptVarsCommands = makeRaw([
  'Run the deploy script:',
  '',
  panelLine('#!/bin/bash'),
  panelLine('set -euo pipefail'),
  panelLine(''),
  panelLine('IMAGE="${REGISTRY}/${APP_NAME}:${VERSION}"'),
  panelLine('docker build -t "$IMAGE" .'),
  panelLine('docker push "$IMAGE"'),
  panelLine('kubectl set image deployment/${APP_NAME} app="$IMAGE"'),
  panelBlank(),
]);

/** JSON configuration object stays in one block */
export const fb7_jsonConfigObject = makeRaw([
  'Add this to package.json scripts:',
  '',
  panelLine('{'),
  panelLine('  "scripts": {'),
  panelLine('    "start": "node server.js",'),
  panelLine('    "build": "tsc && npm run bundle",'),
  panelLine('    "test": "vitest run",'),
  panelLine('    "lint": "eslint src/"'),
  panelLine('  }'),
  panelLine('}'),
  panelBlank(),
]);

/** Ruby class with methods stays in one block */
export const fb7_rubyClassMethods = makeRaw([
  'Create the Ruby model:',
  '',
  panelLine('class KubernetesClient'),
  panelLine('  def initialize(config)'),
  panelLine('    @config = config'),
  panelLine('    @client = Kubeclient::Client.new(config.api_endpoint)'),
  panelLine('  end'),
  panelLine(''),
  panelLine('  def get_pods(namespace)'),
  panelLine('    @client.get_pods(namespace: namespace)'),
  panelLine('  end'),
  panelLine('end'),
  panelBlank(),
]);

/** Kotlin data class detected as code */
export const fb7_kotlinDataClass = makeRaw([
  'Define the data class:',
  '',
  panelLine('data class PodInfo('),
  panelLine('    val name: String,'),
  panelLine('    val namespace: String,'),
  panelLine('    val status: String,'),
  panelLine('    val restarts: Int = 0'),
  panelLine(')'),
  panelBlank(),
]);

/** C struct typedef stays in one code block */
export const fb7_cStructTypedef = makeRaw([
  'Define the struct:',
  '',
  panelLine('typedef struct {'),
  panelLine('    char name[256];'),
  panelLine('    int port;'),
  panelLine('    int replicas;'),
  panelLine('    bool ready;'),
  panelLine('} ServiceConfig;'),
  panelBlank(),
]);

/** az CLI commands with JMESPath queries stay in one block */
export const fb7_azCliJmesPath = makeRaw([
  'Query the AKS cluster:',
  '',
  panelLine('az aks show \\'),
  panelLine('  --resource-group mygroup \\'),
  panelLine('  --name mycluster \\'),
  panelLine("  --query '{name:name, state:powerState.code, k8s:kubernetesVersion}' \\"),
  panelLine('  --output table'),
  panelBlank(),
]);

/** Python async function with type hints stays in one block */
export const fb7_pythonAsyncTypeHints = makeRaw([
  'Create the async handler:',
  '',
  panelLine('async def get_pods('),
  panelLine('    client: KubernetesClient,'),
  panelLine('    namespace: str = "default",'),
  panelLine(') -> list[dict[str, Any]]:'),
  panelLine('    pods = await client.list_pods(namespace=namespace)'),
  panelLine('    return [{"name": p.name, "status": p.status} for p in pods]'),
  panelBlank(),
]);

/** Numbered steps with code blocks render separately */
export const fb7_numberedStepsCodeBlocks = makeRaw([
  '1. Create the secret:',
  '',
  panelLine('kubectl create secret generic db-creds \\'),
  panelLine('  --from-literal=username=admin \\'),
  panelLine('  --from-literal=password=s3cret'),
  panelBlank(),
  '',
  '2. Apply the deployment:',
  '',
  panelLine('kubectl apply -f deployment.yaml'),
  panelBlank(),
  '',
  '3. Verify everything is running:',
  '',
  panelLine('kubectl get all -n production'),
  panelBlank(),
]);

// ===========================================================================
// Round 8 – findbugs8.test.ts
// ===========================================================================

/** Go struct literal with field: value stays in code block */
export const fb8_goStructLiteral = makeRaw([
  'Create the config:',
  '',
  panelLine('config := &Config{'),
  panelLine('    Host:     "localhost",'),
  panelLine('    Port:     8080,'),
  panelLine('    Debug:    true,'),
  panelLine('    MaxConns: 100,'),
  panelLine('}'),
  panelBlank(),
]);

/** Python function call with kwargs stays in code block */
export const fb8_pythonKwargs = makeRaw([
  'Configure logging:',
  '',
  panelLine('logging.basicConfig('),
  panelLine('    level=logging.DEBUG,'),
  panelLine('    format="%(asctime)s %(levelname)s %(message)s",'),
  panelLine('    handlers=['),
  panelLine('        logging.StreamHandler(),'),
  panelLine('        logging.FileHandler("app.log"),'),
  panelLine('    ]'),
  panelLine(')'),
  panelBlank(),
]);

/** Shell trap and source commands detected as code */
export const fb8_shellTrapSource = makeRaw([
  'Set up signal handling:',
  '',
  panelLine('#!/bin/bash'),
  panelLine('source /etc/profile.d/kubernetes.sh'),
  panelLine(''),
  panelLine('trap "kubectl delete pod cleanup-$$" EXIT'),
  panelLine('trap "echo interrupted; exit 1" INT TERM'),
  panelLine(''),
  panelLine('kubectl run cleanup-$$ --image=busybox -- sleep 3600'),
  panelBlank(),
]);

/** GitHub Actions YAML workflow stays in one block */
export const fb8_githubActionsYaml = makeRaw([
  'Add this workflow:',
  '',
  panelLine('name: Deploy'),
  panelLine('on:'),
  panelLine('  push:'),
  panelLine('    branches: [main]'),
  panelLine('jobs:'),
  panelLine('  deploy:'),
  panelLine('    runs-on: ubuntu-latest'),
  panelLine('    steps:'),
  panelLine('      - uses: actions/checkout@v4'),
  panelLine('      - name: Deploy to AKS'),
  panelLine('        run: kubectl apply -f k8s/'),
  panelBlank(),
]);

/** Rust closures and iterator chains stay in one block */
export const fb8_rustClosuresIterators = makeRaw([
  'Process the data:',
  '',
  panelLine('let results: Vec<String> = items'),
  panelLine('    .iter()'),
  panelLine('    .filter(|item| item.active)'),
  panelLine('    .map(|item| format!("{}: {}", item.name, item.value))'),
  panelLine('    .collect();'),
  panelBlank(),
]);

/** Shell heredoc with YAML content stays in one block */
export const fb8_shellHeredocYaml = makeRaw([
  'Create the config:',
  '',
  panelLine('cat <<EOF | kubectl apply -f -'),
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('metadata:'),
  panelLine('  name: app-config'),
  panelLine('data:'),
  panelLine('  DATABASE_URL: postgres://localhost/mydb'),
  panelLine('EOF'),
  panelBlank(),
]);

/** Docker Compose with build context stays in one block */
export const fb8_dockerComposeBuildContext = makeRaw([
  'Create docker-compose.yaml:',
  '',
  panelLine('version: "3.8"'),
  panelLine('services:'),
  panelLine('  api:'),
  panelLine('    build:'),
  panelLine('      context: .'),
  panelLine('      dockerfile: Dockerfile'),
  panelLine('      args:'),
  panelLine('        - RUST_VERSION=1.76'),
  panelLine('    ports:'),
  panelLine('      - "8080:8080"'),
  panelLine('    environment:'),
  panelLine('      - DATABASE_URL=postgres://db:5432/myapp'),
  panelLine('    depends_on:'),
  panelLine('      - db'),
  panelBlank(),
]);

/** Shell function definition stays in one block */
export const fb8_shellFunctionDef = makeRaw([
  'Add the helper function:',
  '',
  panelLine('check_pod_ready() {'),
  panelLine('  local pod=$1'),
  panelLine('  local ns=${2:-default}'),
  panelLine('  local status'),
  panelLine('  status=$(kubectl get pod "$pod" -n "$ns" -o jsonpath="{.status.phase}")'),
  panelLine('  [ "$status" = "Running" ]'),
  panelLine('}'),
  panelBlank(),
]);

/** Python nested expressions stay in code block */
export const fb8_pythonNestedExpressions = makeRaw([
  'Process pods:',
  '',
  panelLine('import json'),
  panelLine('from kubernetes import client, config'),
  panelLine(''),
  panelLine('config.load_kube_config()'),
  panelLine('v1 = client.CoreV1Api()'),
  panelLine('pods = v1.list_namespaced_pod("default")'),
  panelLine('names = [p.metadata.name for p in pods.items if p.status.phase == "Running"]'),
  panelLine('print(json.dumps(names, indent=2))'),
  panelBlank(),
]);

/** Terraform with multiple resource types stays in one block */
export const fb8_terraformMultipleResources = makeRaw([
  'Add the Terraform config:',
  '',
  panelLine('provider "azurerm" {'),
  panelLine('  features {}'),
  panelLine('}'),
  panelLine(''),
  panelLine('resource "azurerm_kubernetes_cluster" "aks" {'),
  panelLine('  name                = "myaks"'),
  panelLine('  location            = "eastus"'),
  panelLine('  resource_group_name = azurerm_resource_group.rg.name'),
  panelLine('  dns_prefix          = "myaks"'),
  panelLine(''),
  panelLine('  default_node_pool {'),
  panelLine('    name       = "default"'),
  panelLine('    node_count = 3'),
  panelLine('    vm_size    = "Standard_DS2_v2"'),
  panelLine('  }'),
  panelLine('}'),
  panelBlank(),
]);

/** SQL JOIN query stays in one code block */
export const fb8_sqlJoinQuery = makeRaw([
  'Query the data:',
  '',
  panelLine('SELECT'),
  panelLine('    p.name,'),
  panelLine('    p.namespace,'),
  panelLine('    n.capacity_cpu,'),
  panelLine('    n.capacity_memory'),
  panelLine('FROM pods p'),
  panelLine('INNER JOIN nodes n ON p.node_name = n.name'),
  panelLine("WHERE p.status = 'Running'"),
  panelLine('ORDER BY p.name ASC'),
  panelLine('LIMIT 50;'),
  panelBlank(),
]);

/** K8s CRD definition stays in one YAML block */
export const fb8_k8sCrdDefinition = makeRaw([
  'Create the CRD:',
  '',
  panelLine('apiVersion: apiextensions.k8s.io/v1'),
  panelLine('kind: CustomResourceDefinition'),
  panelLine('metadata:'),
  panelLine('  name: databases.myapp.io'),
  panelLine('spec:'),
  panelLine('  group: myapp.io'),
  panelLine('  versions:'),
  panelLine('    - name: v1'),
  panelLine('      served: true'),
  panelLine('      storage: true'),
  panelLine('      schema:'),
  panelLine('        openAPIV3Schema:'),
  panelLine('          type: object'),
  panelLine('          properties:'),
  panelLine('            spec:'),
  panelLine('              type: object'),
  panelBlank(),
]);

/** Swift struct with properties stays in code block */
export const fb8_swiftStructProperties = makeRaw([
  'Define the model:',
  '',
  panelLine('struct PodInfo: Codable {'),
  panelLine('    let name: String'),
  panelLine('    let namespace: String'),
  panelLine('    let status: String'),
  panelLine('    var isReady: Bool {'),
  panelLine('        status == "Running"'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** Makefile with ifeq conditional stays in one block */
export const fb8_makefileIfeq = makeRaw([
  'Create the Makefile:',
  '',
  panelLine('REGISTRY ?= docker.io'),
  panelLine('TAG ?= latest'),
  panelLine(''),
  panelLine('ifeq ($(CI),true)'),
  panelLine('  TAG := $(shell git rev-parse --short HEAD)'),
  panelLine('endif'),
  panelLine(''),
  panelLine('.PHONY: build'),
  panelLine('build:'),
  panelLine('\tdocker build -t $(REGISTRY)/myapp:$(TAG) .'),
  panelBlank(),
]);

/** Elixir module with functions stays in one block */
export const fb8_elixirModule = makeRaw([
  'Create the module:',
  '',
  panelLine('defmodule MyApp.K8sClient do'),
  panelLine('  def get_pods(namespace \\\\ "default") do'),
  panelLine('    {:ok, pods} = K8s.Client.list("v1", "Pod", namespace: namespace)'),
  panelLine('    Enum.map(pods, &(&1["metadata"]["name"]))'),
  panelLine('  end'),
  panelLine('end'),
  panelBlank(),
]);

// ===========================================================================
// Round 9 – findbugs9.test.ts
// ===========================================================================

/** TypeScript generic types not confused with HTML tags */
export const fb9_tsGenericTypes = makeRaw([
  'Create the type-safe client:',
  '',
  panelLine('const client = new KubernetesClient<PodSpec>({'),
  panelLine('  namespace: "default",'),
  panelLine('  timeout: 30000,'),
  panelLine('});'),
  panelLine('const pods = await client.list<Pod>();'),
  panelBlank(),
]);

/** PHP class with namespace stays in one block */
export const fb9_phpClassNamespace = makeRaw([
  'Create the controller:',
  '',
  panelLine('<?php'),
  panelLine('namespace App\\Controllers;'),
  panelLine(''),
  panelLine('class PodController extends Controller'),
  panelLine('{'),
  panelLine('    public function index(): JsonResponse'),
  panelLine('    {'),
  panelLine("        $pods = $this->k8s->getPods('default');"),
  panelLine('        return response()->json($pods);'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** Scala case class detected as code */
export const fb9_scalaCaseClass = makeRaw([
  'Define the model:',
  '',
  panelLine('case class Pod('),
  panelLine('  name: String,'),
  panelLine('  namespace: String,'),
  panelLine('  status: String'),
  panelLine(')'),
  panelLine(''),
  panelLine('object PodService {'),
  panelLine('  def listPods(ns: String): List[Pod] = {'),
  panelLine('    client.pods.inNamespace(ns).list().getItems.asScala.toList'),
  panelLine('  }'),
  panelLine('}'),
  panelBlank(),
]);

/** Shell arrays and parameter expansion stay in code block */
export const fb9_shellArraysParamExpansion = makeRaw([
  'Deploy to multiple namespaces:',
  '',
  panelLine('NAMESPACES=(staging production canary)'),
  panelLine(''),
  panelLine('for ns in "${NAMESPACES[@]}"; do'),
  panelLine('  echo "Deploying to $ns..."'),
  panelLine('  kubectl apply -f manifests/ -n "$ns"'),
  panelLine('  kubectl rollout status deployment/myapp -n "$ns"'),
  panelLine('done'),
  panelBlank(),
]);

/** INI config file detected as code block */
export const fb9_iniConfigFile = makeRaw([
  'Create the config file:',
  '',
  panelLine('[global]'),
  panelLine('scrape_interval = 15s'),
  panelLine('evaluation_interval = 15s'),
  panelLine(''),
  panelLine('[scrape_config]'),
  panelLine('job_name = "kubernetes-pods"'),
  panelLine('kubernetes_sd_configs = ['),
  panelLine('  {role = "pod"}'),
  panelLine(']'),
  panelBlank(),
]);

/** Rust with turbofish and type annotations stays in code block */
export const fb9_rustTurbofish = makeRaw([
  'Parse the config:',
  '',
  panelLine('let config: Config = serde_json::from_str(&data)?;'),
  panelLine('let items = vec.iter().collect::<Vec<_>>();'),
  panelLine('let count = "42".parse::<u32>().unwrap();'),
  panelBlank(),
]);

/** Python multi-line string stays in code block */
export const fb9_pythonMultiLineString = makeRaw([
  'Create the template:',
  '',
  panelLine('YAML_TEMPLATE = """'),
  panelLine('apiVersion: apps/v1'),
  panelLine('kind: Deployment'),
  panelLine('metadata:'),
  panelLine('  name: {name}'),
  panelLine('  namespace: {namespace}'),
  panelLine('"""'),
  panelBlank(),
]);

/** Java Spring Boot service stays in one block */
export const fb9_javaSpringBootService = makeRaw([
  'Create the service:',
  '',
  panelLine('@Service'),
  panelLine('public class KubeService {'),
  panelLine('    private final ApiClient client;'),
  panelLine(''),
  panelLine('    @Autowired'),
  panelLine('    public KubeService(ApiClient client) {'),
  panelLine('        this.client = client;'),
  panelLine('    }'),
  panelLine(''),
  panelLine('    public List<V1Pod> listPods() throws ApiException {'),
  panelLine('        CoreV1Api api = new CoreV1Api(client);'),
  panelLine('        return api.listNamespacedPod("default",'),
  panelLine('            null, null, null, null, null, null, null, null, null, null)'),
  panelLine('            .getItems();'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** Shell with here-string stays in code block */
export const fb9_shellHereString = makeRaw([
  'Parse the JSON:',
  '',
  panelLine('NODES=$(kubectl get nodes -o json)'),
  panelLine(''),
  panelLine('while read -r name status; do'),
  panelLine('  echo "Node: $name ($status)"'),
  panelLine(
    'done <<< $(echo $NODES | jq -r \'.items[] | "\\(.metadata.name) \\(.status.conditions[-1].type)"\')'
  ),
  panelBlank(),
]);

/** curl with JSON body stays in one block */
export const fb9_curlJsonBody = makeRaw([
  'Test the API:',
  '',
  panelLine('curl -X POST http://localhost:8080/api/deploy \\'),
  panelLine("  -H 'Content-Type: application/json' \\"),
  panelLine("  -d '{"),
  panelLine('    "image": "myapp:v2",'),
  panelLine('    "replicas": 3,'),
  panelLine('    "namespace": "production"'),
  panelLine("  }'"),
  panelBlank(),
]);

/** Kotlin suspend function stays in code block */
export const fb9_kotlinSuspendFunction = makeRaw([
  'Create the repository:',
  '',
  panelLine('suspend fun getPods(namespace: String): List<Pod> {'),
  panelLine('    return withContext(Dispatchers.IO) {'),
  panelLine('        client.pods()'),
  panelLine('            .inNamespace(namespace)'),
  panelLine('            .list()'),
  panelLine('            .items'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** Terraform locals and data sources stay in one block */
export const fb9_terraformLocalsData = makeRaw([
  'Add the locals:',
  '',
  panelLine('locals {'),
  panelLine('  cluster_name = "${var.prefix}-aks"'),
  panelLine('  tags = {'),
  panelLine('    environment = var.environment'),
  panelLine('    managed_by  = "terraform"'),
  panelLine('  }'),
  panelLine('}'),
  panelLine(''),
  panelLine('data "azurerm_client_config" "current" {}'),
  panelBlank(),
]);

/** Markdown table passes through without code wrapping */
export const fb9_markdownTable = makeRaw([
  'Here are the pod statuses:',
  '',
  '| Name | Status | Restarts |',
  '|------|--------|----------|',
  '| pod-1 | Running | 0 |',
  '| pod-2 | CrashLoopBackOff | 5 |',
  '| pod-3 | Running | 0 |',
]);

/** Shell process substitution stays in code block */
export const fb9_shellProcessSubstitution = makeRaw([
  'Compare configs:',
  '',
  panelLine('diff <(kubectl get cm config-a -o yaml) <(kubectl get cm config-b -o yaml)'),
  panelBlank(),
]);

/** Requirements.txt content stays in code block */
export const fb9_requirementsTxt = makeRaw([
  'Install these dependencies:',
  '',
  panelLine('flask==3.0.0'),
  panelLine('kubernetes==28.1.0'),
  panelLine('requests>=2.31.0'),
  panelLine('gunicorn~=21.2'),
  panelLine('prometheus-client>=0.17'),
  panelBlank(),
]);

// ===========================================================================
// Round 10 – findbugs10.test.ts
// ===========================================================================

/** GitHub Actions YAML branches: [main] not corrupted by ANSI stripping */
export const fb10_ghActionsBranchesMain = makeRaw([
  'Create .github/workflows/deploy.yml:',
  '',
  panelLine('name: Deploy to AKS'),
  panelLine('on:'),
  panelLine('  push:'),
  panelLine('    branches: [main]'),
  panelLine(''),
  panelLine('jobs:'),
  panelLine('  deploy:'),
  panelLine('    runs-on: ubuntu-latest'),
  panelLine('    steps:'),
  panelLine('    - uses: actions/checkout@v4'),
  panelLine('    - run: kubectl apply -f manifests/'),
  panelBlank(),
]);

/** Prometheus [5m] duration selector not corrupted */
export const fb10_prometheusDuration5m = makeRaw([
  'Create alert rule:',
  '',
  panelLine('apiVersion: monitoring.coreos.com/v1'),
  panelLine('kind: PrometheusRule'),
  panelLine('spec:'),
  panelLine('  groups:'),
  panelLine('  - name: alerts'),
  panelLine('    rules:'),
  panelLine('    - alert: HighLatency'),
  panelLine('      expr: histogram_quantile(0.99, rate(http_duration_seconds_bucket[5m])) > 1'),
  panelLine('      for: 10m'),
  panelBlank(),
]);

/** Kustomization YAML in panel gets wrapped in code fence */
export const fb10_kustomizationYaml = makeRaw([
  'Create kustomization.yaml:',
  '',
  panelLine('resources:'),
  panelLine('- deployment.yaml'),
  panelLine('- service.yaml'),
  panelLine('- ingress.yaml'),
  panelLine(''),
  panelLine('namePrefix: prod-'),
  panelLine(''),
  panelLine('commonLabels:'),
  panelLine('  app: my-app'),
  panelLine('  env: production'),
  panelBlank(),
]);

/** Helm values.yaml in panel gets wrapped in code fence */
export const fb10_helmValuesYaml = makeRaw([
  'Create values.yaml:',
  '',
  panelLine('replicaCount: 3'),
  panelLine(''),
  panelLine('image:'),
  panelLine('  repository: myregistry.azurecr.io/myapp'),
  panelLine('  tag: "v1.2.3"'),
  panelLine('  pullPolicy: IfNotPresent'),
  panelLine(''),
  panelLine('service:'),
  panelLine('  type: LoadBalancer'),
  panelLine('  port: 80'),
  panelBlank(),
  '',
  'Install with:',
  '',
  panelLine('helm install my-release ./chart -f values.yaml'),
  panelBlank(),
]);

/** Azure DevOps pipeline YAML in panel gets wrapped */
export const fb10_azureDevOpsPipeline = makeRaw([
  'Create azure-pipelines.yml:',
  '',
  panelLine('trigger:'),
  panelLine('  branches:'),
  panelLine('    include:'),
  panelLine('    - main'),
  panelLine(''),
  panelLine('pool:'),
  panelLine('  vmImage: ubuntu-latest'),
  panelLine(''),
  panelLine('steps:'),
  panelLine('- task: KubernetesManifest@0'),
  panelLine('  inputs:'),
  panelLine('    action: deploy'),
  panelLine('    kubernetesServiceConnection: myAKS'),
  panelLine('    namespace: production'),
  panelBlank(),
]);

/** Ansible playbook YAML in panel gets wrapped */
export const fb10_ansiblePlaybook = makeRaw([
  'Here is the Ansible playbook:',
  '',
  panelLine('---'),
  panelLine('- name: Deploy to AKS'),
  panelLine('  hosts: localhost'),
  panelLine('  tasks:'),
  panelLine('  - name: Login to Azure'),
  panelLine('    azure.azcollection.azure_rm_aks_info:'),
  panelLine('      resource_group: myResourceGroup'),
  panelLine('      name: myAKSCluster'),
  panelLine('  - name: Apply manifests'),
  panelLine('    kubernetes.core.k8s:'),
  panelLine('      state: present'),
  panelLine('      src: manifests/'),
  panelBlank(),
]);

/** ConfigMap with literal block scalar bash script stays in one block */
export const fb10_configMapLiteralBlock = makeRaw([
  'Create the ConfigMap:',
  '',
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('metadata:'),
  panelLine('  name: init-script'),
  panelLine('data:'),
  panelLine('  init.sh: |'),
  panelLine('    #!/bin/bash'),
  panelLine('    echo "Initializing..."'),
  panelLine('    until pg_isready -h $DB_HOST; do'),
  panelLine('      echo "Waiting..."'),
  panelLine('      sleep 2'),
  panelLine('    done'),
  panelLine('    echo "Ready!"'),
  panelBlank(),
]);

/** Makefile .PHONY and variable assignments stay in code block */
export const fb10_makefilePhony = makeRaw([
  'Create Makefile:',
  '',
  panelLine('.PHONY: build push deploy'),
  panelLine(''),
  panelLine('IMAGE ?= myregistry.azurecr.io/myapp'),
  panelLine('TAG ?= $(shell git rev-parse --short HEAD)'),
  panelLine(''),
  panelLine('build:'),
  panelLine('\tdocker build -t $(IMAGE):$(TAG) .'),
  panelLine(''),
  panelLine('push: build'),
  panelLine('\tdocker push $(IMAGE):$(TAG)'),
  panelLine(''),
  panelLine('deploy: push'),
  panelLine('\tkubectl set image deployment/myapp app=$(IMAGE):$(TAG)'),
  panelBlank(),
]);

/** NGINX config with proxy_pass stays in one code block */
export const fb10_nginxProxyPass = makeRaw([
  'Configure NGINX:',
  '',
  panelLine('server {'),
  panelLine('    listen 80;'),
  panelLine('    server_name myapp.example.com;'),
  panelLine(''),
  panelLine('    location / {'),
  panelLine('        proxy_pass http://localhost:8080;'),
  panelLine('        proxy_set_header Host $host;'),
  panelLine('        proxy_set_header X-Real-IP $remote_addr;'),
  panelLine('    }'),
  panelLine(''),
  panelLine('    location /healthz {'),
  panelLine('        return 200 "OK";'),
  panelLine('    }'),
  panelLine('}'),
  panelBlank(),
]);

/** Python K8s operator with deep nesting stays in one block */
export const fb10_pythonK8sOperator = makeRaw([
  'Create the operator:',
  '',
  panelLine('import kopf'),
  panelLine(''),
  panelLine('@kopf.on.create("v1", "pods")'),
  panelLine('def create_fn(spec, **kwargs):'),
  panelLine('    result = api.create('),
  panelLine('        namespace="default",'),
  panelLine('        body={'),
  panelLine('            "metadata": {"name": "test"},'),
  panelLine('        }'),
  panelLine('    )'),
  panelLine('    return {"ok": True}'),
  panelBlank(),
]);

/** Grafana JSON in ConfigMap with [5m] Prometheus duration preserved */
export const fb10_grafanaConfigMap5m = makeRaw([
  'Create dashboard ConfigMap:',
  '',
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('metadata:'),
  panelLine('  name: grafana-dashboard'),
  panelLine('data:'),
  panelLine('  dashboard.json: |'),
  panelLine('    {'),
  panelLine('      "title": "Request Rate",'),
  panelLine('      "targets": ['),
  panelLine('        {'),
  panelLine('          "expr": "rate(http_requests_total[5m])"'),
  panelLine('        }'),
  panelLine('      ]'),
  panelLine('    }'),
  panelBlank(),
]);

/** Docker Compose YAML in panel gets wrapped */
export const fb10_dockerComposeYaml = makeRaw([
  'Create docker-compose.yml:',
  '',
  panelLine('version: "3.8"'),
  panelLine(''),
  panelLine('services:'),
  panelLine('  app:'),
  panelLine('    build: .'),
  panelLine('    ports:'),
  panelLine('    - "8080:8080"'),
  panelLine('    environment:'),
  panelLine('    - DATABASE_URL=postgres://localhost/mydb'),
  panelLine('  db:'),
  panelLine('    image: postgres:15'),
  panelBlank(),
]);

/** Envoy proxy config YAML gets wrapped in panel */
export const fb10_envoyProxyConfig = makeRaw([
  'Create the Envoy config:',
  '',
  panelLine('static_resources:'),
  panelLine('  listeners:'),
  panelLine('  - name: listener_0'),
  panelLine('    address:'),
  panelLine('      socket_address:'),
  panelLine('        address: 0.0.0.0'),
  panelLine('        port_value: 8080'),
  panelLine('    filter_chains:'),
  panelLine('    - filters:'),
  panelLine('      - name: envoy.filters.network.http_connection_manager'),
  panelBlank(),
]);

/** Azure Bicep for AKS stays in one code block */
export const fb10_azureBicepAks = makeRaw([
  'Create main.bicep:',
  '',
  panelLine("resource aks 'Microsoft.ContainerService/managedClusters@2024-01-01' = {"),
  panelLine("  name: 'myAKSCluster'"),
  panelLine('  identity: {'),
  panelLine("    type: 'SystemAssigned'"),
  panelLine('  }'),
  panelLine('  properties: {'),
  panelLine('    agentPoolProfiles: ['),
  panelLine('      {'),
  panelLine("        name: 'agentpool'"),
  panelLine('        count: 3'),
  panelLine("        vmSize: 'Standard_D2s_v3'"),
  panelLine('      }'),
  panelLine('    ]'),
  panelLine('  }'),
  panelLine('}'),
  panelBlank(),
]);

/** kubectl top millicore values not corrupted */
export const fb10_kubectlTopMillicores = makeRaw([
  'Resource usage:',
  '',
  panelLine('$ kubectl top pods -n production'),
  panelLine('NAME                     CPU(cores)   MEMORY(bytes)'),
  panelLine('my-app-7b94c5d4f-abc12   250m         128Mi'),
  panelLine('my-app-7b94c5d4f-def34   100m         96Mi'),
  panelLine('my-app-7b94c5d4f-ghi56   500m         256Mi'),
  panelBlank(),
]);

// ===========================================================================
// Round 11 – findbugs11.test.ts
// ===========================================================================

/** kubectl resource action output lines detected as code */
export const fb11_kubectlScaleOutput = makeRaw([
  'Scale the deployment:',
  '',
  panelLine('$ kubectl scale deployment my-app --replicas=5 -n production'),
  panelLine('deployment.apps/my-app scaled'),
  panelBlank(),
  '',
  'Verify:',
  '',
  panelLine('$ kubectl get deployment my-app -n production'),
  panelLine('NAME     READY   UP-TO-DATE   AVAILABLE   AGE'),
  panelLine('my-app   5/5     5            5           3d'),
  panelBlank(),
]);

/** kubectl apply output lines stay in code block */
export const fb11_kubectlApplyOutput = makeRaw([
  'Apply manifests:',
  '',
  panelLine('$ kubectl apply -f manifests/ -n production'),
  panelLine('namespace/production unchanged'),
  panelLine('serviceaccount/my-app created'),
  panelLine('deployment.apps/my-app configured'),
  panelLine('service/my-app-svc created'),
  panelLine('configmap/my-config unchanged'),
  panelLine('ingress.networking.k8s.io/my-ingress created'),
  panelBlank(),
]);

/** Helm status output not treated as YAML keys */
export const fb11_helmStatusOutput = makeRaw([
  'Check Helm release:',
  '',
  panelLine('$ helm status my-release -n production'),
  panelLine('NAME: my-release'),
  panelLine('LAST DEPLOYED: Mon Jan 15 10:30:00 2024'),
  panelLine('NAMESPACE: production'),
  panelLine('STATUS: deployed'),
  panelLine('REVISION: 3'),
  panelLine('TEST SUITE: None'),
  panelLine('NOTES:'),
  panelLine('  Get the URL by running:'),
  panelLine('  kubectl get svc my-release -n production'),
  panelBlank(),
]);

/** kubectl rollout output stays in code block */
export const fb11_kubectlRolloutStatus = makeRaw([
  'Wait for rollout:',
  '',
  panelLine('$ kubectl rollout status deployment/my-app -n production'),
  panelLine(
    'Waiting for deployment "my-app" rollout to finish: 1 of 3 updated replicas are available...'
  ),
  panelLine(
    'Waiting for deployment "my-app" rollout to finish: 2 of 3 updated replicas are available...'
  ),
  panelLine('deployment "my-app" successfully rolled out'),
  panelBlank(),
]);

/** terraform plan output with + prefix detected as code */
export const fb11_terraformPlanOutput = makeRaw([
  'Plan the AKS cluster:',
  '',
  panelLine('$ terraform plan'),
  panelLine(''),
  panelLine('Terraform will perform the following actions:'),
  panelLine(''),
  panelLine('  # azurerm_kubernetes_cluster.aks will be created'),
  panelLine('  + resource "azurerm_kubernetes_cluster" "aks" {'),
  panelLine('      + dns_prefix          = "myaks"'),
  panelLine('      + location            = "eastus"'),
  panelLine('      + name                = "myAKSCluster"'),
  panelLine('      + resource_group_name = "myResourceGroup"'),
  panelLine('    }'),
  panelLine(''),
  panelLine('Plan: 1 to add, 0 to change, 0 to destroy.'),
  panelBlank(),
]);

/** Docker build step output stays in code block */
export const fb11_dockerBuildSteps = makeRaw([
  'Build the image:',
  '',
  panelLine('$ docker build -t myapp:latest .'),
  panelLine('Step 1/5 : FROM node:18-alpine'),
  panelLine(' ---> abc123def456'),
  panelLine('Step 2/5 : WORKDIR /app'),
  panelLine(' ---> Using cache'),
  panelLine(' ---> def456789abc'),
  panelLine('Step 3/5 : COPY package*.json ./'),
  panelLine(' ---> 789abcdef012'),
  panelLine('Step 4/5 : RUN npm ci --production'),
  panelLine(' ---> Running in container123'),
  panelLine('Step 5/5 : CMD ["node", "server.js"]'),
  panelLine(' ---> 012345678abc'),
  panelLine('Successfully built 012345678abc'),
  panelLine('Successfully tagged myapp:latest'),
  panelBlank(),
]);

/** Helm template Go expressions in bare output wrapped as code */
export const fb11_helmTemplateGoExpr = makeRaw([
  'The Helm template generates:',
  '',
  panelLine('{{- if .Values.ingress.enabled -}}'),
  panelLine('apiVersion: networking.k8s.io/v1'),
  panelLine('kind: Ingress'),
  panelLine('metadata:'),
  panelLine('  name: {{ include "mychart.fullname" . }}'),
  panelLine('  {{- with .Values.ingress.annotations }}'),
  panelLine('  annotations:'),
  panelLine('    {{- toYaml . | nindent 4 }}'),
  panelLine('  {{- end }}'),
  panelLine('spec:'),
  panelLine('  rules:'),
  panelLine('  {{- range .Values.ingress.hosts }}'),
  panelLine('  - host: {{ .host }}'),
  panelLine('{{- end }}'),
  panelBlank(),
]);

/** ConfigMap with embedded Spring properties stays together */
export const fb11_configMapSpringProperties = makeRaw([
  'Create ConfigMap:',
  '',
  panelLine('apiVersion: v1'),
  panelLine('kind: ConfigMap'),
  panelLine('metadata:'),
  panelLine('  name: app-config'),
  panelLine('data:'),
  panelLine('  application.properties: |'),
  panelLine('    server.port=8080'),
  panelLine('    spring.datasource.url=jdbc:postgresql://db:5432/mydb'),
  panelLine('    spring.datasource.username=${DB_USER}'),
  panelLine('    spring.jpa.hibernate.ddl-auto=update'),
  panelLine('    management.endpoints.web.exposure.include=health,info'),
  panelBlank(),
]);

/** kubectl error messages not absorbed into YAML blocks */
export const fb11_kubectlErrorMessage = makeRaw([
  'Try to access the resource:',
  '',
  panelLine('$ kubectl get pods -n production'),
  panelLine('NAME                     READY   STATUS    RESTARTS   AGE'),
  panelLine('api-server-abc12         1/1     Running   0          2d'),
  panelBlank(),
  '',
  'If you see an error like:',
  '',
  panelLine('$ kubectl get customresource -n production'),
  panelLine('error: the server doesnt have a resource type "customresource"'),
  panelBlank(),
  '',
  'It means the CRD is not installed.',
]);

/** kubectl deprecation warnings stay with command output */
export const fb11_kubectlWarningDeprecation = makeRaw([
  'Apply the policy:',
  '',
  panelLine('$ kubectl apply -f psp.yaml'),
  panelLine('Warning: policy/v1beta1 PodSecurityPolicy is deprecated in v1.21+'),
  panelLine('podsecuritypolicy.policy/restricted created'),
  panelBlank(),
]);

/** bare kubectl events table detected as code */
export const fb11_kubectlEventsTable = makeRaw([
  'Recent events in the namespace:',
  '',
  panelLine('LAST SEEN   TYPE      REASON              OBJECT                        MESSAGE'),
  panelLine(
    '30s         Normal    Scheduled           pod/api-server-abc12          Successfully assigned'
  ),
  panelLine(
    '28s         Normal    Pulling             pod/api-server-abc12          Pulling image "myapp:v2"'
  ),
  panelLine(
    '15s         Normal    Pulled              pod/api-server-abc12          Successfully pulled image'
  ),
  panelLine(
    '14s         Normal    Created             pod/api-server-abc12          Created container api'
  ),
  panelLine(
    '14s         Normal    Started             pod/api-server-abc12          Started container api'
  ),
  panelLine(
    '5s          Warning   BackOff             pod/worker-xyz99              Back-off restarting failed'
  ),
  panelBlank(),
]);

/** Kustomization with patchesStrategicMerge wrapped as YAML */
export const fb11_kustomizationPatches = makeRaw([
  'Create kustomization.yaml:',
  '',
  panelLine(' resources:'),
  panelLine(' - deployment.yaml'),
  panelLine(' - service.yaml'),
  panelLine(' patchesStrategicMerge:'),
  panelLine(' - |-'),
  panelLine('   apiVersion: apps/v1'),
  panelLine('   kind: Deployment'),
  panelLine('   metadata:'),
  panelLine('     name: my-app'),
  panelLine('   spec:'),
  panelLine('     replicas: 5'),
  panelLine(' commonLabels:'),
  panelLine('   app: my-app'),
  panelLine('   env: production'),
  panelBlank(),
]);

/** Go client-go code stays in one code block */
export const fb11_goClientGoCode = makeRaw([
  'Create main.go:',
  '',
  panelLine('package main'),
  panelLine(''),
  panelLine('import ('),
  panelLine('  "context"'),
  panelLine('  "fmt"'),
  panelLine('  metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"'),
  panelLine('  "k8s.io/client-go/kubernetes"'),
  panelLine('  "k8s.io/client-go/tools/clientcmd"'),
  panelLine(')'),
  panelLine(''),
  panelLine('func main() {'),
  panelLine('  config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)'),
  panelLine('  if err != nil {'),
  panelLine('    panic(err)'),
  panelLine('  }'),
  panelLine('  clientset, err := kubernetes.NewForConfig(config)'),
  panelLine(
    '  pods, err := clientset.CoreV1().Pods("default").List(context.TODO(), metav1.ListOptions{})'
  ),
  panelLine('  for _, pod := range pods.Items {'),
  panelLine('    fmt.Printf("Pod: %s\\n", pod.Name)'),
  panelLine('  }'),
  panelLine('}'),
  panelBlank(),
]);

/** RBAC ClusterRole with complex rules stays together */
export const fb11_rbacClusterRole = makeRaw([
  'Create ClusterRole:',
  '',
  panelLine('apiVersion: rbac.authorization.k8s.io/v1'),
  panelLine('kind: ClusterRole'),
  panelLine('metadata:'),
  panelLine('  name: monitoring-role'),
  panelLine('rules:'),
  panelLine('- apiGroups: [""]'),
  panelLine('  resources: ["pods", "nodes", "services", "endpoints"]'),
  panelLine('  verbs: ["get", "list", "watch"]'),
  panelLine('- apiGroups: ["apps"]'),
  panelLine('  resources: ["deployments", "replicasets", "statefulsets"]'),
  panelLine('  verbs: ["get", "list", "watch"]'),
  panelLine('- apiGroups: ["monitoring.coreos.com"]'),
  panelLine('  resources: ["prometheuses", "servicemonitors", "alertmanagers"]'),
  panelLine('  verbs: ["*"]'),
  panelBlank(),
]);

/** Multiple kubectl commands with prose rendered correctly */
export const fb11_multiKubectlWithProse = makeRaw([
  'First, create the namespace:',
  '',
  panelLine('$ kubectl create namespace monitoring'),
  panelLine('namespace/monitoring created'),
  panelBlank(),
  '',
  'Then install Prometheus:',
  '',
  panelLine('$ helm install prometheus prometheus-community/kube-prometheus-stack \\'),
  panelLine('    --namespace monitoring \\'),
  panelLine('    --set grafana.enabled=true \\'),
  panelLine('    --set alertmanager.enabled=true'),
  panelBlank(),
  '',
  'Verify the pods are running:',
  '',
  panelLine('$ kubectl get pods -n monitoring'),
  panelLine(
    'NAME                                                  READY   STATUS    RESTARTS   AGE'
  ),
  panelLine(
    'prometheus-kube-prometheus-operator-7d9f5b6c4-abc12   1/1     Running   0          60s'
  ),
  panelLine(
    'prometheus-grafana-85f4c9d7b-xyz99                    3/3     Running   0          60s'
  ),
  panelLine(
    'alertmanager-prometheus-alertmanager-0                1/1     Running   0          60s'
  ),
  panelBlank(),
]);

/** klog-format log lines from kubectl logs detected as code */
export const fb11_klogFormatLogs = makeRaw([
  'Check controller logs:',
  '',
  panelLine('$ kubectl logs -n kube-system deployment/kube-controller-manager --tail=5'),
  panelLine('I0115 10:30:00.123456       1 main.go:50] Starting controller v1.28.0'),
  panelLine('I0115 10:30:01.234567       1 leaderelection.go:258] successfully acquired lease'),
  panelLine('W0115 10:30:05.345678       1 reflector.go:302] pkg/mod/cache: watch closed'),
  panelLine(
    'E0115 10:30:06.456789       1 controller.go:114] error syncing key: connection refused'
  ),
  panelLine('I0115 10:30:07.567890       1 controller.go:120] requeue: default/my-deployment'),
  panelBlank(),
]);

/** logfmt structured logging lines detected as code */
export const fb11_logfmtStructuredLogs = makeRaw([
  'Application logs:',
  '',
  panelLine('$ kubectl logs -n production deployment/api-server --tail=5'),
  panelLine('level=info msg="server started" port=8080 version=v1.2.3'),
  panelLine('level=info msg="connected to database" host=postgres:5432 db=myapp'),
  panelLine('level=error msg="request failed" status=503 path=/api/health'),
  panelLine('level=warn msg="slow query" duration=2.5s table=users'),
  panelLine('level=info msg="graceful shutdown" signal=SIGTERM'),
  panelBlank(),
]);

/** K8s validation errors stay in code block */
export const fb11_k8sValidationErrors = makeRaw([
  'If validation fails:',
  '',
  panelLine('$ kubectl apply -f deployment.yaml'),
  panelLine('The Deployment "my-app" is invalid:'),
  panelLine('* spec.containers[0].image: Required value'),
  panelLine('* spec.containers[0].name: Required value'),
  panelLine('* spec.template.metadata.labels: Invalid value: map[string]string(nil)'),
  panelBlank(),
]);

/** K8s scheduling messages stay in kubectl describe output */
export const fb11_k8sSchedulingDescribe = makeRaw([
  'Check pod status:',
  '',
  panelLine('$ kubectl describe pod stuck-pod -n production'),
  panelLine('Name:         stuck-pod'),
  panelLine('Status:       Pending'),
  panelLine('Conditions:'),
  panelLine('  Type             Status'),
  panelLine('  PodScheduled     False'),
  panelLine('Events:'),
  panelLine('  Type     Reason            Message'),
  panelLine('  ----     ------            -------'),
  panelLine(
    '  Warning  FailedScheduling  0/3 nodes are available: 1 Insufficient cpu, 2 node(s) had taint'
  ),
  panelBlank(),
]);

/** PVC and other resource status lines detected as code */
export const fb11_pvcResourceStatus = makeRaw([
  'Apply storage:',
  '',
  panelLine('$ kubectl apply -f storage.yaml'),
  panelLine('storageclass.storage.k8s.io/fast-ssd created'),
  panelLine('persistentvolumeclaim/data-pvc created'),
  panelLine('persistentvolume/nfs-pv configured'),
  panelBlank(),
]);

/** helm upgrade output with hooks and notes stays in code block */
export const fb11_helmUpgradeHooks = makeRaw([
  'Upgrade the release:',
  '',
  panelLine('$ helm upgrade my-release ./chart -n production --install'),
  panelLine('Release "my-release" has been upgraded. Happy Helming!'),
  panelLine('NAME: my-release'),
  panelLine('LAST DEPLOYED: Mon Jan 15 10:30:00 2024'),
  panelLine('NAMESPACE: production'),
  panelLine('STATUS: deployed'),
  panelLine('REVISION: 5'),
  panelLine('HOOKS:'),
  panelLine('---'),
  panelLine('# Source: mychart/templates/tests/test-connection.yaml'),
  panelLine('apiVersion: v1'),
  panelLine('kind: Pod'),
  panelBlank(),
]);

/** az aks and kubeconfig commands with output stay together */
export const fb11_azAksGetCredentials = makeRaw([
  'Connect to AKS:',
  '',
  panelLine('$ az aks get-credentials --resource-group myRG --name myAKS --overwrite-existing'),
  panelLine('Merged "myAKS" as current context in /home/user/.kube/config'),
  panelBlank(),
  '',
  'Verify context:',
  '',
  panelLine('$ kubectl config current-context'),
  panelLine('myAKS'),
  panelBlank(),
  '',
  'Check nodes:',
  '',
  panelLine('$ kubectl get nodes'),
  panelLine('NAME                                STATUS   ROLES   AGE   VERSION'),
  panelLine('aks-nodepool1-12345678-vmss000000   Ready    agent   5d    v1.28.3'),
  panelLine('aks-nodepool1-12345678-vmss000001   Ready    agent   5d    v1.28.3'),
  panelLine('aks-nodepool1-12345678-vmss000002   Ready    agent   5d    v1.28.3'),
  panelBlank(),
]);

/** Pod with service mesh annotations stays in one YAML block */
export const fb11_istioSidecarAnnotations = makeRaw([
  'Add Istio sidecar injection:',
  '',
  panelLine('apiVersion: v1'),
  panelLine('kind: Pod'),
  panelLine('metadata:'),
  panelLine('  name: my-app'),
  panelLine('  annotations:'),
  panelLine('    sidecar.istio.io/inject: "true"'),
  panelLine('    sidecar.istio.io/proxyMemory: "256Mi"'),
  panelLine('    prometheus.io/scrape: "true"'),
  panelLine('    prometheus.io/port: "8080"'),
  panelLine('spec:'),
  panelLine('  containers:'),
  panelLine('  - name: my-app'),
  panelLine('    image: myapp:latest'),
  panelLine('    ports:'),
  panelLine('    - containerPort: 8080'),
  panelBlank(),
]);

/** bare logfmt structured logging wrapped in code block */
export const fb11_bareLogfmtOutput = makeRaw([
  'The application logs show:',
  '',
  panelLine('level=info msg="server started" port=8080 version=v1.2.3'),
  panelLine('level=info msg="connected to database" host=postgres:5432'),
  panelLine('level=error msg="request failed" status=503 path=/api/health'),
  panelBlank(),
]);

/** bare klog format controller logs wrapped in code block */
export const fb11_bareKlogFormat = makeRaw([
  'Controller logs show:',
  '',
  panelLine('I0115 10:30:00.123456       1 main.go:50] Starting controller v1.28.0'),
  panelLine('I0115 10:30:01.234567       1 leaderelection.go:258] acquired lease'),
  panelLine('W0115 10:30:05.345678       1 reflector.go:302] watch closed'),
  panelBlank(),
]);

/** bare kubectl resource action output from panel wrapped as code */
export const fb11_bareResourceActionOutput = makeRaw([
  'After applying:',
  '',
  panelLine('deployment.apps/my-app configured'),
  panelLine('service/my-app-svc created'),
  panelLine('configmap/my-config unchanged'),
  panelLine('ingress.networking.k8s.io/my-ingress created'),
  panelBlank(),
]);

/** terraform output values at panel indent wrapped as code */
export const fb11_terraformOutputValues = makeRaw([
  'Terraform outputs:',
  '',
  panelLine('cluster_endpoint = "https://myaks-abc.hcp.eastus.azmk8s.io:443"'),
  panelLine('cluster_name = "myAKSCluster"'),
  panelLine('resource_group = "myResourceGroup"'),
  panelLine('kube_config = <sensitive>'),
  panelBlank(),
]);

/** bare PromQL expression with [5m] wrapped as code */
export const fb11_barePromQL5m = makeRaw([
  'Use this PromQL query:',
  '',
  panelLine('sum(rate(container_cpu_usage_seconds_total{namespace="prod"}[5m])) by (pod)'),
  panelBlank(),
]);

/** multi-step AKS troubleshooting with commands and YAML */
export const fb11_aksTroubleshooting = makeRaw([
  'Troubleshoot the failing pod:',
  '',
  '1. Check the pods:',
  '',
  panelLine('$ kubectl get pods -n production -l app=my-app'),
  panelLine('NAME                     READY   STATUS             RESTARTS   AGE'),
  panelLine('my-app-abc12             0/1     CrashLoopBackOff   5          10m'),
  panelBlank(),
  '',
  '2. Check the logs:',
  '',
  panelLine('$ kubectl logs my-app-abc12 -n production --previous'),
  panelLine('Error: Cannot find module "/app/server.js"'),
  panelBlank(),
  '',
  '3. Fix the Deployment:',
  '',
  panelLine('apiVersion: apps/v1'),
  panelLine('kind: Deployment'),
  panelLine('metadata:'),
  panelLine('  name: my-app'),
  panelLine('spec:'),
  panelLine('  template:'),
  panelLine('    spec:'),
  panelLine('      containers:'),
  panelLine('      - name: my-app'),
  panelLine('        command: ["node", "dist/server.js"]'),
  panelBlank(),
]);

/** K8s Secret with base64 data stays in one YAML block */
export const fb11_k8sSecretBase64 = makeRaw([
  'Create the Secret:',
  '',
  panelLine('apiVersion: v1'),
  panelLine('kind: Secret'),
  panelLine('metadata:'),
  panelLine('  name: db-credentials'),
  panelLine('  namespace: production'),
  panelLine('type: Opaque'),
  panelLine('data:'),
  panelLine('  DB_HOST: cG9zdGdyZXMucHJvZHVjdGlvbi5zdmMuY2x1c3Rlci5sb2NhbA=='),
  panelLine('  DB_USER: bXlhcHB1c2Vy'),
  panelLine('  DB_PASS: c3VwZXJzZWNyZXRwYXNzd29yZA=='),
  panelLine('  DB_NAME: bXlhcHBkYg=='),
  panelBlank(),
]);

// ===========================================================================
// Round 12 – findbugs12.test.ts
// ===========================================================================

/** bare PromQL expressions detected as code */
export const fb12_barePromQLExpressions = makeRaw([
  'Use these PromQL queries to monitor:',
  '',
  panelLine('sum(rate(container_cpu_usage_seconds_total{namespace="prod"}[5m])) by (pod)'),
  panelBlank(),
]);

/** bare K8s event messages detected as code */
export const fb12_bareK8sEventMessages = makeRaw([
  'The pod events show:',
  '',
  panelLine('Pulling image "nginx:1.25"'),
  panelLine('Successfully assigned production/web-abc12 to aks-node-0'),
  panelLine('Container image "nginx:1.25" already present on machine'),
  panelLine('Created container nginx'),
  panelLine('Started container nginx'),
  panelBlank(),
]);

/** bare scheduling failure messages detected as code */
export const fb12_bareSchedulingFailure = makeRaw([
  'The scheduling error shows:',
  '',
  panelLine('0/3 nodes are available: 1 Insufficient cpu, 2 node(s) had taint'),
  panelLine('{node.kubernetes.io/not-ready: }, that the pod did not tolerate.'),
  panelBlank(),
]);

/** bare Prometheus metric query results detected as code */
export const fb12_barePrometheusMetrics = makeRaw([
  'Current metric values:',
  '',
  panelLine('container_memory_working_set_bytes{namespace="prod",pod="api-abc12"} 134217728'),
  panelLine('container_cpu_usage_seconds_total{namespace="prod",pod="api-abc12"} 45.23'),
  panelLine('kube_pod_status_phase{namespace="prod",phase="Running"} 5'),
  panelBlank(),
]);

/** bare readiness probe failure messages detected as code */
export const fb12_bareProbeFailures = makeRaw([
  'The health check errors show:',
  '',
  panelLine('Readiness probe failed: Get "http://10.0.0.5:8080/healthz": connection refused'),
  panelLine('Liveness probe failed: HTTP probe failed with statuscode: 503'),
  panelLine('Startup probe failed: Get "http://10.0.0.5:8080/ready": context deadline exceeded'),
  panelBlank(),
]);

/** CoreDNS Corefile with deep nesting stays complete */
export const fb12_coreDNSCorefile = makeRaw([
  'The CoreDNS Corefile should look like:',
  '',
  panelLine('.:53 {'),
  panelLine('    errors'),
  panelLine('    health {'),
  panelLine('        lameduck 5s'),
  panelLine('    }'),
  panelLine('    ready'),
  panelLine('    kubernetes cluster.local in-addr.arpa ip6.arpa {'),
  panelLine('        pods insecure'),
  panelLine('        fallthrough in-addr.arpa ip6.arpa'),
  panelLine('        ttl 30'),
  panelLine('    }'),
  panelLine('    prometheus :9153'),
  panelLine('    forward . /etc/resolv.conf'),
  panelLine('    cache 30'),
  panelLine('    loop'),
  panelLine('    reload'),
  panelLine('    loadbalance'),
  panelLine('}'),
  panelBlank(),
]);

/** PrometheusRule CRD YAML with deep rules stays complete */
export const fb12_prometheusRuleCRD = makeRaw([
  'Create the PrometheusRule:',
  '',
  panelLine('apiVersion: monitoring.coreos.com/v1'),
  panelLine('kind: PrometheusRule'),
  panelLine('metadata:'),
  panelLine('  name: app-alerts'),
  panelLine('spec:'),
  panelLine('  groups:'),
  panelLine('  - name: app.rules'),
  panelLine('    rules:'),
  panelLine('    - alert: HighErrorRate'),
  panelLine('      expr: sum(rate(http_requests_total{code=~"5.."}[5m])) > 0.1'),
  panelLine('      for: 5m'),
  panelLine('      labels:'),
  panelLine('        severity: critical'),
  panelLine('      annotations:'),
  panelLine('        summary: High error rate detected'),
  panelLine('        description: Error rate is above 10% for 5 minutes'),
  panelBlank(),
]);

/** deeply nested az aks JSON output stays complete */
export const fb12_azAksJsonOutput = makeRaw([
  'Node pool details:',
  '',
  panelLine('{'),
  panelLine('  "agentPoolProfiles": ['),
  panelLine('    {'),
  panelLine('      "name": "nodepool1",'),
  panelLine('      "count": 3,'),
  panelLine('      "vmSize": "Standard_DS2_v2",'),
  panelLine('      "provisioningState": "Succeeded",'),
  panelLine('      "powerState": {'),
  panelLine('        "code": "Running"'),
  panelLine('      },'),
  panelLine('      "nodeLabels": {'),
  panelLine('        "env": "production"'),
  panelLine('      }'),
  panelLine('    }'),
  panelLine('  ]'),
  panelLine('}'),
  panelBlank(),
]);

/** bare container crash messages detected as code */
export const fb12_bareContainerCrash = makeRaw([
  'The pod restart events:',
  '',
  panelLine('Back-off restarting failed container my-app in pod my-app-abc12'),
  panelLine('Killing container with a]id docker://abc123def to re-create'),
  panelLine('Container my-app definition changed, will be restarted'),
  panelBlank(),
]);

/** bare volume mount failure messages detected as code */
export const fb12_bareVolumeMountFailure = makeRaw([
  'The storage errors show:',
  '',
  panelLine('MountVolume.SetUp failed for volume "data-vol" : secret "app-secret" not found'),
  panelLine('Unable to attach or mount volumes: timed out waiting for the condition'),
  panelLine('AttachVolume.Attach failed for volume "pvc-abc123" : disk not found'),
  panelBlank(),
]);

/** bare image pull failure messages detected as code */
export const fb12_bareImagePullFailure = makeRaw([
  'The image pull errors:',
  '',
  panelLine('Failed to pull image "myregistry.azurecr.io/myapp:v2.0.0": rpc error'),
  panelLine('Error response from daemon: manifest for myapp:v2.0.0 not found'),
  panelLine('Normal BackOff 5m (x3 over 10m) kubelet Back-off pulling image'),
  panelBlank(),
]);

/** bare scheduling detail messages detected as code */
export const fb12_bareSchedulingDetails = makeRaw([
  'Scheduling failure details:',
  '',
  panelLine('Insufficient cpu (1500m requested vs 1000m available)'),
  panelLine('Insufficient memory (2Gi requested vs 512Mi available)'),
  panelLine('node(s) had volume node affinity conflict'),
  panelLine('node(s) did not match Pod topologySpreadConstraints'),
  panelBlank(),
]);

/** bare CRI-O container log lines detected as code */
export const fb12_bareCRIOLogs = makeRaw([
  'Raw container runtime logs:',
  '',
  panelLine('stdout F Starting application v2.1.0'),
  panelLine('stdout F Connected to database at postgres:5432'),
  panelLine('stdout F Listening on port 8080'),
  panelLine('stderr F Error: connection reset by peer'),
  panelLine('stdout F GET /api/health 200 2ms'),
  panelBlank(),
]);

/** bare multi-line container lifecycle events detected as code */
export const fb12_bareContainerLifecycle = makeRaw([
  'Container lifecycle events:',
  '',
  panelLine('Pulling image "myapp:v2.0.0"'),
  panelLine('Successfully pulled image "myapp:v2.0.0" in 3.2s'),
  panelLine('Created container my-app'),
  panelLine('Started container my-app'),
  panelLine('Liveness probe failed: HTTP probe failed with statuscode: 503'),
  panelLine('Container my-app failed liveness probe, will be restarted'),
  panelBlank(),
]);

/** bare key=value diagnostic output detected as code */
export const fb12_bareKeyValueDiagnostics = makeRaw([
  'Container runtime info:',
  '',
  panelLine('runtime.name=containerd runtime.version=1.7.2'),
  panelLine('runtime.endpoint=/run/containerd/containerd.sock'),
  panelLine('pod.name=my-app-abc12 namespace=production node=aks-node-0'),
  panelLine('container.id=abc123def456 image=myapp:v2.0.0 state=running'),
  panelBlank(),
]);

// ===========================================================================
// Round 13 — Negative examples (things that should NOT be wrapped as code)
// ===========================================================================

/** prose sentence ending with colon — should NOT produce a code block */
export const fb13_proseColonEnding = makeRaw([
  "Send one of these and I'll diagnose it:",
  '',
  'You can also describe what went wrong in your own words.',
]);

/** diagnostic summary ending with colon — should NOT be code */
export const fb13_diagnosticSummaryColon = makeRaw([
  'No obvious pod problems right now:',
  '',
  'If you want, I can dig into why those restarted by describing those pods and',
  'pulling their previous logs.',
]);

/** step heading "Build + push:" should not produce an empty code block */
export const fb13_stepHeadingColon = makeRaw([
  'Build + push:',
  '',
  'export IMAGE=ghcr.io/<you>/rust-app:0.1.0',
  'docker build -t $IMAGE .',
  'docker push $IMAGE',
]);

/** "Assumes:" heading followed by Dockerfile — no empty code block from heading */
export const fb13_assumesHeadingColon = makeRaw([
  'Assumes:',
  '',
  'FROM golang:1.22-bookworm AS builder',
  'WORKDIR /src',
  'COPY go.mod go.sum ./',
  'RUN go mod download',
]);

/** markdown bold text with k8s terms — NOT code */
export const fb13_boldK8sTerms = makeRaw([
  'The **deployment** is running in the **kube-system** namespace.',
  'Check the **pod** status with the command above.',
  'The **service** endpoint should be reachable at port 443.',
]);

/** markdown bullet list with technical terms — NOT code */
export const fb13_bulletListTechTerms = makeRaw([
  'Common reasons for pod restarts:',
  '',
  '- Out of memory (OOMKilled)',
  '- Liveness probe failure',
  '- Image pull errors',
  '- CrashLoopBackOff due to application bugs',
  '- Volume mount failures',
]);

/** numbered step list with k8s actions — NOT code */
export const fb13_numberedStepList = makeRaw([
  'Follow these steps:',
  '',
  '1. Create the deployment using the YAML above',
  '2. Verify pods are running with kubectl get pods',
  '3. Check the service endpoints',
  '4. Test connectivity from another pod',
]);

/** markdown headers — NOT YAML comments or code */
export const fb13_markdownHeaders = makeRaw([
  '## Troubleshooting Pod Restarts',
  '',
  'Here are some things to check when pods keep restarting.',
  '',
  '### Step 1: Check Pod Events',
  '',
  'Look at the events section of the pod describe output.',
  '',
  '### Step 2: Check Logs',
  '',
  'Pull the previous container logs to see what happened.',
]);

/** prose with URLs — NOT code */
export const fb13_proseWithUrls = makeRaw([
  'For more information, see the Kubernetes documentation:',
  'https://kubernetes.io/docs/concepts/workloads/pods/',
  '',
  'You can also check the Azure AKS troubleshooting guide at',
  'https://learn.microsoft.com/en-us/azure/aks/troubleshooting',
]);

/** "Note:" prefix with explanation — NOT code */
export const fb13_notePrefix = makeRaw([
  'Note: the above configuration assumes you have cluster-admin permissions.',
  'If you are using a restricted RBAC role, you may need to request additional',
  'access from your platform team.',
]);

/** multi-paragraph technical explanation — NOT code */
export const fb13_multiParagraphExplanation = makeRaw([
  'The pod is in CrashLoopBackOff because the container exits immediately.',
  'This usually means the application crashed during startup.',
  '',
  'Common causes include missing environment variables, incorrect',
  'database connection strings, or insufficient memory limits.',
  '',
  'I recommend checking the previous container logs first.',
]);

/** prose with inline code backticks — NOT wrapped in code fence */
export const fb13_inlineCodeBackticks = makeRaw([
  'You can check the status by running `kubectl get pods -n kube-system`.',
  'The output should show all pods in Running state.',
  'If any show `CrashLoopBackOff`, check their logs with `kubectl logs`.',
]);

/** prose with colon-separated key-value descriptions — NOT YAML */
export const fb13_proseKeyValueDescriptions = makeRaw([
  "Here's what I found:",
  '',
  'The cluster has 3 node pools with a total of 12 nodes.',
  'All nodes show Ready status and have sufficient resources.',
  'The API server is responding normally with no error spikes.',
]);

/** questions about k8s resources — NOT code */
export const fb13_questionsAboutK8s = makeRaw([
  'A few questions to narrow this down:',
  '',
  'Which namespace is the deployment in?',
  'How many replicas are configured?',
  'Are there any resource limits set on the containers?',
  'Is the cluster using a custom CNI plugin?',
]);

/** mixed markdown formatting (bold, italic, lists, headers) — NOT code */
export const fb13_mixedMarkdownFormatting = makeRaw([
  '## Summary',
  '',
  "Your cluster looks **healthy** overall. Here's what I checked:",
  '',
  '- **Node status**: all 6 nodes are _Ready_',
  '- **Pod health**: 42/45 pods running (3 in Pending)',
  '- **Resource usage**: ~60% CPU, ~70% memory',
  '',
  'The 3 pending pods are waiting for node scale-up.',
  'This should resolve within 5-10 minutes as the autoscaler kicks in.',
]);

// ===========================================================================
// Round 14 — Prose-colon false positives in panel recovery
// ===========================================================================

/** "Also confirm:" after kubectl commands — prose, not code */
export const fb14_alsoConfirmAfterShell = makeRaw([
  ' kubectl get pods -n production',
  ' kubectl get svc -n production',
  '',
  ' Also confirm:',
  '',
  ' - the image tag matches what was pushed',
  ' - the pull secret exists in the namespace',
]);

/** "Also confirm:" without blank line after shell — not code */
export const fb14_alsoConfirmNoBlank = makeRaw([
  ' kubectl get pods -n production',
  ' Also confirm:',
  ' - the image tag matches',
]);

/** "Also confirm:" after double blank — not code */
export const fb14_alsoConfirmDoubleBlank = makeRaw([
  ' kubectl get pods -n production',
  ' kubectl get svc -n production',
  '',
  '',
  ' Also confirm:',
  '',
  ' - the image tag matches',
]);

/** "Build + push:" prose heading — not code */
export const fb14_buildPushProseHeading = makeRaw([
  ' docker build -t myapp:latest .',
  ' Build + push:',
  ' You can push with docker push.',
]);

/** Rich panel code then "Also confirm:" stays prose */
export const fb14_panelCodeThenAlsoConfirm = makeRaw([
  boldLine('Commands'),
  panelBlank(),
  panelLine('kubectl get deploy -n prod'),
  panelLine('kubectl get svc -n prod'),
  panelBlank(),
  '',
  'Also confirm:',
  '',
  '- the image tag matches',
  '- the pull secret exists',
]);

// ===========================================================================
// Round 15 — Filename-hint detection, numbered step headers, capitalized headings
// ===========================================================================

/** requirements.txt followed by pinned dependencies (panel format) */
export const fb15_requirementsTxtPanel = makeRaw([
  panelLine('Here are the project files:'),
  panelBlank(),
  boldLine('requirements.txt'),
  panelBlank(),
  panelLine(' fastapi==0.110.0'),
  panelLine(' uvicorn[standard]==0.27.1'),
  panelBlank(),
]);

/** main.py followed by Python code (panel format) */
export const fb15_mainPyPanel = makeRaw([
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
]);

/** numbered step header "3) ..." is NOT a code block (panel format) */
export const fb15_numberedStepHeaderPanel = makeRaw([
  panelLine('                3) Kubernetes (Deployment + Service + optional Ingress)'),
  panelBlank(),
  panelLine('Create a deployment manifest:'),
]);

/** Dockerfile filename followed by Dockerfile content (panel format) */
export const fb15_dockerfilePanel = makeRaw([
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
]);

/** requirements.txt followed by deps (non-panel format) */
// Non-panel fixtures use inline prefix/suffix (no blank line before trailing
// prompt) to match the original test construction in findbugs15.test.ts.
export const fb15_requirementsTxtNonPanel = (() => {
  const body = [
    'Here are the files:',
    '',
    'requirements.txt',
    '',
    'fastapi==0.110.0',
    'uvicorn[standard]==0.27.1',
    '',
  ];
  return [
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
})();

/** main.py followed by Python code (non-panel format) */
export const fb15_mainPyNonPanel = (() => {
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
  return [
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
})();

/** numbered header "3) ..." is NOT code (non-panel format) */
export const fb15_numberedStepHeaderNonPanel = (() => {
  const body = [
    '3) Kubernetes (Deployment + Service + optional Ingress)',
    '',
    'Create a deployment YAML for your app.',
  ];
  return [
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
})();

/** Cargo.toml: with trailing colon wraps TOML content (non-panel format) */
export const fb15_cargoTomlNonPanel = (() => {
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
  return [
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
})();

/** deployment.yaml heading keeps YAML separate from filename (panel format) */
export const fb15_deploymentYamlPanel = makeRaw([
  panelLine('Create this manifest:'),
  panelBlank(),
  boldLine('deployment.yaml'),
  panelBlank(),
  panelLine(' apiVersion: apps/v1'),
  panelLine(' kind: Deployment'),
  panelLine(' metadata:'),
  panelLine('   name: myapp'),
  panelBlank(),
]);

/** src/main.rs: with trailing colon wraps Rust code (non-panel format) */
export const fb15_mainRsNonPanel = (() => {
  const body = ['src/main.rs:', '', 'fn main() {', '    println!("Hello, world!");', '}', ''];
  return [
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
})();

/** indented numbered step header after Go code is NOT a code block */
export const fb15_numberedStepAfterGoCode = makeRaw([
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
]);

/** "Assumptions:" between Go code and Dockerfile — prose, not code */
export const fb15_assumptionsBetweenCodeBlocks = makeRaw([
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
]);
