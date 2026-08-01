// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, test } from 'node:test';

import { HEADLAMP_PACKAGE_DIR } from './headlamp-path';

const { copyPlugin } = require(
  path.join(HEADLAMP_PACKAGE_DIR, 'scripts', 'bundle-plugins.js')
);

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs
    .splice(0)
    .forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

function createPlugin(packageName: string) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aks-desktop-plugin-'));
  const pluginDir = path.join(rootDir, 'source');
  const pluginsDir = path.join(rootDir, '.plugins');
  tempDirs.push(rootDir);

  fs.mkdirSync(path.join(pluginDir, 'dist', 'locales'), { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'dist', 'main.js'), 'plugin bundle');
  fs.writeFileSync(path.join(pluginDir, 'dist', 'locales', 'en.json'), '{}');
  fs.writeFileSync(
    path.join(pluginDir, 'package.json'),
    JSON.stringify({ name: packageName })
  );

  return { pluginDir, pluginsDir };
}

test('copies a scoped plugin to a direct shipped-plugin directory', () => {
  const packageName = '@headlamp-k8s/ai-assistant';
  const { pluginDir, pluginsDir } = createPlugin(packageName);
  const legacyDir = path.join(pluginsDir, packageName);
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, 'stale.js'), 'stale bundle');
  const existingTargetDir = path.join(pluginsDir, 'ai-assistant');
  fs.mkdirSync(existingTargetDir, { recursive: true });
  fs.writeFileSync(path.join(existingTargetDir, 'stale.js'), 'stale bundle');

  const targetDir = copyPlugin(pluginDir, pluginsDir, {
    name: 'ai-assistant',
    packageName,
    source: 'plugins/ai-assistant',
  });

  assert.equal(targetDir, path.join(pluginsDir, 'ai-assistant'));
  assert.equal(fs.existsSync(path.join(targetDir, 'main.js')), true);
  assert.equal(fs.existsSync(path.join(targetDir, 'locales', 'en.json')), true);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(targetDir, 'package.json'), 'utf8'))
      .name,
    packageName
  );
  assert.equal(fs.existsSync(path.join(targetDir, 'stale.js')), false);
  assert.equal(fs.existsSync(path.join(pluginsDir, '@headlamp-k8s')), false);
});

test('preserves the directory name for an unscoped plugin', () => {
  const packageName = 'aks-desktop';
  const { pluginDir, pluginsDir } = createPlugin(packageName);

  const targetDir = copyPlugin(pluginDir, pluginsDir, {
    name: packageName,
    packageName,
    source: `plugins/${packageName}`,
  });

  assert.equal(targetDir, path.join(pluginsDir, packageName));
  assert.equal(fs.existsSync(path.join(targetDir, 'main.js')), true);
});

test('rejects unsafe plugin bundle names', () => {
  const packageName = '../outside';
  const { pluginDir, pluginsDir } = createPlugin(packageName);
  const outsideDir = path.join(path.dirname(pluginsDir), 'outside');
  fs.mkdirSync(outsideDir);
  fs.writeFileSync(path.join(outsideDir, 'sentinel'), 'keep');

  assert.throws(
    () =>
      copyPlugin(pluginDir, pluginsDir, {
        name: packageName,
        packageName,
        source: 'plugins/outside',
      }),
    /Invalid plugin bundle name/
  );
  assert.equal(fs.existsSync(path.join(outsideDir, 'sentinel')), true);
});

test('rejects a plugin whose package identity does not match', () => {
  const { pluginDir, pluginsDir } = createPlugin('unexpected-plugin');

  assert.throws(
    () =>
      copyPlugin(pluginDir, pluginsDir, {
        name: 'expected-plugin',
        packageName: 'expected-plugin',
        source: 'plugins/expected-plugin',
      }),
    /Plugin package mismatch/
  );
  assert.equal(fs.existsSync(path.join(pluginsDir, 'expected-plugin')), false);
});
