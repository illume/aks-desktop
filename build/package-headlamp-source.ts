import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { ROOT_DIR } from './headlamp-path';

const PACKAGE_NAME = '@headlamp-k8s/headlamp-source';
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const BASE_TAG_PATTERN = /^v(\d+\.\d+\.\d+)$/;

export interface HeadlampSourceConfig {
  repository: string;
  ref: string;
  baseTag: string;
  commit: string;
}

interface UpdateOptions {
  rootDir?: string;
  sourceDir: string;
  commit?: string;
  baseTag?: string;
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file: string, value: unknown) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function run(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
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

function sha512(file: string): string {
  return `sha512-${createHash('sha512')
    .update(fs.readFileSync(file))
    .digest('base64')}`;
}

export function headlampSourceVersion(config: HeadlampSourceConfig): string {
  const tag = BASE_TAG_PATTERN.exec(config.baseTag);
  const commit = config.commit.toLowerCase();
  if (!tag) {
    throw new Error(
      `Headlamp base tag must look like v0.44.0: ${config.baseTag}`
    );
  }
  if (!COMMIT_PATTERN.test(commit)) {
    throw new Error(`Headlamp commit must be a full Git SHA: ${config.commit}`);
  }
  return `${tag[1]}-main.${commit.slice(0, 8)}`;
}

function sourcePackageManifest(config: HeadlampSourceConfig) {
  const version = headlampSourceVersion(config);
  return {
    name: PACKAGE_NAME,
    version,
    description: 'Complete Headlamp source and npm build entry points',
    license: 'Apache-2.0',
    repository: {
      type: 'git',
      url: config.repository,
      commit: config.commit,
    },
    engines: {
      node: '>=22.22.2',
      npm: '>=12.0.0',
    },
    files: ['source'],
    scripts: {
      'install:all': 'npm --prefix source run install:all',
      build: 'npm --prefix source run build',
      'build:backend': 'npm --prefix source run backend:build',
      'build:frontend': 'npm --prefix source run frontend:build',
      'build:app': 'npm --prefix source run app:package',
      'build:app:linux': 'npm --prefix source run app:package:linux',
      'build:app:mac': 'npm --prefix source run app:package:mac',
      'build:app:win': 'npm --prefix source run app:package:win',
      'build:app:unpacked': 'npm --prefix source run app:build',
      'build:container': `docker buildx build --pull --platform=local --build-arg HEADLAMP_SOURCE_COMMIT=${config.commit} --build-arg HEADLAMP_BUILD_MANIFEST -t ghcr.io/headlamp-k8s/headlamp:${version} -f source/Dockerfile source`,
      'build:plugins-container': `docker buildx build --pull --platform=local -t ghcr.io/headlamp-k8s/plugins:${version} -f source/Dockerfile.plugins source`,
      start: 'npm --prefix source run start:with-app',
      'start:backend': 'npm --prefix source run start:backend',
      'start:frontend': 'npm --prefix source run start:frontend',
      'start:app': 'npm --prefix source run app:start:client',
      test: 'npm --prefix source test',
      lint: 'npm --prefix source run lint',
      tsc: 'npm --prefix source run frontend:tsc && npm --prefix source run app:tsc',
      'verify:images': 'npm --prefix source run image:verify-image-digests',
    },
    headlampSource: {
      ref: config.ref,
      baseTag: config.baseTag,
      commit: config.commit,
    },
  };
}

function verifySourceCheckout(sourceDir: string, commit: string): void {
  const actualCommit = run('git', ['rev-parse', 'HEAD'], sourceDir).trim();
  if (actualCommit !== commit) {
    throw new Error(
      `Headlamp source checkout is at ${actualCommit}, which does not match ${commit}`
    );
  }
  const changes = run(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    sourceDir
  ).trim();
  if (changes) {
    throw new Error('Headlamp source checkout has tracked changes');
  }
  for (const required of [
    'package.json',
    'LICENSE',
    'README.md',
    'Dockerfile',
    'app',
    'backend',
    'frontend',
  ]) {
    if (!fs.existsSync(path.join(sourceDir, required))) {
      throw new Error(`Headlamp source checkout is missing ${required}`);
    }
  }
}

function copyTrackedSource(sourceDir: string, destination: string): void {
  const files = run('git', ['ls-files', '-z'], sourceDir)
    .split('\0')
    .filter(Boolean);
  for (const relativeFile of files) {
    if (
      path.isAbsolute(relativeFile) ||
      relativeFile === '..' ||
      relativeFile.startsWith(`..${path.sep}`)
    ) {
      throw new Error(`Unsafe Headlamp source path: ${relativeFile}`);
    }
    const source = path.join(sourceDir, relativeFile);
    const target = path.join(destination, relativeFile);
    const stat = fs.lstatSync(source);
    if (stat.isDirectory()) {
      throw new Error(
        `Headlamp source contains an uninitialized submodule: ${relativeFile}`
      );
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (stat.isSymbolicLink()) {
      fs.symlinkSync(fs.readlinkSync(source), target);
    } else {
      fs.copyFileSync(source, target);
      fs.chmodSync(target, stat.mode);
    }
  }
}

function packageSource(
  rootDir: string,
  sourceDir: string,
  config: HeadlampSourceConfig
) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-source-'));
  const packageDir = path.join(workDir, 'package');
  const packagedSource = path.join(packageDir, 'source');
  const packagesDir = path.join(rootDir, 'packages');
  fs.mkdirSync(packagedSource, { recursive: true });
  fs.mkdirSync(packagesDir, { recursive: true });

  try {
    copyTrackedSource(sourceDir, packagedSource);
    const packageManifest = sourcePackageManifest(config);
    writeJson(path.join(packageDir, 'package.json'), packageManifest);
    fs.copyFileSync(
      path.join(packagedSource, 'LICENSE'),
      path.join(packageDir, 'LICENSE')
    );
    fs.copyFileSync(
      path.join(packagedSource, 'README.md'),
      path.join(packageDir, 'README.md')
    );

    const output = run(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      [
        'pack',
        packageDir,
        '--pack-destination',
        packagesDir,
        '--ignore-scripts',
        '--json',
      ],
      rootDir
    );
    const parsedResult = JSON.parse(output);
    const result = Array.isArray(parsedResult)
      ? parsedResult[0]
      : parsedResult.filename
        ? parsedResult
        : Object.values(parsedResult)[0];
    if (!result?.filename || !result?.integrity) {
      throw new Error(`npm pack returned an unexpected result: ${output}`);
    }
    return {
      artifactPath: path.join(packagesDir, result.filename),
      integrity: result.integrity as string,
      packageManifest,
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

export function updateHeadlampSource(options: UpdateOptions) {
  const rootDir = options.rootDir ?? ROOT_DIR;
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageLockPath = path.join(rootDir, 'package-lock.json');
  const project = readJson(packageJsonPath);
  const packageLock = readJson(packageLockPath);
  const currentConfig = project.headlampSource as HeadlampSourceConfig;
  if (!currentConfig) {
    throw new Error('package.json must declare headlampSource');
  }

  const config = {
    ...currentConfig,
    ...(options.baseTag ? { baseTag: options.baseTag } : {}),
    ...(options.commit ? { commit: options.commit.toLowerCase() } : {}),
  };
  const version = headlampSourceVersion(config);
  const sourceDir = fs.realpathSync(options.sourceDir);
  verifySourceCheckout(sourceDir, config.commit);

  const patchEntries = Object.entries(
    project.patchedDependencies as Record<string, string>
  ).filter(([selector]) => selector.startsWith(`${PACKAGE_NAME}@`));
  if (patchEntries.length !== 1) {
    throw new Error(
      `Expected one ${PACKAGE_NAME} patch, found ${patchEntries.length}`
    );
  }
  const [oldSelector, oldPatchPath] = patchEntries[0];
  const newSelector = `${PACKAGE_NAME}@${version}`;
  const newPatchPath = `build/patches/headlamp-source@${version}.patch`;
  const absoluteOldPatch = path.join(rootDir, oldPatchPath);
  const absoluteNewPatch = path.join(rootDir, newPatchPath);
  if (oldPatchPath !== newPatchPath) {
    if (
      fs.existsSync(absoluteNewPatch) &&
      !fs
        .readFileSync(absoluteNewPatch)
        .equals(fs.readFileSync(absoluteOldPatch))
    ) {
      throw new Error(
        `Refusing to overwrite a different patch: ${newPatchPath}`
      );
    }
    fs.copyFileSync(absoluteOldPatch, absoluteNewPatch);
  }

  const packaged = packageSource(rootDir, sourceDir, config);
  const artifactPath = path
    .relative(rootDir, packaged.artifactPath)
    .split(path.sep)
    .join('/');

  project.headlampSource = config;
  project.devDependencies[PACKAGE_NAME] = version;
  delete project.patchedDependencies[oldSelector];
  project.patchedDependencies[newSelector] = newPatchPath;

  packageLock.packages[''].devDependencies[PACKAGE_NAME] = version;
  packageLock.packages[`node_modules/${PACKAGE_NAME}`] = {
    version,
    resolved: `file:${artifactPath}`,
    integrity: packaged.integrity,
    dev: true,
    license: packaged.packageManifest.license,
    engines: packaged.packageManifest.engines,
    patched: {
      integrity: sha512(absoluteNewPatch),
      path: newPatchPath,
    },
  };

  writeJson(packageJsonPath, project);
  writeJson(packageLockPath, packageLock);
  console.log(`Prepared ${PACKAGE_NAME}@${version} from ${config.commit}`);
  console.log(`Run npm ci to apply and validate ${newPatchPath}`);

  return {
    artifactPath: packaged.artifactPath,
    patchPath: absoluteNewPatch,
    version,
  };
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

if (require.main === module) {
  const sourceDir = argument('--source');
  if (!sourceDir) {
    throw new Error(
      'Usage: npm run headlamp:source -- --source <checkout> [--commit <sha>]'
    );
  }
  updateHeadlampSource({
    sourceDir,
    commit: argument('--commit'),
    baseTag: argument('--base-tag'),
  });
}
