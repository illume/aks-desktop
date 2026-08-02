import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ROOT_DIR } from './headlamp-path';

const PACKAGE_NAME = '@headlamp-k8s/headlamp-source';
const SERIES_ENTRY_PATTERN = /^\d{4}-[a-z0-9]+(?:-[a-z0-9]+)*\.patch$/;

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file: string, value: unknown) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha512(value: Buffer): string {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`;
}

export function parsePatchSeries(value: string): string[] {
  const entries = value.split(/\r?\n/).filter(Boolean);
  if (entries.length === 0) {
    throw new Error('Headlamp patch series is empty');
  }
  entries.forEach((entry, index) => {
    const expectedPrefix = `${String(index + 1).padStart(4, '0')}-`;
    if (
      !SERIES_ENTRY_PATTERN.test(entry) ||
      !entry.startsWith(expectedPrefix)
    ) {
      throw new Error(`Invalid Headlamp patch series entry: ${entry}`);
    }
  });
  return entries;
}

export function composeHeadlampPatchSeries(rootDir = ROOT_DIR): Buffer {
  const patchDir = path.join(rootDir, 'patches');
  const entries = parsePatchSeries(
    fs.readFileSync(path.join(patchDir, 'series'), 'utf8')
  );
  return Buffer.concat(
    entries.map(entry => {
      const contents = fs.readFileSync(path.join(patchDir, entry));
      if (!contents.toString('utf8', 0, 11).startsWith('diff --git ')) {
        throw new Error(`Invalid Headlamp patch: ${entry}`);
      }
      return contents.at(-1) === 10
        ? contents
        : Buffer.concat([contents, Buffer.from('\n')]);
    })
  );
}

function configuredPatch(rootDir: string) {
  const manifest = readJson(path.join(rootDir, 'package.json'));
  const entries = Object.entries(
    manifest.patchedDependencies as Record<string, string>
  ).filter(([selector]) => selector.startsWith(`${PACKAGE_NAME}@`));
  if (entries.length !== 1) {
    throw new Error(
      `Expected one ${PACKAGE_NAME} npm patch, found ${entries.length}`
    );
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

export function updateHeadlampPatch(
  rootDir = ROOT_DIR,
  check = false
): void {
  const { patchPath } = configuredPatch(rootDir);
  const aggregate = composeHeadlampPatchSeries(rootDir);
  const absolutePatch = path.join(rootDir, patchPath);
  const lockPath = path.join(rootDir, 'package-lock.json');
  const lock = readJson(lockPath);
  const lockEntry = lock.packages[`node_modules/${PACKAGE_NAME}`];
  const integrity = sha512(aggregate);

  if (!lockEntry?.patched) {
    throw new Error(`${PACKAGE_NAME} is not patched in package-lock.json`);
  }

  if (check) {
    if (
      !fs.existsSync(absolutePatch) ||
      !fs.readFileSync(absolutePatch).equals(aggregate)
    ) {
      throw new Error(`Run npm run headlamp:patches to update ${patchPath}`);
    }
    if (
      lockEntry.patched.path !== patchPath ||
      lockEntry.patched.integrity !== integrity
    ) {
      throw new Error(
        'Run npm run headlamp:patches to update the patch lock integrity'
      );
    }
    return;
  }

  fs.writeFileSync(absolutePatch, aggregate);
  lockEntry.patched = { integrity, path: patchPath };
  writeJson(lockPath, lock);
  console.log(`Composed ${patchPath}`);
}

if (require.main === module) {
  updateHeadlampPatch(ROOT_DIR, process.argv.includes('--check'));
}
