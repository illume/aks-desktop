import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ROOT_DIR } from './headlamp-path';

const PACKAGE_NAME = '@headlamp-k8s/headlamp-source';
const SERIES_ENTRY_PATTERN =
  /^(\d{4}) (source|package) ([a-z0-9]+(?:-[a-z0-9]+)*\.patch)$/;

export interface PatchSeriesEntry {
  file: string;
  scope: 'source' | 'package';
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file: string, value: unknown) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function sha512(value: Buffer): string {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`;
}

export function parsePatchSeries(value: string): PatchSeriesEntry[] {
  const lines = value.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    throw new Error('Headlamp patch series is empty');
  }
  const files = new Set<string>();
  return lines.map((line, index) => {
    const match = SERIES_ENTRY_PATTERN.exec(line);
    if (match?.[1] !== String(index + 1).padStart(4, '0')) {
      throw new Error(`Invalid Headlamp patch series entry: ${line}`);
    }
    const [, , scope, file] = match;
    if (files.has(file)) {
      throw new Error(`Duplicate Headlamp patch series entry: ${file}`);
    }
    files.add(file);
    return { file, scope } as PatchSeriesEntry;
  });
}

export function normalizePatch(
  value: string,
  scope: PatchSeriesEntry['scope']
): Buffer {
  const start = value.indexOf('diff --git ');
  if (start === -1) {
    throw new Error('Headlamp patch contains no unified diff');
  }
  let patch = value.slice(start);
  const footer = patch.lastIndexOf('\n-- \n');
  if (footer !== -1) {
    patch = patch.slice(0, footer + 1);
  }
  if (scope === 'source') {
    patch = patch
      .split('\n')
      .map(line => {
        if (line.startsWith('diff --git a/')) {
          return line
            .replace('diff --git a/', 'diff --git a/source/')
            .replace(' b/', ' b/source/');
        }
        for (const prefix of ['--- a/', '+++ b/']) {
          if (line.startsWith(prefix)) {
            return `${prefix}source/${line.slice(prefix.length)}`;
          }
        }
        for (const prefix of [
          'rename from ',
          'rename to ',
          'copy from ',
          'copy to ',
        ]) {
          if (line.startsWith(prefix)) {
            return `${prefix}source/${line.slice(prefix.length)}`;
          }
        }
        return line;
      })
      .join('\n');
  }
  return Buffer.from(patch.endsWith('\n') ? patch : `${patch}\n`);
}

export function composeHeadlampPatchSeries(rootDir = ROOT_DIR): Buffer {
  const patchDir = path.join(rootDir, 'patches');
  const entries = parsePatchSeries(
    fs.readFileSync(path.join(patchDir, 'series'), 'utf8')
  );
  return Buffer.concat(
    entries.map(entry =>
      normalizePatch(
        fs.readFileSync(path.join(patchDir, entry.file), 'utf8'),
        entry.scope
      )
    )
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
