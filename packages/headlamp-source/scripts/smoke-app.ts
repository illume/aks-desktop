const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function option(args: string[], name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function readProductConfig(root = path.resolve(process.env.INIT_CWD || process.cwd())) {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (!project.headlamp?.product) {
    throw new Error('package.json must declare headlamp.product');
  }
  return project.headlamp;
}

function packagedExecutableCandidates(
  dist,
  manifest = readProductConfig(),
  platform = process.platform,
  architecture = process.arch
) {
  const productName = manifest.product.productName;
  const manifestPlatform =
    platform === 'darwin'
      ? 'mac'
      : platform === 'linux'
      ? 'linux'
      : platform === 'win32'
      ? 'win'
      : undefined;
  const executableName =
    (manifestPlatform ? manifest.platforms?.[manifestPlatform]?.executableName : undefined) ||
    productName ||
    manifest.product.name;
  if (!executableName) {
    return [];
  }

  if (platform === 'darwin') {
    const otherArchitecture = architecture === 'arm64' ? 'x64' : 'arm64';
    return [`mac-${architecture}`, `mac-${otherArchitecture}`, 'mac-universal', 'mac'].map(
      directory =>
        path.resolve(dist, directory, `${productName}.app`, 'Contents', 'MacOS', executableName)
    );
  }
  if (platform === 'win32') {
    return [`win-${architecture}-unpacked`, 'win-unpacked'].map(directory =>
      path.resolve(dist, directory, `${executableName}.exe`)
    );
  }
  if (platform === 'linux') {
    return [`linux-${architecture}-unpacked`, 'linux-unpacked'].map(directory =>
      path.resolve(dist, directory, executableName)
    );
  }
  return [];
}

function resolvePackagedExecutable(dist) {
  const candidates = packagedExecutableCandidates(dist);
  const executable = candidates.find(
    candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
  if (!executable) {
    throw new Error(`Packaged executable was not found; checked: ${candidates.join(', ')}`);
  }
  return executable;
}

function descendantProcessIds(rootPid) {
  const result = spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
  if (result.status !== 0) {
    return [];
  }
  const children = new Map();
  for (const line of result.stdout.trim().split(/\r?\n/)) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    children.set(parent, [...(children.get(parent) || []), pid]);
  }
  const descendants = [];
  const visit = pid => {
    for (const child of children.get(pid) || []) {
      visit(child);
      descendants.push(child);
    }
  };
  visit(rootPid);
  return descendants;
}

async function terminateProcessTree(child) {
  if (!child.pid) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  } else {
    const processIds = [...descendantProcessIds(child.pid), child.pid];
    for (const pid of processIds) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 250));
    for (const pid of processIds) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}

async function smoke(executable, port, timeout, disableSandbox) {
  const args = ['--headless', '--disable-gpu', '--port', String(port)];
  if (disableSandbox) {
    args.unshift('--no-sandbox');
  }
  const child = spawn(executable, args, {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError;
  child.once('error', error => {
    spawnError = error;
  });
  child.stdout?.on('data', chunk => (output += chunk));
  child.stderr?.on('data', chunk => (output += chunk));

  try {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`Could not start packaged application: ${spawnError.message}`);
      }
      if (child.exitCode !== null) {
        throw new Error(`Packaged application exited before becoming ready:\n${output}`);
      }
      try {
        const response = await fetch(`http://127.0.0.1:${port}`);
        if (response.ok && (await response.text()).includes('<html')) {
          console.log(`Packaged application smoke check passed on port ${port}.`);
          return;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(`Packaged application did not become ready within ${timeout}ms:\n${output}`);
  } finally {
    await terminateProcessTree(child);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dist = option(args, '--dist') || path.resolve(__dirname, '..', 'source', 'app', 'dist');
  const executable = option(args, '--executable') || resolvePackagedExecutable(dist);
  smoke(
    executable,
    Number(option(args, '--port') || 4466),
    Number(option(args, '--timeout') || 30_000),
    args.includes('--no-sandbox')
  ).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  packagedExecutableCandidates,
  resolvePackagedExecutable,
  smoke,
};
