import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';

import { patchSetDigest, repositoryRoot, validateArchiveEntries } from '../cli.mjs';
import lock from '../../../build/headlamp-lock.json' with { type: 'json' };

test('the patch lock covers the ordered patch contents', () => {
  assert.equal(patchSetDigest(lock, repositoryRoot), lock.patchSetSha256);
  assert.equal(lock.patches.length, 66);
});

test('archive validation rejects paths that can escape the workspace', () => {
  assert.throws(() => validateArchiveEntries(['headlamp/file', 'headlamp/../../outside']));
  assert.throws(() => validateArchiveEntries(['/absolute']));
  assert.throws(() => validateArchiveEntries(['headlamp\\outside']));
  assert.doesNotThrow(() => validateArchiveEntries(['headlamp-source/', 'headlamp-source/app/file']));
});

test('the installed binary runs through its npm symlink', () => {
  const binary = path.join(repositoryRoot, 'node_modules', '.bin', 'aks-headlamp');
  const result = spawnSync(binary, [], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage: aks-headlamp/);
});
