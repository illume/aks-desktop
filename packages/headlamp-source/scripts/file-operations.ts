const fs = require('node:fs');
const path = require('node:path');

function copyDirectoryContents(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source)) {
    if (!entry.startsWith('.')) {
      fs.cpSync(path.join(source, entry), path.join(destination, entry), {
        recursive: true,
      });
    }
  }
}

function removePathPattern(pattern: string): void {
  const directory = path.dirname(pattern);
  const namePattern = path.basename(pattern);
  if (!namePattern.includes('*')) {
    fs.rmSync(pattern, { recursive: true, force: true });
    return;
  }
  if (!fs.existsSync(directory)) {
    return;
  }
  const expression = new RegExp(
    `^${namePattern
      .split('*')
      .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`
  );
  for (const entry of fs.readdirSync(directory)) {
    if (expression.test(entry)) {
      fs.rmSync(path.join(directory, entry), { recursive: true, force: true });
    }
  }
}

module.exports = {
  copyDirectoryContents,
  removePathPattern,
};
