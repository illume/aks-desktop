import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  HEADLAMP_APP_DIR,
  HEADLAMP_MANIFEST_PATH,
  ROOT_DIR,
} from './headlamp-path';

function sha256(file: string): string {
  const hash = createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

function platformName(): 'darwin' | 'linux' | 'win32' | undefined {
  if (
    process.platform === 'darwin' ||
    process.platform === 'linux' ||
    process.platform === 'win32'
  ) {
    return process.platform;
  }
  return undefined;
}

function relativeFromManifest(file: string): string {
  return path
    .relative(path.dirname(HEADLAMP_MANIFEST_PATH), file)
    .split(path.sep)
    .join('/');
}

function toolRecord(
  id: string,
  file: string,
  packagedPath: string,
  verificationPath = packagedPath
) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Required bundled tool is missing: ${file}`);
  }
  return {
    id,
    platforms: {
      [process.platform]: {
        path: packagedPath,
        sha256: sha256(file),
      },
    },
    packagedPath,
    verificationPath,
  };
}

export function createManifest() {
  const template = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'build', 'product-manifest.json'), 'utf8')
  );
  const platform = platformName();
  if (!platform) {
    throw new Error(`Unsupported build platform: ${process.platform}`);
  }

  const externalTools = path.join(
    HEADLAMP_APP_DIR,
    'resources',
    'external-tools'
  );
  const azName = process.platform === 'win32' ? 'az.cmd' : 'az';
  const tools = [
    toolRecord(
      'az',
      path.join(externalTools, 'az-cli', platform, 'bin', azName),
      `external-tools/az-cli/${platform}/bin/${azName}`,
      `external-tools/az-cli/${platform}/bin/${
        process.platform === 'win32' ? azName : 'az-wrapper'
      }`
    ),
    toolRecord(
      'az-kubelogin',
      path.join(externalTools, 'bin', 'az-kubelogin.py'),
      'external-tools/bin/az-kubelogin.py'
    ),
  ];

  template['external-tools'] = tools.map(
    ({ packagedPath, verificationPath, ...tool }) => tool
  );
  template.resources = {
    common: [
      { from: relativeFromManifest(externalTools), to: 'external-tools' },
      {
        from: relativeFromManifest(path.join(ROOT_DIR, 'LICENSE.txt')),
        to: 'AKS_DESKTOP_LICENSE.txt',
      },
      {
        from: relativeFromManifest(path.join(ROOT_DIR, 'NOTICE.md')),
        to: 'AKS_DESKTOP_NOTICE.md',
      },
    ],
  };
  template.verify = tools.map(tool => ({
    path: tool.verificationPath,
    sha256: tool.platforms[platform].sha256,
    platforms: [
      platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : platform,
    ],
  }));
  return template;
}

function expectedManifest(): string {
  return `${JSON.stringify(createManifest(), null, 2)}\n`;
}

export function generateManifest(): void {
  fs.mkdirSync(path.dirname(HEADLAMP_MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(HEADLAMP_MANIFEST_PATH, expectedManifest());
  console.log(`Generated ${HEADLAMP_MANIFEST_PATH}`);
}

export function verifyManifest(): void {
  if (
    !fs.existsSync(HEADLAMP_MANIFEST_PATH) ||
    fs.readFileSync(HEADLAMP_MANIFEST_PATH, 'utf8') !== expectedManifest()
  ) {
    throw new Error(
      'Generated product manifest is missing or stale; run npm run headlamp:manifest'
    );
  }
  console.log('Headlamp source package and product manifest are consistent.');
}

if (process.argv.includes('--check')) {
  verifyManifest();
} else {
  generateManifest();
}
