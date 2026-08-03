const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  composePatchSeries,
  materializeHeadlampPatch,
} = require('./compose-patches.ts');

const PACKAGE_NAME: string = '@headlamp-k8s/headlamp-source';
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const BASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;
const SOURCE_MARKER = '.source-commit';
const REQUIRED_SOURCE_PATHS = [
  'package.json',
  'LICENSE',
  'README.md',
  'Dockerfile',
  'app',
  'backend',
  'frontend',
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed${cwd ? ` in ${cwd}` : ''}:\n${
        result.stderr || result.stdout
      }`
    );
  }
  return result.stdout;
}

function sha512(file) {
  return `sha512-${createHash('sha512')
    .update(fs.readFileSync(file))
    .digest('base64')}`;
}

function sourceVersion(config) {
  const tag = BASE_TAG_PATTERN.exec(config.baseTag);
  const commit = config.commit.toLowerCase();
  if (!tag) {
    throw new Error(`Headlamp base tag must look like v0.44.0: ${config.baseTag}`);
  }
  if (!COMMIT_PATTERN.test(commit)) {
    throw new Error(`Headlamp commit must be a full Git SHA: ${config.commit}`);
  }
  return `${tag[1]}-main.${commit.slice(0, 8)}`;
}

function verifySourceCheckout(sourceDir, commit) {
  const actualCommit = run('git', ['rev-parse', 'HEAD'], sourceDir).trim();
  if (actualCommit !== commit) {
    throw new Error(`Headlamp source checkout is at ${actualCommit}, which does not match ${commit}`);
  }
  const changes = run(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    sourceDir
  ).trim();
  if (changes) {
    throw new Error('Headlamp source checkout has tracked changes');
  }
  for (const required of REQUIRED_SOURCE_PATHS) {
    if (!fs.existsSync(path.join(sourceDir, required))) {
      throw new Error(`Headlamp source checkout is missing ${required}`);
    }
  }
}

function validateTrackedSourcePath(relativeFile) {
  const normalizedPath = relativeFile.replaceAll('\\', '/');
  if (
    path.posix.isAbsolute(normalizedPath) ||
    path.win32.isAbsolute(relativeFile) ||
    normalizedPath === '..' ||
    normalizedPath.startsWith('../')
  ) {
    throw new Error(`Unsafe Headlamp source path: ${relativeFile}`);
  }
}

function copyTrackedSource(sourceDir, destination) {
  const files = run('git', ['ls-files', '-z'], sourceDir)
    .split('\0')
    .filter(Boolean);
  for (const relativeFile of files) {
    validateTrackedSourcePath(relativeFile);
    const source = path.join(sourceDir, relativeFile);
    const target = path.join(destination, relativeFile);
    const stat = fs.lstatSync(source);
    if (stat.isDirectory()) {
      throw new Error(`Headlamp source contains an uninitialized submodule: ${relativeFile}`);
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`Headlamp source contains a tracked symbolic link: ${relativeFile}`);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    fs.chmodSync(target, stat.mode);
  }
}

function materializeHeadlampSource(packageDir, sourceDir, commit) {
  const resolvedSourceDir = fs.realpathSync(sourceDir);
  verifySourceCheckout(resolvedSourceDir, commit);
  const temporarySource = fs.mkdtempSync(path.join(packageDir, '.source-'));
  const temporaryMarker = `${temporarySource}.commit`;
  const source = path.join(packageDir, 'source');
  const marker = path.join(packageDir, SOURCE_MARKER);
  let sourceInstalled = false;
  try {
    copyTrackedSource(resolvedSourceDir, temporarySource);
    fs.writeFileSync(temporaryMarker, `${commit}\n`);
    fs.rmSync(source, { recursive: true, force: true });
    fs.renameSync(temporarySource, source);
    sourceInstalled = true;
    fs.rmSync(marker, { recursive: true, force: true });
    fs.renameSync(temporaryMarker, marker);
  } catch (error) {
    fs.rmSync(temporarySource, { recursive: true, force: true });
    fs.rmSync(temporaryMarker, { force: true });
    if (sourceInstalled) {
      fs.rmSync(source, { recursive: true, force: true });
    }
    throw error;
  }
}

function sourceIsMaterialized(packageDir, commit) {
  const marker = path.join(packageDir, SOURCE_MARKER);
  let materializedCommit;
  try {
    materializedCommit = fs.readFileSync(marker, 'utf8').trim();
  } catch {
    return false;
  }
  if (materializedCommit !== commit) {
    return false;
  }
  return REQUIRED_SOURCE_PATHS.every(required =>
    fs.existsSync(path.join(packageDir, 'source', required))
  );
}

function fetchSourceCheckout(repository, commit) {
  const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-checkout-'));
  try {
    run('git', ['init', '--quiet'], checkout);
    run(
      'git',
      ['fetch', '--quiet', '--no-tags', '--filter=blob:none', repository, commit],
      checkout
    );
    run('git', ['checkout', '--quiet', '--detach', 'FETCH_HEAD'], checkout);
    return checkout;
  } catch (error) {
    fs.rmSync(checkout, { recursive: true, force: true });
    throw error;
  }
}

function prepareHeadlampSource(options: any = {}) {
  const rootDir = path.resolve(options.rootDir || process.env.INIT_CWD || process.cwd());
  const packageDir = path.resolve(options.packageDir || path.join(__dirname, '..'));
  const config = readJson(path.join(rootDir, 'package.json')).headlampSource;
  if (!config) {
    throw new Error('package.json must declare headlampSource');
  }
  const packageManifest = readJson(path.join(packageDir, 'package.json'));
  const version = sourceVersion(config);
  if (
    packageManifest.version !== version ||
    packageManifest.repository?.url !== config.repository ||
    packageManifest.repository?.commit !== config.commit
  ) {
    throw new Error(
      'Headlamp source package metadata does not match package.json#headlampSource'
    );
  }
  if (sourceIsMaterialized(packageDir, config.commit)) {
    materializeHeadlampPatch(rootDir);
    console.log(`Headlamp source ${config.commit} is already materialized`);
    return { packageDir, prepared: false };
  }

  const checkout = options.sourceDir
    ? fs.realpathSync(options.sourceDir)
    : fetchSourceCheckout(config.repository, config.commit);
  try {
    materializeHeadlampSource(packageDir, checkout, config.commit);
  } finally {
    if (!options.sourceDir) {
      fs.rmSync(checkout, { recursive: true, force: true });
    }
  }
  materializeHeadlampPatch(rootDir);
  console.log(`Materialized Headlamp source ${config.commit}`);
  return { packageDir, prepared: true };
}

function updatePackageManifest(packageDir, config, version) {
  const manifestPath = path.join(packageDir, 'package.json');
  const manifest = readJson(manifestPath);
  manifest.version = version;
  manifest.repository.url = config.repository;
  manifest.repository.commit = config.commit;
  manifest.headlampSource = {
    ref: config.ref,
    baseTag: config.baseTag,
    commit: config.commit,
  };
  manifest.scripts['build:container'] =
    `docker buildx build --pull --platform=local ` +
    `--build-arg HEADLAMP_SOURCE_COMMIT=${config.commit} ` +
    `--build-arg HEADLAMP_BUILD_MANIFEST ` +
    `-t ghcr.io/headlamp-k8s/headlamp:${version} -f source/Dockerfile source`;
  manifest.scripts['build:plugins-container'] =
    `docker buildx build --pull --platform=local ` +
    `-t ghcr.io/headlamp-k8s/plugins:${version} -f source/Dockerfile.plugins source`;
  writeJson(manifestPath, manifest);
  return manifest;
}

function updateHeadlampSource(options) {
  const rootDir = path.resolve(options.rootDir || process.env.INIT_CWD || process.cwd());
  const packageDir = path.resolve(options.packageDir || path.join(__dirname, '..'));
  const projectPath = path.join(rootDir, 'package.json');
  const lockPath = path.join(rootDir, 'package-lock.json');
  const project = readJson(projectPath);
  const lock = readJson(lockPath);
  const currentConfig = project.headlampSource;
  if (!currentConfig) {
    throw new Error('package.json must declare headlampSource');
  }
  const config = {
    ...currentConfig,
    ...(options.baseTag ? { baseTag: options.baseTag } : {}),
    ...(options.commit ? { commit: options.commit.toLowerCase() } : {}),
  };
  const version = sourceVersion(config);
  const sourceDir = fs.realpathSync(options.sourceDir);
  verifySourceCheckout(sourceDir, config.commit);

  const patchEntries = Object.entries(project.patchedDependencies || {}).filter(([selector]) =>
    selector.startsWith(`${PACKAGE_NAME}@`)
  );
  if (patchEntries.length !== 1) {
    throw new Error(`Expected one ${PACKAGE_NAME} patch, found ${patchEntries.length}`);
  }
  const [oldSelector, oldPatchPath] = patchEntries[0];
  const newSelector = `${PACKAGE_NAME}@${version}`;
  const newPatchPath = `patches/headlamp-source@${version}.patch`;
  const absoluteOldPatch = path.join(rootDir, oldPatchPath);
  const absoluteNewPatch = path.join(rootDir, newPatchPath);

  materializeHeadlampSource(packageDir, sourceDir, config.commit);

  const packageManifest = updatePackageManifest(packageDir, config, version);
  fs.writeFileSync(absoluteNewPatch, composePatchSeries(rootDir, packageDir));
  project.headlampSource = config;
  project.devDependencies[PACKAGE_NAME] = version;
  delete project.patchedDependencies[oldSelector];
  project.patchedDependencies[newSelector] = newPatchPath;

  lock.packages[''].devDependencies[PACKAGE_NAME] = version;
  lock.packages[`node_modules/${PACKAGE_NAME}`] = {
    version,
    resolved: `file:${path.relative(rootDir, packageDir).split(path.sep).join('/')}`,
    dev: true,
    license: packageManifest.license,
    dependencies: packageManifest.dependencies,
    engines: packageManifest.engines,
    patched: {
      integrity: sha512(absoluteNewPatch),
      path: newPatchPath,
    },
  };
  if (oldPatchPath !== newPatchPath) {
    fs.rmSync(absoluteOldPatch, { force: true });
  }

  writeJson(projectPath, project);
  writeJson(lockPath, lock);
  console.log(`Prepared ${PACKAGE_NAME}@${version} from ${config.commit}`);
  console.log(`Run npm ci to apply and validate ${newPatchPath}`);

  return {
    packageDir,
    patchPath: absoluteNewPatch,
    version,
  };
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (require.main === module) {
  const rootDir = argument('--root');
  if (process.argv.includes('--prepare')) {
    prepareHeadlampSource({
      rootDir,
      sourceDir: argument('--source'),
    });
  } else {
    const sourceDir = argument('--source');
    if (!sourceDir) {
      throw new Error(
        'Usage: npm run source:update -- --source <checkout> [--commit <sha>]'
      );
    }
    updateHeadlampSource({
      rootDir,
      sourceDir,
      commit: argument('--commit'),
      baseTag: argument('--base-tag'),
    });
  }
}

module.exports = {
  prepareHeadlampSource,
  sourceVersion,
  updateHeadlampSource,
  validateTrackedSourcePath,
};
