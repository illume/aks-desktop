import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import {
  packagedExecutableCandidates,
  patchSetDigest,
  repositoryRoot,
  validateArchiveEntries,
  validateArchiveEntryTypes,
} from '../cli.mjs';
import lock from '../../../build/headlamp-lock.json' with { type: 'json' };

test('the patch lock covers the ordered patch contents', () => {
  assert.equal(patchSetDigest(lock, repositoryRoot), lock.patchSetSha256);
  assert.equal(lock.patches.length, 66);
});

test('archive validation rejects paths that can escape the workspace', () => {
  assert.throws(() => validateArchiveEntries(['headlamp/file', 'headlamp/../../outside']));
  assert.throws(() => validateArchiveEntries(['/absolute']));
  assert.throws(() => validateArchiveEntries(['headlamp\\outside']));
  assert.throws(() => validateArchiveEntries(['headlamp-a/file', 'headlamp-b/file']));
  assert.doesNotThrow(() => validateArchiveEntries(['headlamp-source/', 'headlamp-source/app/file']));
});

test('archive validation rejects links and special files', () => {
  assert.throws(() => validateArchiveEntryTypes(['lrwxrwxrwx owner/group 0 date link -> target']));
  assert.throws(() => validateArchiveEntryTypes(['crw-rw-rw- owner/group 0 date device']));
  assert.doesNotThrow(() =>
    validateArchiveEntryTypes([
      'drwxr-xr-x owner/group 0 date headlamp-source/',
      '-rw-r--r-- owner/group 1 date headlamp-source/file',
    ])
  );
});

test('packaged executable paths come from product manifest metadata', () => {
  const manifest = {
    product: { name: 'fallback', productName: 'Example Desktop' },
    platforms: {
      linux: { executableName: 'example' },
      mac: { executableName: 'example' },
      win: { executableName: 'example' },
    },
  };
  assert.ok(
    packagedExecutableCandidates('/dist', manifest, 'linux').includes(
      path.resolve('/dist/linux-unpacked/example')
    )
  );
  assert.ok(
    packagedExecutableCandidates('/dist', manifest, 'win32').includes(
      path.resolve('/dist/win-unpacked/example.exe')
    )
  );
  assert.ok(
    packagedExecutableCandidates('/dist', manifest, 'darwin').every(candidate =>
      candidate.endsWith(path.join('Example Desktop.app', 'Contents', 'MacOS', 'example'))
    )
  );
});

test('the installed binary runs through its npm symlink', () => {
  const binary = path.join(repositoryRoot, 'node_modules', '.bin', 'aks-headlamp');
  const result = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage: aks-headlamp/);
});
