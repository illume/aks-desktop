const fs = require('node:fs');
const path = require('node:path');

function createProductTemplate(project: any) {
  if (!project?.headlamp?.product || !Array.isArray(project.headlamp.plugins)) {
    throw new Error('package.json must declare headlamp.product and headlamp.plugins');
  }
  const { plugins, build: _build, ...template } = structuredClone(project.headlamp);
  template.product.version = project.version;
  template.plugins = plugins.map(({ source: _source, ...plugin }) => plugin);
  return template;
}

function projectManifest(root = path.resolve(process.env.INIT_CWD || process.cwd())) {
  return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
}

module.exports = {
  createProductTemplate,
  projectManifest,
};
