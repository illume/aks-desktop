import { spawn, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { HEADLAMP_DIST_DIR, ROOT_DIR } from './headlamp-path';

function readProductManifest() {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, 'build', 'product-manifest.json'), 'utf8')
  );
}

export function packagedExecutableCandidates(
  dist: string,
  manifest = readProductManifest(),
  platform = process.platform,
  architecture = process.arch
): string[] {
  const productName = manifest.product?.productName;
  const manifestPlatform =
    platform === 'darwin'
      ? 'mac'
      : platform === 'linux'
        ? 'linux'
        : platform === 'win32'
          ? 'win'
          : undefined;
  const executableName =
    (manifestPlatform
      ? manifest.platforms?.[manifestPlatform]?.executableName
      : undefined) ||
    productName ||
    manifest.product?.name;
  if (!executableName) {
    return [];
  }

  if (platform === 'darwin') {
    const otherArchitecture = architecture === 'arm64' ? 'x64' : 'arm64';
    return [`mac-${architecture}`, `mac-${otherArchitecture}`, 'mac-universal', 'mac'].map(
      directory =>
        path.resolve(
          dist,
          directory,
          `${productName}.app`,
          'Contents',
          'MacOS',
          executableName
        )
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

function resolvePackagedExecutable(dist: string): string {
  const candidates = packagedExecutableCandidates(dist);
  const executable = candidates.find(
    candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
  if (!executable) {
    throw new Error(
      `Packaged executable was not found; checked: ${candidates.join(', ')}`
    );
  }
  return executable;
}

function descendantProcessIds(rootPid: number): number[] {
  const result = spawnSync('ps', ['-eo', 'pid=,ppid='], { encoding: 'utf8' });
  if (result.status !== 0) {
    return [];
  }
  const children = new Map<number, number[]>();
  for (const line of result.stdout.trim().split(/\r?\n/)) {
    const [pid, parent] = line.trim().split(/\s+/).map(Number);
    children.set(parent, [...(children.get(parent) || []), pid]);
  }
  const descendants: number[] = [];
  const visit = (pid: number) => {
    for (const child of children.get(pid) || []) {
      visit(child);
      descendants.push(child);
    }
  };
  visit(rootPid);
  return descendants;
}

async function terminateProcessTree(child: ReturnType<typeof spawn>): Promise<void> {
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

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export async function smoke(
  executable: string,
  port: number,
  timeout: number,
  disableSandbox: boolean
): Promise<void> {
  const args = ['--headless', '--disable-gpu', '--port', String(port)];
  if (disableSandbox) {
    args.unshift('--no-sandbox');
  }
  const child = spawn(executable, args, {
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let spawnError: Error | undefined;
  child.once('error', error => {
    spawnError = error;
  });
  child.stdout?.on('data', chunk => (output += chunk));
  child.stderr?.on('data', chunk => (output += chunk));

  try {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new Error(`Could not start AKS Desktop: ${spawnError.message}`);
      }
      if (child.exitCode !== null) {
        throw new Error(`AKS Desktop exited before becoming ready:\n${output}`);
      }
      try {
        const response = await fetch(`http://127.0.0.1:${port}`);
        if (response.ok && (await response.text()).includes('<html')) {
          console.log(`AKS Desktop runtime smoke check passed on port ${port}.`);
          return;
        }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error(
      `AKS Desktop did not become ready within ${timeout}ms:\n${output}`
    );
  } finally {
    await terminateProcessTree(child);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const dist = option(args, '--dist') || HEADLAMP_DIST_DIR;
  const executable =
    option(args, '--executable') || resolvePackagedExecutable(dist);
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
