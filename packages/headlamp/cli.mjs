#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

export const packageDirectory = path.dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = path.resolve(packageDirectory, '..', '..');
export const defaultWorkspace = path.join(repositoryRoot, 'headlamp');
const lockPath = path.join(repositoryRoot, 'build', 'headlamp-lock.json');
const generatedManifestPath = path.join(defaultWorkspace, '.aks-desktop', 'product-manifest.json');
const markerName = '.aks-desktop-headlamp.json';

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function sha256(file) {
  const hash = createHash('sha256');
  hash.update(readFileSync(file));
  return hash.digest('hex');
}

export function patchSetDigest(lock, root = repositoryRoot) {
  const hash = createHash('sha256');
  for (const patch of lock.patches) {
    hash.update(patch);
    hash.update('\0');
    hash.update(readFileSync(path.join(root, patch)));
  }
  return hash.digest('hex');
}

export function validateArchiveEntries(entries) {
  for (const entry of entries) {
    if (!entry || path.posix.isAbsolute(entry) || entry.includes('\\')) {
      throw new Error(`Unsafe source archive entry: ${entry}`);
    }
    const parts = entry.split('/');
    if (parts.includes('..') || parts[0] === '.') {
      throw new Error(`Unsafe source archive entry: ${entry}`);
    }
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe', ...options });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(`${command} ${args.join(' ')} failed${output ? `:\n${output}` : ''}`);
  }
  return result.stdout;
}

async function download(url, destination) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Could not download ${url}: HTTP ${response.status}`);
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  try {
    await finished(Readable.fromWeb(response.body).pipe(createWriteStream(temporary)));
    renameSync(temporary, destination);
  } finally {
    rmSync(temporary, { force: true });
  }
}

async function sourceArchive(lock, archiveOverride) {
  const archive =
    archiveOverride ||
    process.env.HEADLAMP_SOURCE_ARCHIVE ||
    path.join(
      process.env.HEADLAMP_CACHE_DIR || path.join(homedir(), '.cache', 'aks-desktop'),
      `headlamp-${lock.source.commit}.tar.gz`
    );
  if (!existsSync(archive)) {
    await download(lock.source.archive, archive);
  }
  const actualDigest = sha256(archive);
  if (actualDigest !== lock.source.sha256) {
    throw new Error(`Headlamp archive digest mismatch: expected ${lock.source.sha256}, got ${actualDigest}`);
  }
  return archive;
}

function readMarker(workspace) {
  const markerPath = path.join(workspace, markerName);
  return existsSync(markerPath) ? readJson(markerPath) : undefined;
}

export function verifyWorkspace(workspace = defaultWorkspace) {
  const lock = readJson(lockPath);
  const actualPatchDigest = patchSetDigest(lock);
  if (actualPatchDigest !== lock.patchSetSha256) {
    throw new Error(
      `Headlamp patch-set digest mismatch: expected ${lock.patchSetSha256}, got ${actualPatchDigest}`
    );
  }
  const marker = readMarker(workspace);
  if (
    marker?.sourceCommit !== lock.source.commit ||
    marker?.sourceSha256 !== lock.source.sha256 ||
    marker?.patchSetSha256 !== lock.patchSetSha256
  ) {
    throw new Error(`Headlamp workspace ${workspace} is absent or does not match build/headlamp-lock.json`);
  }
  return { lock, marker };
}

export async function materialize({
  workspace = defaultWorkspace,
  archive: archiveOverride,
  force = false,
} = {}) {
  const lock = readJson(lockPath);
  const actualPatchDigest = patchSetDigest(lock);
  if (actualPatchDigest !== lock.patchSetSha256) {
    throw new Error(
      `Headlamp patch-set digest mismatch: expected ${lock.patchSetSha256}, got ${actualPatchDigest}`
    );
  }
  if (!force && existsSync(workspace)) {
    try {
      verifyWorkspace(workspace);
      console.log(`Headlamp ${lock.source.commit.slice(0, 12)} is already materialized.`);
      return workspace;
    } catch {
      if (readdirSync(workspace).length > 0) {
        throw new Error(`Refusing to replace non-managed Headlamp workspace ${workspace}; use --force`);
      }
    }
  }

  const archive = await sourceArchive(lock, archiveOverride);
  const entries = run('tar', ['-tzf', archive]).split(/\r?\n/).filter(Boolean);
  validateArchiveEntries(entries);
  const staging = `${workspace}.staging-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });
  try {
    run('tar', ['-xzf', archive, '--strip-components=1', '-C', staging]);
    for (const patch of lock.patches) {
      const patchFile = path.join(repositoryRoot, patch);
      const gitOptions = {
        cwd: staging,
        env: { ...process.env, GIT_CEILING_DIRECTORIES: repositoryRoot },
      };
      if (!run('git', ['apply', '--stat', patchFile], gitOptions).trim()) {
        throw new Error(`Patch has no changes in the isolated workspace: ${patch}`);
      }
      run('git', ['apply', '--check', patchFile], gitOptions);
      run('git', ['apply', patchFile], gitOptions);
    }
    writeFileSync(
      path.join(staging, markerName),
      `${JSON.stringify(
        {
          package: '@aks-desktop/headlamp',
          sourceCommit: lock.source.commit,
          sourceSha256: lock.source.sha256,
          patchSetSha256: lock.patchSetSha256,
          patches: lock.patches.length,
        },
        null,
        2
      )}\n`
    );
    rmSync(workspace, { recursive: true, force: true });
    renameSync(staging, workspace);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
  console.log(`Materialized Headlamp ${lock.source.commit.slice(0, 12)} with ${lock.patches.length} patches.`);
  return workspace;
}

