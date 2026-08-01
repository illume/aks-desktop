import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, test } from 'node:test';

import {
  headlampSourceVersion,
  updateHeadlampSource,
} from './package-headlamp-source';

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs
    .splice(0)
    .forEach(directory =>
      fs.rmSync(directory, { recursive: true, force: true })
    );
});

function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function createSourceCheckout() {
  const sourceDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'headlamp-checkout-')
  );
  tempDirs.push(sourceDir);
  run('git', ['init', '-q', '-b', 'main'], sourceDir);
  run('git', ['config', 'user.name', 'Headlamp test'], sourceDir);
  run('git', ['config', 'user.email', 'headlamp@example.invalid'], sourceDir);
  for (const directory of ['app', 'backend', 'frontend']) {
    fs.mkdirSync(path.join(sourceDir, directory));
    fs.writeFileSync(path.join(sourceDir, directory, '.keep'), '');
  }
  for (const [file, contents] of [
    ['package.json', '{"name":"headlamp-root","private":true}\n'],
    ['LICENSE', 'license\n'],
    ['README.md', 'readme\n'],
    ['Dockerfile', 'FROM scratch\n'],
  ]) {
    fs.writeFileSync(path.join(sourceDir, file), contents);
  }
  run('git', ['add', '.'], sourceDir);
  run('git', ['commit', '-qm', 'source'], sourceDir);
  fs.writeFileSync(path.join(sourceDir, 'untracked.txt'), 'exclude me');
  return {
    commit: run('git', ['rev-parse', 'HEAD'], sourceDir),
    sourceDir,
  };
}

function createProject(commit: string) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-project-'));
  tempDirs.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'build', 'patches'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'packages'));
  const version = `0.44.0-main.${commit.slice(0, 8)}`;
  const patchPath = `build/patches/headlamp-source@${version}.patch`;
  fs.writeFileSync(path.join(rootDir, patchPath), 'patch\n');
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    `${JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        private: true,
        headlampSource: {
          repository: 'https://github.com/kubernetes-sigs/headlamp.git',
          ref: 'refs/heads/main',
          baseTag: 'v0.44.0',
          commit,
        },
        devDependencies: { '@headlamp-k8s/headlamp-source': version },
        patchedDependencies: {
          [`@headlamp-k8s/headlamp-source@${version}`]: patchPath,
        },
      },
      null,
      2
    )}\n`
  );
  fs.writeFileSync(
    path.join(rootDir, 'package-lock.json'),
    `${JSON.stringify(
      {
        name: 'test-project',
        version: '1.0.0',
        lockfileVersion: 4,
        requires: true,
        packages: {
          '': {
            name: 'test-project',
            version: '1.0.0',
            devDependencies: { '@headlamp-k8s/headlamp-source': version },
          },
          'node_modules/@headlamp-k8s/headlamp-source': {},
        },
      },
      null,
      2
    )}\n`
  );
  return rootDir;
}

test('packages a clean exact Headlamp commit and updates the npm contract', () => {
  const { commit, sourceDir } = createSourceCheckout();
  const rootDir = createProject(commit);

  run('git', ['commit', '--allow-empty', '-qm', 'next source'], sourceDir);
  const actualNextCommit = run('git', ['rev-parse', 'HEAD'], sourceDir);
  assert.notEqual(actualNextCommit, commit);

  const result = updateHeadlampSource({
    rootDir,
    sourceDir,
    commit: actualNextCommit,
  });
  const project = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8')
  );
  const packageLock = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8')
  );
  const version = headlampSourceVersion(project.headlampSource);
  const selector = `@headlamp-k8s/headlamp-source@${version}`;

  assert.equal(project.headlampSource.commit, actualNextCommit);
  assert.equal(
    project.devDependencies['@headlamp-k8s/headlamp-source'],
    version
  );
  assert.equal(
    project.patchedDependencies[selector],
    `build/patches/headlamp-source@${version}.patch`
  );
  assert.equal(fs.existsSync(result.artifactPath), true);
  assert.match(
    packageLock.packages['node_modules/@headlamp-k8s/headlamp-source']
      .integrity,
    /^sha512-/
  );
  assert.match(
    packageLock.packages['node_modules/@headlamp-k8s/headlamp-source'].patched
      .integrity,
    /^sha512-/
  );

  const inspectDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'headlamp-inspect-')
  );
  tempDirs.push(inspectDir);
  fs.writeFileSync(
    path.join(inspectDir, 'package.json'),
    '{"name":"inspect","version":"1.0.0","private":true}\n'
  );
  run(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['install', '--ignore-scripts', '--no-package-lock', result.artifactPath],
    inspectDir
  );
  const installed = path.join(
    inspectDir,
    'node_modules',
    '@headlamp-k8s',
    'headlamp-source'
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(installed, 'package.json'), 'utf8')
  );
  assert.equal(manifest.version, version);
  assert.equal(manifest.headlampSource.commit, actualNextCommit);
  assert.equal(
    fs.existsSync(path.join(installed, 'source', 'Dockerfile')),
    true
  );
  assert.equal(
    fs.existsSync(path.join(installed, 'source', 'untracked.txt')),
    false
  );
  assert.deepEqual(manifest.files, ['source']);

  const firstPatchIntegrity =
    packageLock.packages['node_modules/@headlamp-k8s/headlamp-source'].patched
      .integrity;
  fs.appendFileSync(result.patchPath, 'updated patch\n');
  updateHeadlampSource({
    rootDir,
    sourceDir,
  });
  const updatedLock = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8')
  );
  assert.notEqual(
    updatedLock.packages['node_modules/@headlamp-k8s/headlamp-source'].patched
      .integrity,
    firstPatchIntegrity
  );
});

test('rejects a source checkout that does not match the configured commit', () => {
  const { commit, sourceDir } = createSourceCheckout();
  const rootDir = createProject(commit);
  assert.throws(
    () =>
      updateHeadlampSource({
        rootDir,
        sourceDir,
        commit: `a${commit.slice(1)}`,
      }),
    /does not match/
  );
});
