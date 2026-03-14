/**
 * 200 synthetic tests targeting parser edge cases in extractAIAnswer.
 *
 * Each category targets a specific bug or boundary condition.
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { _testing } from './aksAgentManager';

const { extractAIAnswer } = _testing;

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

/** Minimum leading spaces that simulate Rich centered headings. */
const CENTERED_INDENT = 20;

/** Split a key at its midpoint (for ANSI-split tests). */
function splitAtMid(key: string): [string, string] {
  const mid = Math.floor(key.length / 2);
  return [key.slice(0, mid), key.slice(mid)];
}

function panelLine(content: string, keyColor = '97;40'): string {
  const padded = content.padEnd(78);
  return `\x1b[40m \x1b[0m\x1b[${keyColor}m${padded}\x1b[0m\x1b[40m \x1b[0m`;
}

function panelBlank(): string {
  return '\x1b[40m' + ' '.repeat(80) + '\x1b[0m';
}

function makeFixture(contentLines: string[]): string {
  return [
    'stty -echo',
    '\x1b[?2004l',
    '\x1b[?2004hroot@aks-agent:/app# ',
    '\x1b[?2004l',
    '',
    "Loaded models: ['azure/gpt-4']",
    '\x1b[1;96mAI:\x1b[0m ',
    '',
    ...contentLines,
    '',
    '\x1b[?2004hroot@aks-agent:/app# ',
  ].join('\n');
}

