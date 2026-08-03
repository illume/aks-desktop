const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_NAME: string = '@headlamp-k8s/headlamp-source';
const SERIES_ENTRY_PATTERN =
  /^(\d{4}) (source|package) ((\d{4})-[a-z0-9]+(?:-[a-z0-9]+)*\.patch)$/;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha512(value) {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`;
}

function parsePatchSeries(value) {
  const lines = value.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    throw new Error('Headlamp patch series is empty');
  }
  const files = new Set();
  return lines.map((line, index) => {
    const match = SERIES_ENTRY_PATTERN.exec(line);
    const expectedNumber = String(index + 1).padStart(4, '0');
    if (match?.[1] !== expectedNumber || match[4] !== expectedNumber) {
      throw new Error(`Invalid Headlamp patch series entry: ${line}`);
    }
    const [, , scope, file] = match;
    if (files.has(file)) {
      throw new Error(`Duplicate Headlamp patch series entry: ${file}`);
    }
    files.add(file);
    return { file, scope };
  });
}

function runGit(args, options: any = {}) {
  const result = spawnSync('git', args, {
    cwd: options.cwd,
    encoding: options.encoding,
    env: { ...process.env, ...options.env },
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function composePatchSeries(
  rootDir = process.env.INIT_CWD || process.cwd(),
  packageDir = path.join(rootDir, 'packages', 'headlamp-source')
) {
  const patchDir = path.join(rootDir, 'patches');
  const entries = parsePatchSeries(fs.readFileSync(path.join(patchDir, 'series'), 'utf8'));
  if (!fs.existsSync(path.join(packageDir, 'source'))) {
    throw new Error('Headlamp source is not materialized; run source:prepare first');
  }

  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-patches-'));
  const gitConfig = path.join(temporaryDirectory, 'gitconfig');
  const gitDir = path.join(temporaryDirectory, 'repository.git');
  try {
    fs.writeFileSync(gitConfig, '');
    runGit(['init', '--bare', '--quiet', gitDir]);
    const repository = {
      cwd: packageDir,
      env: {
        GIT_CONFIG_GLOBAL: gitConfig,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_DIR: gitDir,
        GIT_WORK_TREE: packageDir,
      },
    };
    runGit(['add', '--all', '--', '.'], repository);
    const baseTree = runGit(['write-tree'], { ...repository, encoding: 'utf8' }).trim();
    for (const entry of entries) {
      const args = ['apply', '--cached', '--whitespace=nowarn'];
      if (entry.scope === 'source') {
        args.push('--directory=source');
      }
      args.push(path.join(patchDir, entry.file));
      runGit(args, repository);
    }
    return runGit(
      [
        '-c',
        'diff.algorithm=myers',
        'diff',
        '--cached',
        '--binary',
        '--full-index',
        '--no-color',
        '--no-ext-diff',
        '--no-renames',
        '--src-prefix=a/',
        '--dst-prefix=b/',
        baseTree,
        '--',
      ],
      repository
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function configuredPatch(rootDir) {
  const manifest = readJson(path.join(rootDir, 'package.json'));
  const entries = Object.entries(manifest.patchedDependencies || {}).filter(([selector]) =>
    selector.startsWith(`${PACKAGE_NAME}@`)
  );
  if (entries.length !== 1) {
    throw new Error(`Expected one ${PACKAGE_NAME} npm patch, found ${entries.length}`);
  }
  const [selector, patchPath] = entries[0];
  if (
    typeof patchPath !== 'string' ||
    path.dirname(patchPath) !== 'patches' ||
    !path.basename(patchPath).startsWith('headlamp-source@')
  ) {
    throw new Error(`Invalid ${PACKAGE_NAME} npm patch path: ${patchPath}`);
  }
  return { patchPath, selector };
}

function patchState(rootDir) {
  const { patchPath } = configuredPatch(rootDir);
  const aggregate = composePatchSeries(rootDir);
  const absolutePatch = path.join(rootDir, patchPath);
  const lockPath = path.join(rootDir, 'package-lock.json');
  const lock = readJson(lockPath);
  const lockEntry = lock.packages[`node_modules/${PACKAGE_NAME}`];
  const integrity = sha512(aggregate);

  if (!lockEntry?.patched) {
    throw new Error(`${PACKAGE_NAME} is not patched in package-lock.json`);
  }
  return { absolutePatch, aggregate, integrity, lock, lockEntry, lockPath, patchPath };
}

function materializeHeadlampPatch(rootDir = process.env.INIT_CWD || process.cwd()) {
  const { absolutePatch, aggregate, integrity, lockEntry, patchPath } = patchState(rootDir);
  if (lockEntry.patched.path !== patchPath || lockEntry.patched.integrity !== integrity) {
    throw new Error('Run npm run headlamp:patches to update the patch lock integrity');
  }
  fs.writeFileSync(absolutePatch, aggregate);
  console.log(`Generated ${patchPath}`);
}

function updateHeadlampPatch(rootDir = process.env.INIT_CWD || process.cwd(), check = false) {
  const { absolutePatch, aggregate, integrity, lock, lockEntry, lockPath, patchPath } =
    patchState(rootDir);
  if (check) {
    if (!fs.existsSync(absolutePatch) || !fs.readFileSync(absolutePatch).equals(aggregate)) {
      throw new Error(`Run npm run headlamp:patches to update ${patchPath}`);
    }
    if (
      lockEntry.patched.path !== patchPath ||
      lockEntry.patched.integrity !== integrity
    ) {
      throw new Error('Run npm run headlamp:patches to update the patch lock integrity');
    }
    return;
  }

  fs.writeFileSync(absolutePatch, aggregate);
  lockEntry.patched = { integrity, path: patchPath };
  writeJson(lockPath, lock);
  console.log(`Composed ${patchPath}`);
}

if (require.main === module) {
  updateHeadlampPatch(undefined, process.argv.includes('--check'));
}

module.exports = {
  composePatchSeries,
  materializeHeadlampPatch,
  parsePatchSeries,
  updateHeadlampPatch,
};
