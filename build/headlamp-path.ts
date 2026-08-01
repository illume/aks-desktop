import * as path from 'path';

export const ROOT_DIR = path.resolve(__dirname, '..');
export const HEADLAMP_PACKAGE_DIR = path.join(
  ROOT_DIR,
  'node_modules',
  '@headlamp-k8s',
  'headlamp-source'
);
export const HEADLAMP_SOURCE_DIR = path.join(HEADLAMP_PACKAGE_DIR, 'source');
export const HEADLAMP_APP_DIR = path.join(HEADLAMP_SOURCE_DIR, 'app');
export const HEADLAMP_DIST_DIR = path.join(HEADLAMP_APP_DIR, 'dist');
export const HEADLAMP_MANIFEST_PATH = path.join(
  HEADLAMP_APP_DIR,
  '.aks-desktop',
  'product-manifest.json'
);
