const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const packageManager = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
).packageManager;
const npmVersion = /^npm@(.+)$/.exec(packageManager)?.[1];

if (!npmVersion) {
  throw new Error(`package.json must declare an npm packageManager: ${packageManager}`);
}

function run(
  command: string,
  args: string[],
  options: { capture?: boolean; shell?: boolean } = {}
) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    shell: options.shell,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
  return options.capture ? result.stdout.trim() : '';
}

run(process.execPath, [
  '--experimental-strip-types',
  'packages/headlamp-source/scripts/update-source.ts',
  '--prepare',
  '--root',
  '.',
]);

const temporaryRoot =
  process.env.RUNNER_TEMP ||
  process.env.AGENT_TEMPDIRECTORY ||
  process.env.TMPDIR ||
  process.env.TEMP ||
  '/tmp';
const npmToolDirectory = fs.mkdtempSync(path.join(temporaryRoot, 'npm-12-'));
const systemNpm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmBinDirectory = path.join(npmToolDirectory, 'node_modules', '.bin');
const npmCli = path.join(npmToolDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js');

const globalNpmRoot = run(systemNpm, ['root', '--global'], {
  capture: true,
  shell: process.platform === 'win32',
});
const systemNpmCli = path.join(globalNpmRoot, 'npm', 'bin', 'npm-cli.js');
if (!fs.existsSync(systemNpmCli)) {
  throw new Error(`Cannot find the system npm CLI at ${systemNpmCli}`);
}
run(process.execPath, [
  systemNpmCli,
  'install',
  '--prefix',
  npmToolDirectory,
  '--no-save',
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  `npm@${npmVersion}`,
]);

process.env.PATH = `${npmBinDirectory}${path.delimiter}${process.env.PATH || ''}`;

if (process.env.GITHUB_PATH) {
  fs.appendFileSync(process.env.GITHUB_PATH, `${npmBinDirectory}\n`);
}
if (process.env.AGENT_TEMPDIRECTORY) {
  console.log(`##vso[task.prependpath]${npmBinDirectory}`);
}

console.log(`npm ${run(process.execPath, [npmCli, '--version'], { capture: true })}`);

const npmArgs = process.argv.slice(2);
if (npmArgs.length > 0) {
  run(process.execPath, [npmCli, ...npmArgs]);
}