function platformName() {
  return { darwin: 'darwin', linux: 'linux', win32: 'win32' }[process.platform];
}

function relativeFromManifest(file) {
  return path.relative(path.dirname(generatedManifestPath), file).split(path.sep).join('/');
}

function toolRecord(id, file, packagedPath, verificationPath = packagedPath) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    throw new Error(`Required bundled tool is missing: ${file}`);
  }
  return {
    id,
    platforms: {
      [platformName()]: {
        path: packagedPath,
        sha256: sha256(file),
      },
    },
    packagedPath,
    verificationPath,
  };
}

export function generateManifest() {
  verifyWorkspace();
  const template = readJson(path.join(repositoryRoot, 'build', 'product-manifest.json'));
  const platform = platformName();
  if (!platform) {
    throw new Error(`Unsupported build platform: ${process.platform}`);
  }
  const externalTools = path.join(defaultWorkspace, 'app', 'resources', 'external-tools');
  const azName = process.platform === 'win32' ? 'az.cmd' : 'az';
  const tools = [
    toolRecord(
      'az',
      path.join(externalTools, 'az-cli', platform, 'bin', azName),
      `external-tools/az-cli/${platform}/bin/${azName}`,
      `external-tools/az-cli/${platform}/bin/${
        process.platform === 'win32' ? azName : 'az-wrapper'
      }`
    ),
    toolRecord(
      'az-kubelogin',
      path.join(externalTools, 'bin', 'az-kubelogin.py'),
      'external-tools/bin/az-kubelogin.py'
    ),
  ];
  template['external-tools'] = tools.map(
    ({ packagedPath, verificationPath, ...tool }) => tool
  );
  template.resources = {
    common: [
      { from: relativeFromManifest(externalTools), to: 'external-tools' },
      { from: '../../LICENSE.txt', to: 'AKS_DESKTOP_LICENSE.txt' },
      { from: '../../NOTICE.md', to: 'AKS_DESKTOP_NOTICE.md' },
    ],
  };
  template.verify = tools.map(tool => ({
    path: tool.verificationPath,
    sha256: tool.platforms[platform].sha256,
    platforms: [{ darwin: 'mac', win32: 'win' }[platform] || platform],
  }));
  mkdirSync(path.dirname(generatedManifestPath), { recursive: true });
  writeFileSync(generatedManifestPath, `${JSON.stringify(template, null, 2)}\n`);
  console.log(`Generated ${generatedManifestPath}`);
}

