/**
 * findbugs6.test.ts — Round 6 synthetic fixtures targeting parser edge cases.
 * Each test is designed to expose a potential parser bug.
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
  expect(result).not.toMatch(/\[\d+m/);
}

describe('findbugs6: extractAIAnswer edge cases (round 6)', () => {
  // Bug 1: try/catch/finally block should be detected as code
  it('1. Java try-catch-finally stays in one code block', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('try {');
    expect(all).toContain('catch');
    expect(all).toContain('finally');
  });

  // Bug 2: console.log / fmt.Println should be detected as code
  it('2. Print/log statements detected as code', () => {
    const body = [
      'Debug the output:',
      '',
      panelLine('console.log("hello world");'),
      panelLine('fmt.Println("hello from Go")'),
      panelLine('println!("hello from Rust");'),
      panelLine('print("hello from Python")'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('console.log');
  });

  // Bug 3: Arrow functions should be detected as code
  it('3. Arrow functions and modern JS syntax in code block', () => {
    const body = [
      'Create the handler:',
      '',
      panelLine('const handler = async (req, res) => {'),
      panelLine('  const data = await fetchData(req.params.id);'),
      panelLine('  res.json({ status: "ok", data });'),
      panelLine('};'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('=>');
    expect(all).toContain('res.json');
  });

  // Bug 4: TypeScript interface members look like YAML keys
  it('4. TypeScript interface with colon-typed members stays in code block', () => {
    const body = [
      'Define the interface:',
      '',
      panelLine('interface PodStatus {'),
      panelLine('  name: string;'),
      panelLine('  namespace: string;'),
      panelLine('  ready: boolean;'),
      panelLine('  restartCount: number;'),
      panelLine('}'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('interface PodStatus');
    expect(all).toContain('name: string');
    expect(all).toContain('restartCount: number');
  });

  // Bug 5: Shell until loop not detected
  it('5. Shell until loop stays in one code block', () => {
    const body = [
      'Wait for the pod:',
      '',
      panelLine('until kubectl get pod myapp -o jsonpath="{.status.phase}" | grep -q Running; do'),
      panelLine('  echo "Waiting for pod..."'),
      panelLine('  sleep 5'),
      panelLine('done'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('until');
    expect(all).toContain('done');
  });

  // Bug 6: Prose between two separate code blocks
  it('6. Prose between two code blocks keeps them separate', () => {
    const body = [
      'First, create the namespace:',
      '',
      panelLine('kubectl create namespace production'),
      panelBlank(),
      '',
      'Then deploy the application:',
      '',
      panelLine('kubectl apply -f deployment.yaml -n production'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0]).toContain('create namespace');
    expect(blocks[1]).toContain('kubectl apply');
  });

  // Bug 7: Python f-string with braces
  it('7. Python f-string with braces stays in code block', () => {
    const body = [
      'Log the request:',
      '',
      panelLine('logger.info(f"Request to {endpoint} returned {status_code}")'),
      panelLine('logger.debug(f"Headers: {dict(response.headers)}")'),
      panelLine('logger.error(f"Failed after {retries} retries: {str(err)}")'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('logger.info');
    expect(all).toContain('logger.error');
  });

  // Bug 8: K8s YAML with anchors
  it('8. K8s YAML with anchors and aliases stays in one block', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('apiVersion');
    expect(all).toContain('500m');
  });

  // Bug 9: Rust enum with derive macro
  it('9. Rust enum with derive and variants stays in one block', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('#[derive');
    expect(all).toContain('pub enum AppError');
  });

  // Bug 10: Shell if/elif/else/fi
  it('10. Shell if/elif/else/fi stays in one block', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('if kubectl');
    expect(all).toContain('fi');
  });

  // Bug 11: Go goroutine with channel
  it('11. Go goroutine with channel stays in code block', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('func worker');
    expect(all).toContain('results <- j * 2');
  });

  // Bug 12: Multi-line docker run with backslash
  it('12. Docker run with backslash continuation stays together', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('docker run');
    expect(all).toContain('myimage:latest');
  });

  // Bug 13: Java annotations and class
  it('13. Java annotations and class stay in one block', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('@RestController');
    expect(all).toContain('class UserController');
  });

  // Bug 14: kubectl patch with JSON
  it('14. kubectl patch with inline JSON stays in one block', () => {
    const body = [
      'Scale the deployment:',
      '',
      panelLine("kubectl patch deployment myapp -p '{\"spec\":{\"replicas\":5}}'"),
      panelLine('kubectl rollout status deployment/myapp'),
      panelLine('kubectl get pods -l app=myapp -o wide'),
      panelBlank(),
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const all = blocks.join('\n');
    expect(all).toContain('kubectl patch');
    expect(all).toContain('kubectl get pods');
  });

  // Bug 15: Mixed YAML and shell with prose between
  it('15. YAML and shell blocks separated by prose', () => {
    const body = [
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
    ];
    const result = extractAIAnswer(makeRaw(body));
    assertNoAnsiLeaks(result);
    const blocks = extractCodeBlocks(result);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    const all = blocks.join('\n');
    expect(all).toContain('apiVersion: v1');
    expect(all).toContain('kubectl apply');
  });
});
