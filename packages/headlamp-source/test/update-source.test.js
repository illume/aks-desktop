const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');

const {
  sourceVersion,
  updateHeadlampSource,
  validateTrackedSourcePath,
} = require('../scripts/update-source.js');

const tempDirs = [];

afterEach(() => {
  tempDirs.splice(0).forEach(directory =>
    fs.rmSync(directory, { recursive: true, force: true })
  );
});

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function createSourceCheckout() {
  const sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-checkout-'));
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

function createProject(commit) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-project-'));
  tempDirs.push(rootDir);
  const packageDir = path.join(rootDir, 'packages', 'headlamp-source');
  fs.mkdirSync(path.join(packageDir, 'source'), { recursive: true });
  fs.mkdirSync(path.join(rootDir, 'patches'));
  const version = `0.44.0-main.${commit.slice(0, 8)}`;
  const patchPath = `patches/headlamp-source@${version}.patch`;
  fs.writeFileSync(path.join(rootDir, patchPath), 'patch\n');
  fs.writeFileSync(
    path.join(packageDir, 'package.json'),
    `${JSON.stringify(
      {
        name: '@headlamp-k8s/headlamp-source',
        version,
        license: 'Apache-2.0',
        repository: {
          type: 'git',
          url: 'https://github.com/kubernetes-sigs/headlamp.git',
          commit,
        },
        engines: { node: '>=22.22.2', npm: '>=12.0.0' },
        scripts: {
          'build:container': 'old',
          'build:plugins-container': 'old',
        },
        headlampSource: { baseTag: 'v0.44.0', commit },
      },
      null,
      2
    )}\n`
  );
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
  return { packageDir, rootDir };
}

test('updates an unpacked source package from a clean exact commit', () => {
  const { commit, sourceDir } = createSourceCheckout();
  const { packageDir, rootDir } = createProject(commit);
  run('git', ['commit', '--allow-empty', '-qm', 'next source'], sourceDir);
  const nextCommit = run('git', ['rev-parse', 'HEAD'], sourceDir);

  const result = updateHeadlampSource({
    rootDir,
    packageDir,
    sourceDir,
    commit: nextCommit,
  });
  const project = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(rootDir, 'package-lock.json'), 'utf8'));
  const packageManifest = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
  const version = sourceVersion(project.headlampSource);

  assert.equal(result.packageDir, packageDir);
  assert.equal(packageManifest.version, version);
  assert.equal(packageManifest.headlampSource.commit, nextCommit);
  assert.equal(project.devDependencies['@headlamp-k8s/headlamp-source'], version);
  assert.equal(fs.existsSync(path.join(packageDir, 'source', 'Dockerfile')), true);
  assert.equal(fs.existsSync(path.join(packageDir, 'source', 'untracked.txt')), false);
  assert.equal(
    lock.packages['node_modules/@headlamp-k8s/headlamp-source'].resolved,
    'file:packages/headlamp-source'
  );
  assert.equal(
    'integrity' in lock.packages['node_modules/@headlamp-k8s/headlamp-source'],
    false
  );
  assert.match(
    lock.packages['node_modules/@headlamp-k8s/headlamp-source'].patched.integrity,
    /^sha512-/
  );
});

test('rejects a checkout that does not match the configured commit', () => {
  const { commit, sourceDir } = createSourceCheckout();
  const { packageDir, rootDir } = createProject(commit);
  const otherCommit = `${commit.startsWith('a') ? 'b' : 'a'}${commit.slice(1)}`;
  assert.throws(
    () =>
      updateHeadlampSource({
        rootDir,
        packageDir,
        sourceDir,
        commit: otherCommit,
      }),
    /does not match/
  );
});

test('rejects source paths that escape on POSIX or Windows', () => {
  for (const unsafePath of ['../outside', '..\\outside', '/absolute', 'C:\\absolute']) {
    assert.throws(() => validateTrackedSourcePath(unsafePath), /Unsafe Headlamp source path/);
  }
  assert.doesNotThrow(() => validateTrackedSourcePath('frontend/src/index.ts'));
});

test('rejects tracked symbolic links', () => {
  const { sourceDir } = createSourceCheckout();
  fs.symlinkSync('Dockerfile', path.join(sourceDir, 'Dockerfile.link'));
  run('git', ['add', 'Dockerfile.link'], sourceDir);
  run('git', ['commit', '-qm', 'add symlink'], sourceDir);
  const commit = run('git', ['rev-parse', 'HEAD'], sourceDir);
  const { packageDir, rootDir } = createProject(commit);

  assert.throws(
    () => updateHeadlampSource({ rootDir, packageDir, sourceDir }),
    /tracked symbolic link/
  );
});