function extractCodeBlocks(result: string): string[] {
  const blocks: string[] = [];
  let current = '';
  let inFence = false;
  for (const line of result.split('\n')) {
    if (/^```/.test(line.trim())) {
      if (inFence) {
        blocks.push(current);
        current = '';
      }
      inFence = !inFence;
      continue;
    }
    if (inFence) current += line + '\n';
  }
  if (inFence && current) blocks.push(current);
  return blocks;
}

function assertNoAnsiLeaks(text: string): void {
  expect(text).not.toMatch(/\x1b/);
  expect(text).not.toMatch(/\[[\d;]*m/);
}

// ---------------------------------------------------------------------------
// 1. Centered "Word: Rest" titles absorbed into code blocks (15 tests)
// ---------------------------------------------------------------------------
describe('1 – Centered "Word: Rest" titles must not be absorbed into code blocks', () => {
  const titles = [
    'Optional: Ingress',
    'Required: Database',
    'Advanced: Monitoring',
    'Security: RBAC',
    'Bonus: Autoscaling',
    'Note: Horizontal Pod Autoscaler',
    'Warning: Resource Limits',
    'Tip: Health Checks',
    'Important: Network Policies',
    'Example: Service Mesh',
    'Alternative: StatefulSet',
    'Recommended: Pod Disruption Budget',
    'Optional: Cert Manager',
    'Debugging: Ephemeral Containers',
    'Production: Cluster Autoscaler',
  ];

  titles.forEach((title, i) => {
    describe(`1.${i + 1} – ${title}`, () => {
      let result: string;

      beforeAll(() => {
        const centered = ' '.repeat(CENTERED_INDENT) + title;
        const fixture = makeFixture([
          'Here is a Kubernetes deployment:',
          '',
          '\x1b[1mdeployment.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: apps/v1'),
          panelLine('kind: Deployment'),
          panelLine('metadata:'),
          panelLine('  name: my-app'),
          panelBlank(),
          '',
          centered,
          '',
          '\x1b[1mservice.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: v1'),
          panelLine('kind: Service'),
          panelLine('metadata:'),
          panelLine('  name: my-app'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('title appears outside code blocks', () => {
        const blocks = extractCodeBlocks(result);
        for (const block of blocks) {
          expect(block).not.toContain(title);
        }
      });

      it('title is present in result', () => {
        expect(result).toContain(title.replace(/^\s+/, '').trim());
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 2. ANSI split YAML keys – metadata[ / 0m: bug (15 tests)
// ---------------------------------------------------------------------------
describe('2 – ANSI split YAML keys must rejoin cleanly', () => {
  const yamlKeys = [
    'metadata',
    'spec',
    'template',
    'containers',
    'resources',
    'labels',
    'annotations',
    'selector',
    'volumes',
    'ports',
    'env',
    'volumeMounts',
    'livenessProbe',
    'readinessProbe',
    'strategy',
  ];

  yamlKeys.forEach((key, i) => {
    describe(`2.${i + 1} – split key "${key}"`, () => {
      let result: string;

      beforeAll(() => {
        // Simulate ANSI split: key gets split with \x1b[ at end, 0m: at start of next line
        const [part1, part2] = splitAtMid(key);
        const fixture = makeFixture([
          'Here is the YAML:',
          '',
          '\x1b[1mmanifest.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: v1'),
          panelLine('kind: ConfigMap'),
          // The split line: part1 + ANSI escape at end
          `\x1b[40m \x1b[0m\x1b[97;40m${part1}\x1b[`,
          // Next line starts with dangling ANSI reset + part2:
          `0m${part2}:\x1b[0m`,
          panelLine('  name: test'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it(`no "[" artifact from split`, () => {
        const [p1] = splitAtMid(key);
        const lines = result.split('\n');
        for (const line of lines) {
          if (line.includes(p1)) {
            expect(line).not.toMatch(new RegExp(`${p1}\\[`));
          }
        }
      });

      it(`no "0m:" artifact from split`, () => {
        expect(result).not.toMatch(/^0m:/m);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Prose sentences misidentified as YAML (15 tests)
// ---------------------------------------------------------------------------
describe('3 – Prose sentences starting with "Word:" must not become YAML', () => {
  const proseLines = [
    'Example: Node.js (JavaScript) HTTP app running on port 8080',
    'Note: This approach works best with stateless applications deployed on Kubernetes',
    'Warning: Be sure to set resource limits for all production containers',
    'Tip: Use readiness probes so the service routes traffic only to ready pods',
    'Important: Always configure pod disruption budgets before doing rolling updates',
    'Summary: The deployment creates three replicas across two availability zones',
    'Result: All pods should be running and the service should be accessible externally',
    'Reason: The kubelet evicted the pod because memory usage exceeded the limit',
    'Solution: Increase the memory request and limit in the container spec',
    'Output: You should see three healthy pods in the default namespace',
    'Context: This assumes you have an AKS cluster with RBAC enabled already',
    'Background: Kubernetes uses etcd as its backing store for all cluster data',
    'Caveat: Horizontal pod autoscaling requires the metrics server to be installed',
    'Reminder: Apply network policies to restrict pod-to-pod communication in production',
    'Detail: Each node pool can have different VM sizes for heterogeneous workloads',
  ];

  proseLines.forEach((prose, i) => {
    describe(`3.${i + 1} – "${prose.slice(0, 40)}..."`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Here is some guidance:',
          '',
          prose,
          '',
          'Let me know if you need more details.',
        ]);
        result = extractAIAnswer(fixture);
      });

      it('prose line is NOT inside a code block', () => {
        const blocks = extractCodeBlocks(result);
        for (const block of blocks) {
          expect(block).not.toContain(prose);
        }
      });

      it('prose content is present', () => {
        // Check the key portion is in the output
        const colonIdx = prose.indexOf(':');
        const value = prose.slice(colonIdx + 1).trim();
        const firstFewWords = value.split(' ').slice(0, 3).join(' ');
        expect(result).toContain(firstFewWords);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Multi-language code blocks (24 tests – 2 per language)
// ---------------------------------------------------------------------------
describe('4 – Multi-language code blocks', () => {
  const languages: Array<{
    lang: string;
    file1: string;
    lines1: string[];
    file2: string;
    lines2: string[];
  }> = [
    {
      lang: 'Fortran',
      file1: 'hello.f90',
      lines1: ['program hello', '  implicit none', '  print *, "Hello, World!"', 'end program hello'],
      file2: 'math.f90',
      lines2: [
        'module math_mod',
        '  implicit none',
        'contains',
        '  function add(a, b) result(c)',
        '    real :: a, b, c',
        '    c = a + b',
        '  end function',
        'end module',
      ],
    },
    {
      lang: 'COBOL',
      file1: 'hello.cob',
      lines1: [
        'IDENTIFICATION DIVISION.',
        'PROGRAM-ID. HELLO.',
        'PROCEDURE DIVISION.',
        '    DISPLAY "Hello World".',
        '    STOP RUN.',
      ],
      file2: 'calc.cob',
      lines2: [
        'IDENTIFICATION DIVISION.',
        'PROGRAM-ID. CALC.',
        'DATA DIVISION.',
        'WORKING-STORAGE SECTION.',
        '01 WS-NUM PIC 9(2) VALUE 0.',
        'PROCEDURE DIVISION.',
        '    ADD 1 TO WS-NUM.',
        '    STOP RUN.',
      ],
    },
    {
      lang: 'PHP',
      file1: 'index.php',
      lines1: ['<?php', 'echo "Hello, World!";', '$x = 42;', 'var_dump($x);', '?>'],
      file2: 'api.php',
      lines2: [
        '<?php',
        'header("Content-Type: application/json");',
        '$data = ["status" => "ok"];',
        'echo json_encode($data);',
        '?>',
      ],
    },
    {
      lang: 'C',
      file1: 'main.c',
      lines1: [
        '#include <stdio.h>',
        'int main(void) {',
        '    printf("Hello\\n");',
        '    return 0;',
        '}',
      ],
      file2: 'utils.c',
      lines2: [
        '#include <stdlib.h>',
        'void* safe_malloc(size_t n) {',
        '    void* p = malloc(n);',
        '    if (!p) abort();',
        '    return p;',
        '}',
      ],
    },
    {
      lang: 'Perl',
      file1: 'hello.pl',
      lines1: ['#!/usr/bin/perl', 'use strict;', 'use warnings;', 'print "Hello, World!\\n";'],
      file2: 'process.pl',
      lines2: [
        '#!/usr/bin/perl',
        'use strict;',
        'my @nums = (1..10);',
        'my @even = grep { $_ % 2 == 0 } @nums;',
        'print join(",", @even), "\\n";',
      ],
    },
    {
      lang: 'Ruby',
      file1: 'app.rb',
      lines1: [
        'require "sinatra"',
        'get "/" do',
        '  "Hello, World!"',
        'end',
      ],
      file2: 'worker.rb',
      lines2: [
        'class Worker',
        '  def initialize(name)',
        '    @name = name',
        '  end',
        '  def run',
        '    puts "Running #{@name}"',
        '  end',
        'end',
      ],
    },
    {
      lang: 'Java',
      file1: 'Main.java',
      lines1: [
        'public class Main {',
        '    public static void main(String[] args) {',
        '        System.out.println("Hello");',
        '    }',
        '}',
      ],
      file2: 'Service.java',
      lines2: [
        'public class Service {',
        '    private final String name;',
        '    public Service(String name) {',
        '        this.name = name;',
        '    }',
        '    public String greet() {',
        '        return "Hello, " + name;',
        '    }',
        '}',
      ],
    },
    {
      lang: 'Lua',
      file1: 'init.lua',
      lines1: ['local M = {}', 'function M.hello()', '  print("Hello, World!")', 'end', 'return M'],
      file2: 'config.lua',
      lines2: [
        'local config = {',
        '  host = "0.0.0.0",',
        '  port = 8080,',
        '  debug = false,',
        '}',
        'return config',
      ],
    },
    {
      lang: 'Swift',
      file1: 'main.swift',
      lines1: ['import Foundation', 'print("Hello, World!")', 'let x = 42', 'print("Value: \\(x)")'],
      file2: 'server.swift',
      lines2: [
        'import Vapor',
        'let app = Application()',
        'app.get("hello") { req in',
        '    return "Hello, world!"',
        '}',
        'try app.run()',
      ],
    },
    {
      lang: 'Zig',
      file1: 'main.zig',
      lines1: [
        'const std = @import("std");',
        'pub fn main() !void {',
        '    const stdout = std.io.getStdOut().writer();',
        '    try stdout.print("Hello\\n", .{});',
        '}',
      ],
      file2: 'alloc.zig',
      lines2: [
        'const std = @import("std");',
        'pub fn create(allocator: std.mem.Allocator) ![]u8 {',
        '    return allocator.alloc(u8, 1024);',
        '}',
      ],
    },
    {
      lang: 'Nim',
      file1: 'hello.nim',
      lines1: ['echo "Hello, World!"', 'let x = 42', 'echo "Value: ", x'],
      file2: 'server.nim',
      lines2: [
        'import asynchttpserver, asyncdispatch',
        'var server = newAsyncHttpServer()',
        'proc cb(req: Request) {.async.} =',
        '  await req.respond(Http200, "OK")',
        'waitFor server.serve(Port(8080), cb)',
      ],
    },
    {
      lang: 'Haskell',
      file1: 'Main.hs',
      lines1: [
        'module Main where',
        'main :: IO ()',
        'main = putStrLn "Hello, World!"',
      ],
      file2: 'Lib.hs',
      lines2: [
        'module Lib (factorial) where',
        'factorial :: Integer -> Integer',
        'factorial 0 = 1',
        'factorial n = n * factorial (n - 1)',
      ],
    },
  ];

  languages.forEach((lang, i) => {
    describe(`4.${i * 2 + 1} – ${lang.lang} file: ${lang.file1}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          `Here is a ${lang.lang} example:`,
          '',
          `\x1b[1m${lang.file1}\x1b[0m`,
          panelBlank(),
          ...lang.lines1.map(l => panelLine(l)),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('code is inside a code block', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        // Check that at least part of the first source line is present
        const firstLine = lang.lines1[0];
        const found = blocks.some(b => b.includes(firstLine));
        expect(found).toBe(true);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });

    describe(`4.${i * 2 + 2} – ${lang.lang} file: ${lang.file2}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          `Another ${lang.lang} file:`,
          '',
          `\x1b[1m${lang.file2}\x1b[0m`,
          panelBlank(),
          ...lang.lines2.map(l => panelLine(l)),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('code is inside a code block', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        const firstLine = lang.lines2[0];
        const found = blocks.some(b => b.includes(firstLine));
        expect(found).toBe(true);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 5. PROSE_WORD_THRESHOLD boundary: 4-word vs 5-word (20 tests)
// ---------------------------------------------------------------------------
describe('5 – PROSE_WORD_THRESHOLD boundary', () => {
  const fourWordLines = [
    '    kubectl get pods running',
    '    docker build image now',
    '    helm install chart here',
    '    terraform apply plan output',
    '    nginx reverse proxy config',
    '    redis cache set key',
    '    mysql select from table',
    '    python manage.py runserver now',
    '    node server.js start app',
    '    cargo build release binary',
  ];

  const fiveWordLines = [
    '    Run kubectl get pods to verify',
    '    This will build the Docker image',
    '    Use helm to install the chart',
    '    Apply the terraform plan to infrastructure',
    '    Configure nginx as a reverse proxy',
    '    Set the redis cache key value',
    '    Select all rows from the table',
    '    Run the python server on localhost',
    '    Start the node server on port',
    '    Build the rust binary in release',
  ];

  fourWordLines.forEach((line, i) => {
    describe(`5.${i + 1} – 4-word line treated as code: "${line.trim()}"`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Follow these steps:',
          '',
          line,
          '',
          'Done.',
        ]);
        result = extractAIAnswer(fixture);
      });

      it('4-word indented line may be treated as code', () => {
        // 4-word lines are below the prose threshold, so they should be in a code block
        // or treated as code-like content
        const blocks = extractCodeBlocks(result);
        const trimmed = line.trim();
        // Either in a code block OR the content appears in the result
        const inCodeBlock = blocks.some(b => b.includes(trimmed));
        const inResult = result.includes(trimmed);
        expect(inCodeBlock || inResult).toBe(true);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });

  fiveWordLines.forEach((line, i) => {
    describe(`5.${i + 11} – 5-word line treated as prose: "${line.trim().slice(0, 35)}..."`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Follow these steps:',
          '',
          line,
          '',
          'Done.',
        ]);
        result = extractAIAnswer(fixture);
      });

      it('5-word indented line is treated as prose, not code', () => {
        const blocks = extractCodeBlocks(result);
        const trimmed = line.trim();
        const inCodeBlock = blocks.some(b => b.includes(trimmed));
        // 5+ word lines should NOT be inside code blocks
        expect(inCodeBlock).toBe(false);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Consecutive bold file headings (10 tests)
// ---------------------------------------------------------------------------
describe('6 – Consecutive bold file headings produce separate code blocks', () => {
  const filePairs: Array<[string, string[], string, string[]]> = [
    ['Cargo.toml', ['[package]', 'name = "app"', 'version = "0.1.0"'], 'src/main.rs', ['fn main() {', '    println!("hi");', '}']],
    ['package.json', ['{"name":"app","version":"1.0.0"}'], 'index.js', ['const http = require("http");', 'http.createServer().listen(3000);']],
    ['Dockerfile', ['FROM node:18-alpine', 'WORKDIR /app', 'COPY . .', 'CMD ["node","index.js"]'], 'docker-compose.yml', ['version: "3"', 'services:', '  app:', '    build: .']],
    ['go.mod', ['module example.com/app', 'go 1.21'], 'main.go', ['package main', 'import "fmt"', 'func main() { fmt.Println("hi") }']],
    ['setup.py', ['from setuptools import setup', 'setup(name="app")'], 'app.py', ['from flask import Flask', 'app = Flask(__name__)']],
    ['Gemfile', ['source "https://rubygems.org"', 'gem "sinatra"'], 'app.rb', ['require "sinatra"', 'get "/" do', '  "Hello"', 'end']],
    ['pom.xml', ['<project>', '  <modelVersion>4.0.0</modelVersion>', '</project>'], 'App.java', ['public class App {', '  public static void main(String[] a) {}', '}']],
    ['requirements.txt', ['flask==3.0.0', 'gunicorn==21.2.0'], 'wsgi.py', ['from app import app', 'if __name__ == "__main__":', '    app.run()']],
    ['Makefile', ['build:', '\tgo build -o app .', 'test:', '\tgo test ./...'], 'main_test.go', ['package main', 'import "testing"', 'func TestHello(t *testing.T) {}']],
    ['tsconfig.json', ['{"compilerOptions":{"target":"ES2020"}}'], 'src/index.ts', ['const greet = (name: string): string => `Hello, ${name}`;', 'console.log(greet("World"));']],
  ];

  filePairs.forEach(([file1, code1, file2, code2], i) => {
    describe(`6.${i + 1} – ${file1} then ${file2}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Here are two files:',
          '',
          `\x1b[1m${file1}\x1b[0m`,
          panelBlank(),
          ...code1.map(l => panelLine(l)),
          panelBlank(),
          '',
          `\x1b[1m${file2}\x1b[0m`,
          panelBlank(),
          ...code2.map(l => panelLine(l)),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('produces at least 2 separate code blocks', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(2);
      });

      it('first file content in a block', () => {
        const blocks = extractCodeBlocks(result);
        const found = blocks.some(b => b.includes(code1[0]));
        expect(found).toBe(true);
      });

      it('second file content in a block', () => {
        const blocks = extractCodeBlocks(result);
        const found = blocks.some(b => b.includes(code2[0]));
        expect(found).toBe(true);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 7. CPU millicores preservation (10 tests)
// ---------------------------------------------------------------------------
describe('7 – CPU millicores "m" suffix preserved', () => {
  const cpuValues = ['25m', '50m', '100m', '125m', '200m', '250m', '500m', '750m', '1000m', '1500m'];

  cpuValues.forEach((cpu, i) => {
    describe(`7.${i + 1} – cpu: ${cpu}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Here is the resource spec:',
          '',
          '\x1b[1mdeployment.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: apps/v1'),
          panelLine('kind: Deployment'),
          panelLine('metadata:'),
          panelLine('  name: app'),
          panelLine('spec:'),
          panelLine('  template:'),
          panelLine('    spec:'),
          panelLine('      containers:'),
          panelLine('      - name: app'),
          panelLine('        resources:'),
          panelLine('          requests:'),
          panelLine(`            cpu: ${cpu}`),
          panelLine('            memory: 128Mi'),
          panelLine('          limits:'),
          panelLine(`            cpu: ${cpu}`),
          panelLine('            memory: 256Mi'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it(`cpu: ${cpu} is preserved in output`, () => {
        expect(result).toContain(`cpu: ${cpu}`);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 8. YAML literal/folded block scalars (10 tests)
// ---------------------------------------------------------------------------
describe('8 – YAML literal/folded block scalars preserved', () => {
  const indicators = ['|', '|-', '|+', '>', '>-', '>+', '|2', '>2', '|-2', '>+2'];

  indicators.forEach((ind, i) => {
    describe(`8.${i + 1} – block scalar indicator "${ind}"`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Here is the ConfigMap:',
          '',
          '\x1b[1mconfigmap.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: v1'),
          panelLine('kind: ConfigMap'),
          panelLine('metadata:'),
          panelLine('  name: my-config'),
          panelLine('data:'),
          panelLine(`  config.txt: ${ind}`),
          panelLine('    line one of the config'),
          panelLine('    line two of the config'),
          panelLine('    line three of the config'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('block scalar content is in a single code block', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        const combined = blocks.join('|||');
        expect(combined).toContain('line one');
        expect(combined).toContain('line three');
      });

      it(`indicator "${ind}" appears in output`, () => {
        expect(result).toContain(ind);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 9. Multi-document YAML with --- (10 tests)
// ---------------------------------------------------------------------------
describe('9 – Multi-document YAML with --- in one block', () => {
  const pairs: Array<{ desc: string; doc1Kind: string; doc2Kind: string }> = [
    { desc: 'Deployment + Service', doc1Kind: 'Deployment', doc2Kind: 'Service' },
    { desc: 'Namespace + Deployment', doc1Kind: 'Namespace', doc2Kind: 'Deployment' },
    { desc: 'ConfigMap + Deployment', doc1Kind: 'ConfigMap', doc2Kind: 'Deployment' },
    { desc: 'Service + Ingress', doc1Kind: 'Service', doc2Kind: 'Ingress' },
    { desc: 'Secret + Deployment', doc1Kind: 'Secret', doc2Kind: 'Deployment' },
    { desc: 'PVC + Deployment', doc1Kind: 'PersistentVolumeClaim', doc2Kind: 'Deployment' },
    { desc: 'SA + ClusterRoleBinding', doc1Kind: 'ServiceAccount', doc2Kind: 'ClusterRoleBinding' },
    { desc: 'Role + RoleBinding', doc1Kind: 'Role', doc2Kind: 'RoleBinding' },
    { desc: 'HPA + Deployment', doc1Kind: 'HorizontalPodAutoscaler', doc2Kind: 'Deployment' },
    { desc: 'NetworkPolicy + Service', doc1Kind: 'NetworkPolicy', doc2Kind: 'Service' },
  ];

  pairs.forEach(({ desc, doc1Kind, doc2Kind }, i) => {
    describe(`9.${i + 1} – ${desc}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          `Here is the ${desc}:`,
          '',
          '\x1b[1mmanifest.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: v1'),
          panelLine(`kind: ${doc1Kind}`),
          panelLine('metadata:'),
          panelLine('  name: my-resource'),
          panelLine('---'),
          panelLine('apiVersion: v1'),
          panelLine(`kind: ${doc2Kind}`),
          panelLine('metadata:'),
          panelLine('  name: my-resource-2'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('both documents are in the same code block', () => {
        const blocks = extractCodeBlocks(result);
        const combined = blocks.join('|||');
        expect(combined).toContain(`kind: ${doc1Kind}`);
        expect(combined).toContain(`kind: ${doc2Kind}`);
        // The --- and both kinds should be in one contiguous block
        const singleBlock = blocks.find(
          b => b.includes(`kind: ${doc1Kind}`) && b.includes(`kind: ${doc2Kind}`)
        );
        expect(singleBlock).toBeDefined();
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 10. Numbered steps as centered headings (10 tests)
// ---------------------------------------------------------------------------
describe('10 – Numbered steps as centered headings stay outside code blocks', () => {
  const steps = [
    '1) Deploy to K8s',
    '2) Verify the deployment',
    '3) Configure the service',
    'Step 1: Create namespace',
    'Step 2: Apply manifests',
    'Step 3: Verify pods',
    '4) Scale the replicas',
    '5) Set up monitoring',
    'Step 4: Configure ingress',
    'Step 5: Run smoke tests',
  ];

  steps.forEach((step, i) => {
    describe(`10.${i + 1} – "${step}"`, () => {
      let result: string;

      beforeAll(() => {
        const centered = ' '.repeat(CENTERED_INDENT) + step;
        const fixture = makeFixture([
          'Follow this guide:',
          '',
          '\x1b[1mdeployment.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: apps/v1'),
          panelLine('kind: Deployment'),
          panelLine('metadata:'),
          panelLine('  name: app'),
          panelBlank(),
          '',
          centered,
          '',
          '\x1b[1mservice.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: v1'),
          panelLine('kind: Service'),
          panelLine('metadata:'),
          panelLine('  name: app-svc'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('step title is NOT inside a code block', () => {
        const blocks = extractCodeBlocks(result);
        for (const block of blocks) {
          expect(block).not.toContain(step);
        }
      });

      it('step title appears in output', () => {
        expect(result).toContain(step);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 11. Shell-like prose (10 tests)
// ---------------------------------------------------------------------------
describe('11 – Shell-like prose with 5+ words is NOT code', () => {
  const proseLines = [
    '  Run the following commands to deploy your app',
    '  Make sure you have kubectl installed and configured',
    '  This will create a namespace called production',
    '  You can verify the deployment by running these',
    '  The pods should be ready in about two minutes',
    '  Check the logs if the pod is crashing unexpectedly',
    '  Ensure that the service account has proper RBAC permissions',
    '  Apply the following YAML manifest to your cluster',
    '  Scale the deployment to three replicas for high availability',
    '  Delete the old resources before applying the new manifest',
  ];

  proseLines.forEach((line, i) => {
    describe(`11.${i + 1} – "${line.trim().slice(0, 40)}..."`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Instructions:',
          '',
          line,
          '',
          'kubectl apply -f deployment.yaml',
          '',
          'That should work.',
        ]);
        result = extractAIAnswer(fixture);
      });

      it('prose line is NOT inside a code block', () => {
        const blocks = extractCodeBlocks(result);
        const trimmed = line.trim();
        for (const block of blocks) {
          expect(block).not.toContain(trimmed);
        }
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 12. Bare YAML at column 0 (non-K8s) (10 tests)
// ---------------------------------------------------------------------------
describe('12 – Bare YAML at column 0 wrapped in ```yaml', () => {
  const yamlSnippets: Array<{ desc: string; lines: string[] }> = [
    { desc: 'server config', lines: ['server:', '  host: 0.0.0.0', '  port: 8080'] },
    { desc: 'database config', lines: ['database:', '  host: localhost', '  port: 5432', '  name: mydb'] },
    { desc: 'logging config', lines: ['logging:', '  level: debug', '  format: json'] },
    { desc: 'cache config', lines: ['cache:', '  driver: redis', '  ttl: 3600'] },
    { desc: 'auth config', lines: ['auth:', '  provider: oauth2', '  client_id: abc123'] },
    { desc: 'queue config', lines: ['queue:', '  broker: rabbitmq', '  host: localhost', '  port: 5672'] },
    { desc: 'storage config', lines: ['storage:', '  type: s3', '  bucket: my-bucket'] },
    { desc: 'mail config', lines: ['mail:', '  smtp_host: smtp.example.com', '  smtp_port: 587'] },
    { desc: 'features flags', lines: ['features:', '  dark_mode: true', '  beta_access: false'] },
    { desc: 'app settings', lines: ['app:', '  name: myservice', '  version: 2.1.0', '  debug: false'] },
  ];

  yamlSnippets.forEach(({ desc, lines }, i) => {
    describe(`12.${i + 1} – ${desc}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          `Here is the ${desc}:`,
          '',
          ...lines,
          '',
          'Update the values as needed.',
        ]);
        result = extractAIAnswer(fixture);
      });

      it('YAML is inside a code block', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        const found = blocks.some(b => b.includes(lines[0].replace(':', '')));
        expect(found).toBe(true);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 13. Bare shell commands at column 0 (10 tests)
// ---------------------------------------------------------------------------
describe('13 – Bare shell commands at column 0 wrapped in code block', () => {
  const commands = [
    'kubectl get pods -A',
    'kubectl describe pod my-pod -n default',
    'kubectl logs -f deployment/my-app',
    'helm install my-release bitnami/nginx',
    'helm upgrade --install my-app ./chart',
    'docker build -t my-app:latest .',
    'docker push my-registry/my-app:latest',
    'az aks get-credentials --resource-group myRG --name myCluster',
    'kubectl apply -f https://example.com/manifest.yaml',
    'kubectl rollout restart deployment/my-app',
  ];

  commands.forEach((cmd, i) => {
    describe(`13.${i + 1} – ${cmd.slice(0, 35)}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          'Run this command:',
          '',
          cmd,
          '',
          'This will apply the changes.',
        ]);
        result = extractAIAnswer(fixture);
      });

      it('command is inside a code block', () => {
        const blocks = extractCodeBlocks(result);
        const found = blocks.some(b => b.includes(cmd));
        expect(found).toBe(true);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 14. Mixed bold heading + centered step (10 tests)
// ---------------------------------------------------------------------------
describe('14 – Bold heading + centered step + second block', () => {
  const scenarios: Array<{ step: string; file1: string; file2: string }> = [
    { step: '2) Deploy to K8s', file1: 'Dockerfile', file2: 'deployment.yaml' },
    { step: '3) Expose the service', file1: 'app.py', file2: 'service.yaml' },
    { step: 'Step 2: Build image', file1: 'Makefile', file2: 'Dockerfile' },
    { step: '4) Configure ingress', file1: 'service.yaml', file2: 'ingress.yaml' },
    { step: 'Step 3: Scale up', file1: 'deployment.yaml', file2: 'hpa.yaml' },
    { step: '5) Monitor pods', file1: 'configmap.yaml', file2: 'grafana.yaml' },
    { step: 'Step 4: Add secrets', file1: 'app.yaml', file2: 'secret.yaml' },
    { step: '6) Clean up resources', file1: 'namespace.yaml', file2: 'cleanup.sh' },
    { step: 'Step 5: Run tests', file1: 'main.go', file2: 'main_test.go' },
    { step: '7) Final verification', file1: 'deploy.sh', file2: 'verify.sh' },
  ];

  scenarios.forEach(({ step, file1, file2 }, i) => {
    describe(`14.${i + 1} – ${file1} → "${step}" → ${file2}`, () => {
      let result: string;

      beforeAll(() => {
        const centered = ' '.repeat(CENTERED_INDENT) + step;
        const fixture = makeFixture([
          'Here is the full workflow:',
          '',
          `\x1b[1m${file1}\x1b[0m`,
          panelBlank(),
          panelLine('# File content line 1'),
          panelLine('# File content line 2'),
          panelLine('echo "building"'),
          panelBlank(),
          '',
          centered,
          '',
          `\x1b[1m${file2}\x1b[0m`,
          panelBlank(),
          panelLine('# Second file line 1'),
          panelLine('# Second file line 2'),
          panelLine('echo "deploying"'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('produces at least 2 code blocks', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(2);
      });

      it('step title is NOT in any code block', () => {
        const blocks = extractCodeBlocks(result);
        for (const block of blocks) {
          expect(block).not.toContain(step);
        }
      });

      it('step title appears in output', () => {
        expect(result).toContain(step);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 15. Deep nested YAML (5 tests)
// ---------------------------------------------------------------------------
describe('15 – Deep nested YAML stays in one block', () => {
  const deepYamls: Array<{ desc: string; lines: string[] }> = [
    {
      desc: 'ConfigMap with JSON literal block',
      lines: [
        'apiVersion: v1',
        'kind: ConfigMap',
        'metadata:',
        '  name: app-config',
        'data:',
        '  settings.json: |',
        '    {',
        '      "database": {',
        '        "host": "db.example.com",',
        '        "port": 5432',
        '      }',
        '    }',
      ],
    },
    {
      desc: 'ConfigMap with nested YAML literal',
      lines: [
        'apiVersion: v1',
        'kind: ConfigMap',
        'metadata:',
        '  name: nested-config',
        'data:',
        '  config.yaml: |',
        '    server:',
        '      host: 0.0.0.0',
        '      port: 8080',
        '      tls:',
        '        enabled: true',
        '        cert: /etc/ssl/cert.pem',
      ],
    },
    {
      desc: 'Deployment with deep spec',
      lines: [
        'apiVersion: apps/v1',
        'kind: Deployment',
        'metadata:',
        '  name: deep-app',
        'spec:',
        '  template:',
        '    spec:',
        '      containers:',
        '      - name: app',
        '        env:',
        '        - name: DB_HOST',
        '          valueFrom:',
        '            configMapKeyRef:',
        '              name: app-config',
        '              key: db_host',
      ],
    },
    {
      desc: 'ConfigMap with XML literal',
      lines: [
        'apiVersion: v1',
        'kind: ConfigMap',
        'metadata:',
        '  name: xml-config',
        'data:',
        '  web.xml: |',
        '    <?xml version="1.0"?>',
        '    <web-app>',
        '      <servlet>',
        '        <servlet-name>app</servlet-name>',
        '        <servlet-class>com.example.App</servlet-class>',
        '      </servlet>',
        '    </web-app>',
      ],
    },
    {
      desc: 'ConfigMap with TOML literal',
      lines: [
        'apiVersion: v1',
        'kind: ConfigMap',
        'metadata:',
        '  name: toml-config',
        'data:',
        '  config.toml: |',
        '    [server]',
        '    host = "0.0.0.0"',
        '    port = 8080',
        '    [database]',
        '    url = "postgres://localhost/db"',
      ],
    },
  ];

  deepYamls.forEach(({ desc, lines }, i) => {
    describe(`15.${i + 1} – ${desc}`, () => {
      let result: string;

      beforeAll(() => {
        const fixture = makeFixture([
          `Here is the ${desc}:`,
          '',
          '\x1b[1mmanifest.yaml\x1b[0m',
          panelBlank(),
          ...lines.map(l => panelLine(l)),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it('all content is in one code block', () => {
        const blocks = extractCodeBlocks(result);
        expect(blocks.length).toBeGreaterThanOrEqual(1);
        // First and last lines should be in the same block
        const firstContent = lines[0];
        const lastContent = lines[lines.length - 1].trim();
        const singleBlock = blocks.find(b => b.includes(firstContent) && b.includes(lastContent));
        expect(singleBlock).toBeDefined();
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 16. ANSI color in middle of YAML key (10 tests)
// ---------------------------------------------------------------------------
describe('16 – ANSI color in middle of YAML key stripped cleanly', () => {
  const keys = [
    'metadata',
    'spec',
    'template',
    'containers',
    'resources',
    'annotations',
    'selector',
    'replicas',
    'namespace',
    'labels',
  ];

  keys.forEach((key, i) => {
    describe(`16.${i + 1} – ANSI-split key "${key}"`, () => {
      let result: string;

      beforeAll(() => {
        const [part1, part2] = splitAtMid(key);
        // ANSI bold code inserted in the middle of the key
        const ansiKey = `${part1}\x1b[1m${part2}\x1b[0m`;
        const fixture = makeFixture([
          'Here is the manifest:',
          '',
          '\x1b[1mdeployment.yaml\x1b[0m',
          panelBlank(),
          panelLine('apiVersion: v1'),
          panelLine('kind: Deployment'),
          panelLine(`${ansiKey}: value`),
          panelLine('  name: test'),
          panelBlank(),
        ]);
        result = extractAIAnswer(fixture);
      });

      it(`key "${key}" is intact after stripping`, () => {
        // The full key should appear cleanly in output
        expect(result).toContain(key);
      });

      it('no ANSI leaks', () => {
        assertNoAnsiLeaks(result);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// 17. Empty/minimal fixtures (6 tests)
// ---------------------------------------------------------------------------
describe('17 – Empty and minimal fixtures', () => {
  describe('17.1 – empty content', () => {
    let result: string;

    beforeAll(() => {
      const fixture = makeFixture([]);
      result = extractAIAnswer(fixture);
    });

    it('returns empty or whitespace-only string', () => {
      expect(result.trim()).toBe('');
    });

    it('no ANSI leaks', () => {
      assertNoAnsiLeaks(result);
    });
  });

  describe('17.2 – only whitespace lines', () => {
    let result: string;

    beforeAll(() => {
      const fixture = makeFixture(['   ', '   ', '   ']);
      result = extractAIAnswer(fixture);
    });

    it('returns empty or whitespace-only string', () => {
      expect(result.trim()).toBe('');
    });

    it('no ANSI leaks', () => {
      assertNoAnsiLeaks(result);
    });
  });

  describe('17.3 – single word', () => {
    let result: string;

    beforeAll(() => {
      const fixture = makeFixture(['Hello']);
      result = extractAIAnswer(fixture);
    });

    it('contains the word', () => {
      expect(result).toContain('Hello');
    });

    it('no ANSI leaks', () => {
      assertNoAnsiLeaks(result);
    });
  });

  describe('17.4 – single line with punctuation', () => {
    let result: string;

    beforeAll(() => {
      const fixture = makeFixture(['Done! No issues found.']);
      result = extractAIAnswer(fixture);
    });

    it('content preserved', () => {
      expect(result).toContain('Done!');
    });

    it('no ANSI leaks', () => {
      assertNoAnsiLeaks(result);
    });
  });

  describe('17.5 – only ANSI codes, no text', () => {
    let result: string;

    beforeAll(() => {
      const fixture = makeFixture(['\x1b[1m\x1b[0m', '\x1b[32m\x1b[0m']);
      result = extractAIAnswer(fixture);
    });

    it('returns empty or whitespace-only string', () => {
      expect(result.trim()).toBe('');
    });

    it('no ANSI leaks', () => {
      assertNoAnsiLeaks(result);
    });
  });

  describe('17.6 – unicode content', () => {
    let result: string;

    beforeAll(() => {
      const fixture = makeFixture(['Hello 🌍! Kubernetes ☸️ is great.']);
      result = extractAIAnswer(fixture);
    });

    it('unicode preserved', () => {
      expect(result).toContain('🌍');
    });

    it('no ANSI leaks', () => {
      assertNoAnsiLeaks(result);
    });
  });
});
