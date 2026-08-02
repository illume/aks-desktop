import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePatch, parsePatchSeries } from './headlamp-patch-series';

test('accepts a contiguous, ordered patch series', () => {
  assert.deepEqual(
    parsePatchSeries(
      '0001 source first-change.patch\n0002 package second-change.patch\n'
    ),
    [
      { file: 'first-change.patch', scope: 'source' },
      { file: 'second-change.patch', scope: 'package' },
    ]
  );
});

test('rejects unsafe or unordered patch series entries', () => {
  for (const series of [
    '',
    '0001 source ../change.patch\n',
    '0002 source change.patch\n',
    '0001 source change.patch\n0003 package other-change.patch\n',
    '0001 source change.patch\n0002 package change.patch\n',
  ]) {
    assert.throws(() => parsePatchSeries(series));
  }
});

test('normalizes source patches for the source-bearing npm package', () => {
  const mailPatch = [
    'From: patch@example.invalid',
    'Subject: [PATCH] example',
    '',
    'diff --git a/app/file.js b/app/file.js',
    '--- a/app/file.js',
    '+++ b/app/file.js',
    '@@ -1 +1 @@',
    '-old',
    '+new',
    '-- ',
    '2.50.1',
    '',
  ].join('\n');
  assert.equal(
    normalizePatch(mailPatch, 'source').toString(),
    `diff --git a/source/app/file.js b/source/app/file.js
--- a/source/app/file.js
+++ b/source/app/file.js
@@ -1 +1 @@
-old
+new
`
  );
});