function make(target) {
  verifyWorkspace();
  if (!existsSync(generatedManifestPath)) {
    throw new Error('Run npm run headlamp:manifest after staging plugins and external tools');
  }
  const child = spawn(process.platform === 'win32' ? 'make.exe' : 'make', [target], {
    cwd: defaultWorkspace,
    env: { ...process.env, HEADLAMP_BUILD_MANIFEST: generatedManifestPath },
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
}

function descendantProcessIds(rootPid) {
  const result = spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
  if (result.status !== 0) return [];
  const children = new Map();
  for (const line of result.stdout.trim().split(/\r?\n/)) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    children.set(parent, [...(children.get(parent) || []), pid]);
  }
  const descendants = [];
  const visit = pid => {
    for (const child of children.get(pid) || []) {
      visit(child);
      descendants.push(child);
    }
  };
  visit(rootPid);
  return descendants;
}

async function terminateProcessTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    const processIds = [...descendantProcessIds(child.pid), child.pid];
    for (const pid of processIds) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    for (const pid of processIds) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }
  child.stdout.destroy();
  child.stderr.destroy();
  child.unref();
}

export async function smoke({
  executable,
  port = 4466,
  timeout = 30_000,
  disableSandbox = false,
} = {}) {
  if (!executable) {
    throw new Error('Pass a packaged executable with --executable');
  }
  const args = ['--headless', '--disable-gpu', '--port', String(port)];
  if (disableSandbox) {
    args.unshift('--no-sandbox');
  }
  const child = spawn(executable, args, {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => (output += chunk));
  child.stderr.on('data', chunk => (output += chunk));
  try {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) {
        throw new Error(`AKS Desktop exited before becoming ready:\n${output}`);
      }
      try {
        const response = await fetch(`http://127.0.0.1:${port}`);
        if (response.ok && (await response.text()).includes('<html')) {
          console.log(`AKS Desktop runtime smoke check passed on port ${port}.`);
          return;
        }
      } catch {
        // The server is still starting.
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`AKS Desktop did not become ready within ${timeout}ms:\n${output}`);
  } finally {
    await terminateProcessTree(child);
  }
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(args) {
  const [command, ...rest] = args;
  if (command === 'prepare') {
    await materialize({
      archive: option(rest, '--archive'),
      force: rest.includes('--force'),
    });
  } else if (command === 'verify-patches') {
    const workspace = path.join(tmpdir(), `aks-headlamp-verify-${process.pid}`);
    try {
      await materialize({ workspace, archive: option(rest, '--archive'), force: true });
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  } else if (command === 'manifest') {
    generateManifest();
  } else if (command === 'doctor') {
    const { lock } = verifyWorkspace();
    if (!existsSync(generatedManifestPath)) {
      throw new Error(`Generated product manifest is missing: ${generatedManifestPath}`);
    }
    console.log(`Headlamp source, ${lock.patches.length} patches, and product manifest are consistent.`);
  } else if (command === 'make') {
    make(rest[0]);
  } else if (command === 'smoke') {
    await smoke({
      executable: option(rest, '--executable'),
      port: Number(option(rest, '--port') || 4466),
      timeout: Number(option(rest, '--timeout') || 30_000),
      disableSandbox: rest.includes('--no-sandbox'),
    });
  } else {
    console.error(
      'Usage: aks-headlamp <prepare|verify-patches|manifest|doctor|make TARGET|smoke --executable PATH [--no-sandbox]>'
    );
    process.exitCode = 2;
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === realpathSync(process.argv[1])
) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
