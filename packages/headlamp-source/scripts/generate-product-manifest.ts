const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { resolveHeadlampPaths, resolveWithin } = require('./paths.ts');
const { createProductTemplate: createTemplate, projectManifest } = require(
  './product-manifest.ts'
);

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

function relativeFromManifest(file: string, manifestPath: string): string {
  return path
    .relative(path.dirname(manifestPath), file)
    .split(path.sep)
    .join('/');
}

function toolRecord(
  id: string,
  platform: string,
  file: string,
  packagedPath: string,
  verificationPath: string
) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new Error(`Required bundled tool is missing: ${file}`);
  }
  return {
    id,
    platforms: {
      [platform]: {
        path: packagedPath,
        sha256: sha256(file),
      },
    },
    packagedPath,
    verificationPath,
  };
}

function createProductTemplate(rootDir = path.resolve(process.env.INIT_CWD || process.cwd())) {
  const project = projectManifest(rootDir);
  return createTemplate(project);
}

function createManifest(options: any = {}) {
  const rootDir = path.resolve(options.rootDir || process.env.INIT_CWD || process.cwd());
  const packageDir = path.resolve(options.packageDir || path.join(__dirname, '..'));
  const project = projectManifest(rootDir);
  const build = project.headlamp?.build;
  if (!build || !Array.isArray(build.resources) || !Array.isArray(build.externalTools)) {
    throw new Error(
      'package.json must declare headlamp.build resources and externalTools'
    );
  }
  const { appDir, manifestPath } = resolveHeadlampPaths(packageDir, build.manifest);
  const template = createTemplate(project);
  const platform = options.platform || platformName();
  if (!platform) {
    throw new Error(`Unsupported build platform: ${process.platform}`);
  }

  const tools = build.externalTools.map((tool: any) => {
    const platformTool = tool.platforms?.[platform];
    if (!platformTool) {
      throw new Error(`External tool ${tool.id} has no ${platform} configuration`);
    }
    return toolRecord(
      tool.id,
      platform,
      resolveWithin(appDir, platformTool.file, `External tool ${tool.id}`),
      platformTool.path,
      platformTool.verificationPath || platformTool.path
    );
  });

  template['external-tools'] = tools.map(
    ({ packagedPath, verificationPath, ...tool }) => tool
  );
  template.resources = {
    common: build.resources.map((resource: any) => ({
      from: relativeFromManifest(
        resolveWithin(
          resource.base === 'headlampApp' ? appDir : rootDir,
          resource.from,
          'Product resource'
        ),
        manifestPath
      ),
      to: resource.to,
    })),
  };
  template.verify = tools.map(tool => ({
    path: tool.verificationPath,
    sha256: tool.platforms[platform].sha256,
    platforms: [
      platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : platform,
    ],
  }));
  return { manifest: template, manifestPath };
}

function expectedManifest(options?: any): { content: string; manifestPath: string } {
  const { manifest, manifestPath } = createManifest(options);
  return { content: `${JSON.stringify(manifest, null, 2)}\n`, manifestPath };
}

function generateManifest(options?: any): void {
  const { content, manifestPath } = expectedManifest(options);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, content);
  console.log(`Generated ${manifestPath}`);
}

function verifyManifest(options?: any): void {
  const { content, manifestPath } = expectedManifest(options);
  if (
    !fs.existsSync(manifestPath) ||
    fs.readFileSync(manifestPath, 'utf8') !== content
  ) {
    throw new Error(
      'Generated product manifest is missing or stale; run manifest:generate'
    );
  }
  console.log('Headlamp source package and product manifest are consistent.');
}

module.exports = {
  createManifest,
  createProductTemplate,
  generateManifest,
  verifyManifest,
};

if (require.main === module) {
  if (process.argv.includes('--check')) {
    verifyManifest();
  } else {
    generateManifest();
  }
}
