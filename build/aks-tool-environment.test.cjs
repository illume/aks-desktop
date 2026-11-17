const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { withAksToolPaths } = require('./aks-tool-environment.cjs');

function fixture(platform = 'linux') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aks-tool-environment-'));
  const executable = path.join(root, platform === 'win32' ? 'az.cmd' : 'az');
  fs.writeFileSync(executable, 'az');
  const crypto = require('node:crypto');
  return {
    root,
    manifest: {
      'external-tools': [
        {
          id: 'az',
          platforms: {
            [platform]: {
              path: path.basename(executable),
              sha256: crypto.createHash('sha256').update('az').digest('hex'),
            },
          },
        },
      ],
    },
  };
}

test('uses app-owned Azure CLI state on Unix', () => {
  const { root, manifest } = fixture();
  const environment = withAksToolPaths(
    { HOME: '/home/tester', PATH: '/usr/bin' },
    manifest,
    root,
    'linux'
  );

  assert.equal(environment.AZURE_CONFIG_DIR, '/home/tester/.aks-desktop/azure');
  assert.equal(environment.AKS_DESKTOP_AZURE_CONFIG_OWNED, '1');
});

test('uses app-owned Azure CLI state on Windows', () => {
  const { root, manifest } = fixture('win32');
  const environment = withAksToolPaths(
    { USERPROFILE: 'C:\\Users\\tester', Path: 'C:\\Windows' },
    manifest,
    root,
    'win32'
  );

  assert.equal(environment.AZURE_CONFIG_DIR, 'C:\\Users\\tester\\.aks-desktop\\azure');
  assert.equal(environment.AKS_DESKTOP_AZURE_CONFIG_OWNED, '1');
});

test('does not inherit an unrelated Azure CLI profile', () => {
  const { root, manifest } = fixture();
  const environment = withAksToolPaths(
    { HOME: '/home/tester', PATH: '/usr/bin', AZURE_CONFIG_DIR: '/tmp/external-azure' },
    manifest,
    root,
    'linux'
  );

  assert.equal(environment.AZURE_CONFIG_DIR, '/home/tester/.aks-desktop/azure');
});
