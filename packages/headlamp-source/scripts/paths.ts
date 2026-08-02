const path = require('node:path');

function resolveWithin(root, relativePath, name) {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolvedPath);
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`${name} must stay within ${resolvedRoot}: ${relativePath}`);
  }
  return resolvedPath;
}

function resolveHeadlampPaths(packageDir, manifest = '.headlamp/product-manifest.json') {
  const resolvedPackageDir = path.resolve(packageDir);
  const sourceDir = path.join(resolvedPackageDir, 'source');
  const appDir = path.join(sourceDir, 'app');
  return {
    packageDir: resolvedPackageDir,
    sourceDir,
    appDir,
    distDir: path.join(appDir, 'dist'),
    manifestPath: resolveWithin(appDir, manifest, 'Product manifest'),
  };
}

function resolveInstalledHeadlampPaths(projectDir, manifest) {
  return resolveHeadlampPaths(
    path.join(projectDir, 'node_modules', '@headlamp-k8s', 'headlamp-source'),
    manifest
  );
}

module.exports = {
  resolveHeadlampPaths,
  resolveInstalledHeadlampPaths,
  resolveWithin,
};
