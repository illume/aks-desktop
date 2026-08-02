const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createManifest } = require('../scripts/generate-product-manifest.ts');
const { resolveHeadlampPaths } = require('../scripts/paths.ts');

test('generates product resources and verified tools from consumer configuration', () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'headlamp-manifest-'));
  const packageDir = path.join(rootDir, 'headlamp-source');
  const appDir = path.join(packageDir, 'source', 'app');
  const toolFile = path.join(appDir, 'resources', 'tools', 'example');
  fs.mkdirSync(path.dirname(toolFile), { recursive: true });
  fs.writeFileSync(toolFile, 'example tool');
  fs.writeFileSync(path.join(rootDir, 'LICENSE.txt'), 'license');
  fs.writeFileSync(
    path.join(rootDir, 'package.json'),
    JSON.stringify({
      version: '1.2.3',
      headlamp: {
        product: { name: 'example', productName: 'Example' },
        plugins: [
          {
            name: 'example',
            packageName: 'example',
            source: 'plugins/example',
          },
        ],
        build: {
          manifest: '.example/product-manifest.json',
          resources: [
            {
              base: 'project',
              from: 'LICENSE.txt',
              to: 'LICENSE.txt',
            },
          ],
          externalTools: [
            {
              id: 'example',
              platforms: {
                linux: {
                  file: 'resources/tools/example',
                  path: 'tools/example',
                },
              },
            },
          ],
        },
      },
    })
  );

  try {
    const { manifest, manifestPath } = createManifest({
      rootDir,
      packageDir,
      platform: 'linux',
    });

    test('rejects manifest paths outside the Headlamp app', () => {
      assert.throws(
        () => resolveHeadlampPaths('/tmp/headlamp-source', '../../../outside.json'),
        /must stay within/
      );
    });
    assert.equal(manifestPath, path.join(appDir, '.example', 'product-manifest.json'));
    assert.equal(manifest.product.version, '1.2.3');
    assert.equal('build' in manifest, false);
    assert.equal('source' in manifest.plugins[0], false);
    assert.deepEqual(manifest.resources.common, [
      {
        from: path
          .relative(path.dirname(manifestPath), path.join(rootDir, 'LICENSE.txt'))
          .split(path.sep)
          .join('/'),
        to: 'LICENSE.txt',
      },
    ]);
    const digest = createHash('sha256').update('example tool').digest('hex');
    assert.deepEqual(manifest['external-tools'], [
      {
        id: 'example',
        platforms: {
          linux: {
            path: 'tools/example',
            sha256: digest,
          },
        },
      },
    ]);
    assert.deepEqual(manifest.verify, [
      {
        path: 'tools/example',
        sha256: digest,
        platforms: ['linux'],
      },
    ]);
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
