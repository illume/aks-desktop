const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { composePatchSeries, parsePatchSeries } = require('../scripts/compose-patches.ts');

test('accepts a contiguous, ordered patch series', () => {
  assert.deepEqual(
    parsePatchSeries('0001 source first-change.patch\n0002 package second-change.patch\n'),
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

test('uses Git to compose source patches for the source-bearing npm package', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-compose-'));
  const packageDir = path.join(root, 'packages', 'headlamp-source');
  const patchDir = path.join(root, 'patches');
  fs.mkdirSync(path.join(packageDir, 'source', 'app'), { recursive: true });
  fs.mkdirSync(patchDir);
  fs.writeFileSync(path.join(packageDir, 'source', 'app', 'file.js'), 'old\n');
  fs.writeFileSync(path.join(patchDir, 'series'), '0001 source example-change.patch\n');
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
  fs.writeFileSync(path.join(patchDir, 'example-change.patch'), mailPatch);

  try {
    const aggregate = composePatchSeries(root, packageDir).toString();
    assert.match(
      aggregate,
      /diff --git a\/source\/app\/file\.js b\/source\/app\/file\.js/
    );
    assert.match(aggregate, /-old\n\+new\n/);

    const gitConfig = path.join(root, 'gitconfig');
    fs.writeFileSync(gitConfig, '[diff]\n\tnoprefix = true\n\tmnemonicPrefix = true\n');
    const previousGitConfig = process.env.GIT_CONFIG_GLOBAL;
    process.env.GIT_CONFIG_GLOBAL = gitConfig;
    try {
      assert.equal(composePatchSeries(root, packageDir).toString(), aggregate);
    } finally {
      if (previousGitConfig === undefined) {
        delete process.env.GIT_CONFIG_GLOBAL;
      } else {
        process.env.GIT_CONFIG_GLOBAL = previousGitConfig;
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
