import { runCommand } from '@kinvolk/headlamp-plugin/lib';
import { clusterRequest, stream } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { debugLog, detailLog, dumpForTestCase, verboseLog } from './debugLog';

declare const pluginRunCommand: typeof runCommand;

/**
 * Escape a string for safe use inside a bash single-quoted argument.
 * Single quotes prevent all shell interpretation (no variable expansion,
 * no command substitution). The only special case is the single quote
 * itself, which is handled by ending the string, adding an escaped
 * single quote, and starting a new single-quoted string.
 */
export function shellEscapeSingleQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

/**
 * Base system prompt prepended before every AKS agent question.
 * Instructs the LLM to return YAML inside markdown code blocks and
 * to honour the conversation history that follows.
 */
export const BASE_AKS_AGENT_PROMPT = `IMPORTANT INSTRUCTIONS:
- When returning any YAML content, always wrap it inside a markdown code block using \`\`\`yaml ... \`\`\` so it renders properly.
- The conversation history below shows all previously asked questions and your answers. Keep that context in mind and answer accordingly — do not repeat information already provided unless the user explicitly asks for it.
`;

/** Represents a single exchange (question + answer) from the conversation history. */
export interface ConversationEntry {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Builds the full prompt sent to the AKS agent:
 *   BASE_AKS_AGENT_PROMPT + conversation history + current question
 */
export function buildEnrichedPrompt(
  question: string,
  conversationHistory: ConversationEntry[]
): string {
  let enriched = BASE_AKS_AGENT_PROMPT;

  // Append prior conversation turns so the agent has full context
  if (conversationHistory.length > 0) {
    enriched += '\n--- CONVERSATION HISTORY ---\n';
    for (const entry of conversationHistory) {
      const label = entry.role === 'user' ? 'User' : 'Assistant';
      enriched += `${label}: ${entry.content}\n\n`;
    }
    enriched += '--- END OF CONVERSATION HISTORY ---\n\n';
  }

  enriched += `Now answer the following new question:\n${question}`;
  return enriched;
}

/** Info about a discovered AKS agent pod. */
export interface AksAgentPodInfo {
  namespace: string;
  podName: string;
  containerName: string;
}

/** A single thinking step shown to the user while the agent is working. */
export interface AgentThinkingStep {
  id: number;
  /** User-friendly description */
  label: string;
  /** Current state of this step */
  status: 'pending' | 'running' | 'completed';
  /** epoch millis when the step was created / last updated */
  timestamp: number;
  /**
   * Phase this step belongs to.
   * - 'init'      → toolset / model loading
   * - 'planning'  → TodoWrite task list items
   * - 'executing' → kubectl / tool calls
   */
  phase: 'init' | 'planning' | 'executing';
}

/** Callback invoked repeatedly as the agent streams thinking progress. */
export type AgentProgressCallback = (steps: AgentThinkingStep[]) => void;

/**
 * Allowed commands that can be executed via pluginRunCommand.
 * Only 'az' is needed for AKS cluster discovery.
 */
const ALLOWED_COMMANDS = new Set(['az']);

/**
 * Allowed first-level subcommands for the az CLI.
 * Only 'aks' operations are permitted.
 */
const ALLOWED_AZ_SUBCOMMANDS = new Set(['aks']);

/**
 * Runs a local command asynchronously using pluginRunCommand.
 * Restricted to allowed commands and subcommands to prevent arbitrary execution.
 */
function runCommandAsync(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return new Promise(resolve => {
    try {
      if (!ALLOWED_COMMANDS.has(command)) {
        resolve({ stdout: '', stderr: `Command not allowed: ${command}` });
        return;
      }

      if (command === 'az' && (args.length === 0 || !ALLOWED_AZ_SUBCOMMANDS.has(args[0]))) {
        resolve({ stdout: '', stderr: `az subcommand not allowed: ${args[0] ?? '(none)'}` });
        return;
      }

      if (typeof pluginRunCommand === 'undefined') {
        resolve({
          stdout: '',
          stderr:
            'pluginRunCommand is not available. This feature requires the desktop version of Headlamp.',
        });
        return;
      }

      //@ts-ignore - pluginRunCommand accepts 'az' but type def is narrower
      const cmd = pluginRunCommand(command, args, {});
      let stdout = '';
      let stderr = '';

      cmd.stdout.on('data', (data: string) => (stdout += data));
      cmd.stderr.on('data', (data: string) => (stderr += data));
      cmd.on('exit', () => resolve({ stdout, stderr }));
      cmd.on('error', (code: number) =>
        resolve({ stdout: '', stderr: `Command execution error: ${code}` })
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      resolve({ stdout: '', stderr: `Failed to execute command: ${errorMessage}` });
    }
  });
}

/**
 * Fetches AKS cluster info from the Headlamp backend config endpoint.
 * Returns objects with { name, server } filtered to AKS clusters (server contains .azmk8s.io).
 */
export async function getClustersFromHeadlampConfig(): Promise<
  Array<{ name: string; server: string }>
> {
  try {
    const response = await fetch('http://localhost:4466/config');
    if (!response.ok) return [];
    const data = await response.json();
    // clusters is an array: [{ name, server, ... }, ...]
    if (Array.isArray(data.clusters)) {
      return data.clusters
        .filter((c: any) => {
          if (!c.server || typeof c.server !== 'string') {
            return false;
          }
          let urlString = c.server as string;
          try {
            // Ensure we have a scheme so that URL parsing works even if server is just a host.
            const hasScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(urlString);
            if (!hasScheme) {
              urlString = 'https://' + urlString;
            }
            const parsed = new URL(urlString);
            const hostname = parsed.hostname.toLowerCase();
            return hostname === 'azmk8s.io' || hostname.endsWith('.azmk8s.io');
          } catch {
            // If the URL cannot be parsed, treat it as not an AKS cluster.
            return false;
          }
        })
        .map((c: any) => ({ name: c.name as string, server: c.server as string }))
        .filter(c => c.name);
    }
    return [];
  } catch (error) {
    console.error('[AKS Agent] Failed to fetch clusters from headlamp config:', error);
    return [];
  }
}

/**
 * Checks if the AKS agent is installed on a cluster by looking for pods
 * whose names start with "aks-" using the Headlamp Kubernetes API proxy.
 * Returns pod info (namespace, podName, containerName) or null if not found.
 */
export async function checkAksAgentInstalled(clusterName: string): Promise<AksAgentPodInfo | null> {
  try {
    // Check running pods across all namespaces for aks- prefix
    const podsResponse = await clusterRequest('/api/v1/pods', {
      method: 'GET',
      cluster: clusterName,
      isJSON: true,
      headers: {
        Accept: 'application/json',
      },
    });

    if (podsResponse?.items) {
      const aksPod = podsResponse.items.find(
        (p: any) =>
          p.metadata?.name?.toLowerCase().startsWith('aks-') && p.status?.phase === 'Running'
      );
      if (aksPod) {
        const namespace = aksPod.metadata?.namespace || 'default';
        const podName = aksPod.metadata?.name;
        // Use the first container in the pod
        const containerName = aksPod.spec?.containers?.[0]?.name || 'aks-agent';
        console.log(
          `[AKS Agent] Found agent pod: ${podName} in namespace: ${namespace}, container: ${containerName}`
        );
        return { namespace, podName, containerName };
      }
    }

    return null;
  } catch (error) {
    console.error(`[AKS Agent] Failed to check AKS agent on cluster "${clusterName}":`, error);
    return null;
  }
}

/**
 * Finds the Azure resource group and AKS cluster name using az CLI.
 * Strategy (in order):
 *  1. FQDN match against az aks list (most reliable — handles renamed kubeconfig contexts)
 *  2. Name match (case-insensitive)
 *  3. If only one AKS cluster exists in the subscription, use it directly
 */
export async function getClusterResourceGroup(
  clusterName: string,
  serverUrl?: string
): Promise<{ resourceGroup: string; aksClusterName: string } | null> {
  // Extract hostname (FQDN) from the server URL
  let fqdn: string | null = null;
  if (serverUrl) {
    try {
      fqdn = new URL(serverUrl).hostname;
    } catch {
      // ignore malformed URL
    }
  }

  try {
    const { stdout, stderr } = await runCommandAsync('az', ['aks', 'list', '-o', 'json']);

    if (!stdout) {
      console.error('[AKS Agent] az aks list returned no output. stderr:', stderr);
      return null;
    }

    let allClusters: any[];
    try {
      allClusters = JSON.parse(stdout);
    } catch {
      console.error('[AKS Agent] Failed to parse az aks list output:', stdout);
      return null;
    }

    if (!Array.isArray(allClusters) || allClusters.length === 0) {
      console.warn('[AKS Agent] az aks list returned no clusters');
      return null;
    }

    // 1. Match by FQDN (server URL hostname) — works even when context name differs from Azure name
    if (fqdn) {
      const match = allClusters.find(c => c.fqdn === fqdn || c.privateFqdn === fqdn);
      if (match) {
        return { resourceGroup: match.resourceGroup, aksClusterName: match.name };
      }
    }

    // 2. Match by cluster name (case-insensitive)
    const nameMatch = allClusters.find(
      c => c.name === clusterName || c.name.toLowerCase() === clusterName.toLowerCase()
    );
    if (nameMatch) {
      return { resourceGroup: nameMatch.resourceGroup, aksClusterName: nameMatch.name };
    }

    // 3. Only one AKS cluster in the subscription — use it directly
    if (allClusters.length === 1) {
      console.info(
        `[AKS Agent] No name/FQDN match for "${clusterName}", using the only available cluster: ${allClusters[0].name}`
      );
      return { resourceGroup: allClusters[0].resourceGroup, aksClusterName: allClusters[0].name };
    }

    console.warn(
      `[AKS Agent] Could not match cluster "${clusterName}" (fqdn: ${fqdn}) among ${allClusters.length} clusters:`,
      allClusters.map(c => ({ name: c.name, fqdn: c.fqdn }))
    );
    return null;
  } catch (error) {
    console.error('[AKS Agent] Failed to get cluster resource group:', error);
    return null;
  }
}

/** Strip ANSI/VT100 escape sequences and carriage returns from terminal output. */
function stripAnsi(text: string): string {
  return text
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '') // CSI sequences (colors, cursor, bracketed paste)
    .replace(/\x1b[()][AB012]/g, '') // Character set selection
    .replace(/\r/g, '') // Carriage returns
    .replace(/\x1b/g, '') // Stray ESC characters (from split sequences)
    .replace(/\[[\d;]*m/g, '') // Orphaned ANSI codes missing ESC prefix (from terminal line wrapping)
    .replace(/\s?\[(\d{1,3}(;\d{1,3})*)?$/gm, '') // Trailing orphan "[" fragments from split sequences (e.g. "[4" from "[4\n0m", or bare "[" from "\x1b[" at line end)
    .replace(/^(?:\d{1,3};)+\d{1,3}m\s?/gm, '') // Orphaned multi-part ANSI at line start (e.g. "97;40m" from split sequence)
    .replace(/^0m\s*$/gm, '') // Bare ANSI reset "0m" alone on a line (from split "[4\n0m"); K8s millicores like 25m/50m/200m appear in tabular data, not alone on a line
    .replace(/^0m(?=:\s?)/gm, ''); // Orphan ANSI reset "0m" at start of YAML key/value line (e.g. "0m:" from split "\x1b[\n0m:" → "metadata:" after rejoining); safe because real "0m:" never starts a line in YAML
}

/**
 * Convert Unicode bullet characters (•, ·, ▪, –) to markdown list syntax
 * so that ReactMarkdown renders them as proper bullet points.
 * Preserves any leading indentation so nested lists render correctly.
 */
function normalizeBullets(text: string): string {
  const result = text.replace(/^(\s*)[•·▪▸–]\s+/gm, '$1- ');
  if (result !== text) {
    verboseLog('[AKS Agent Parse] normalizeBullets: converted Unicode bullets to markdown dashes');
  }
  return result;
}

/**
 * Minimum word count for a line to be considered prose (rather than code).
 * Used by isTermCodeLine and normalizeTerminalMarkdown to distinguish
 * wrapped bold section headings from actual code content.
 */
const PROSE_WORD_THRESHOLD = 5;

/**
 * Curated set of first-word tokens that **unambiguously** indicate a shell
 * command, Dockerfile instruction, or similar code line.  These words almost
 * never begin an English sentence, so a first-word match is sufficient.
 *
 * Checked via O(1) Set lookup.  Organised by category for maintainability.
 * Dockerfile instructions are uppercase; everything else is lowercase.
 */
const KNOWN_CODE_COMMANDS: ReadonlySet<string> = new Set([
  // ── Dockerfile / OCI build instructions ──
  'FROM',
  'RUN',
  'CMD',
  'COPY',
  'WORKDIR',
  'EXPOSE',
  'ENTRYPOINT',
  'ENV',
  'ARG',
  'USER',
  'LABEL',
  'ADD',
  'SHELL',
  'VOLUME',
  'STOPSIGNAL',
  'HEALTHCHECK',
  'ONBUILD',

  // ── Container runtimes & orchestration ──
  'docker',
  'docker-compose',
  'podman',
  'nerdctl',
  'kubectl',
  'helm',
  'skaffold',
  'kustomize',
  'kompose',
  'minikube',
  'kind',
  'k3d',
  'k3s',
  'buildah',
  'crictl',
  'ctr',
  'trivy',
  'cosign',
  'kaniko',
  'podman-compose',
  'docker-slim',
  'dive',
  'stern',
  'kubectx',
  'kubens',
  'istioctl',
  'linkerd',
  'argocd',
  'flux',
  'velero',
  'krew',
  'kubeadm',
  'kubebuilder',
  'operator-sdk',

  // ── Cloud provider CLIs ──
  'az',
  'gcloud',
  'aws',
  'eksctl',
  'doctl',
  'oci',
  'ibmcloud',
  'linode-cli',
  'vultr-cli',
  'hcloud',
  'aks-preview',

  // ── JavaScript / TypeScript / Node.js ──
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'bunx',
  'deno',
  'node',
  'nodejs',
  'tsc',
  'tsx',
  'esbuild',
  'swc',
  'vite',
  'webpack',
  'rollup',
  'parcel',
  'turbo',
  'turborepo',
  'nx',
  'lerna',
  'jest',
  'vitest',
  'mocha',
  'jasmine',
  'karma',
  'cypress',
  'playwright',
  'puppeteer',
  'eslint',
  'biome',
  'prettier',
  'stylelint',
  'next',
  'nuxt',
  'gatsby',
  'remix',
  'astro',
  'svelte',
  'angular',
  'ng',
  'create-react-app',
  'create-next-app',
  'nodemon',
  'ts-node',
  'tsx',
  'pm2',

  // ── Python ──
  'pip',
  'pip3',
  'pip2',
  'python',
  'python3',
  'python2',
  'uvicorn',
  'gunicorn',
  'flask',
  'django-admin',
  'django',
  'poetry',
  'pipenv',
  'pipx',
  'virtualenv',
  'venv',
  'conda',
  'mamba',
  'micromamba',
  'pytest',
  'mypy',
  'pyright',
  'black',
  'ruff',
  'pylint',
  'flake8',
  'isort',
  'autopep8',
  'yapf',
  'celery',
  'alembic',
  'manage.py',
  'streamlit',
  'gradio',
  'jupyter',
  'ipython',
  'notebook',
  'sphinx-build',
  'sphinx-quickstart',
  'tox',
  'nox',
  'hatch',
  'pdm',
  'flit',
  'twine',
  'setuptools',
  'cython',
  'pyinstaller',
  'pydantic',
  'uvloop',
  'hypercorn',
  'daphne',
  'scrapy',
  'httpie',

  // ── Ruby ──
  'ruby',
  'gem',
  'bundle',
  'bundler',
  'rails',
  'rake',
  'rspec',
  'rubocop',
  'irb',
  'pry',
  'rvm',
  'rbenv',
  'chruby',
  'solargraph',
  'jekyll',
  'middleman',
  'capistrano',
  'puma',
  'unicorn',
  'sidekiq',
  'foreman',

  // ── PHP ──
  'php',
  'composer',
  'artisan',
  'phpunit',
  'phpstan',
  'phpcs',
  'phpcbf',
  'psalm',
  'pint',
  'tinker',
  'valet',
  'sail',
  'laravel',
  'symfony',
  'drush',
  'wp-cli',
  'wp',

  // ── Java / JVM / Kotlin ──
  'java',
  'javac',
  'jar',
  'gradle',
  'gradlew',
  'mvn',
  'mvnw',
  'sbt',
  'scala',
  'scalac',
  'kotlin',
  'kotlinc',
  'groovy',
  'groovyc',
  'ant',
  'kapt',
  'jlink',
  'jpackage',
  'keytool',
  'jarsigner',
  'javadoc',
  'jconsole',
  'jstack',
  'jmap',
  'jhat',
  'jps',
  'jdb',
  'jshell',
  'spring',
  'quarkus',
  'micronaut',

  // ── .NET / C# ──
  'dotnet',
  'nuget',
  'msbuild',
  'csc',
  'fsc',
  'paket',
  'dotnet-ef',

  // ── Go ──
  'go',
  'gofmt',
  'goimports',
  'golangci-lint',
  'dlv',
  'air',
  'goreleaser',
  'ko',
  'buf',
  'protoc',

  // ── Rust ──
  'cargo',
  'rustc',
  'rustup',
  'rustfmt',
  'clippy',
  'wasm-pack',
  'trunk',
  'cross',
  'miri',

  // ── Swift / Apple ──
  'swift',
  'swiftc',
  'xcodebuild',
  'xcrun',
  'swift-build',
  'swift-test',
  'swift-run',
  'cocoapods',
  'pod',
  'fastlane',
  'xcode-select',

  // ── Elixir / Erlang ──
  'elixir',
  'mix',
  'iex',
  'erl',
  'erlc',
  'rebar3',

  // ── Dart / Flutter ──
  'dart',
  'flutter',
  'pub',

  // ── Haskell ──
  'ghc',
  'ghci',
  'cabal',
  'stack',
  'runhaskell',

  // ── Perl / Lua / R / Julia ──
  'perl',
  'cpan',
  'cpanm',
  'lua',
  'luarocks',
  'Rscript',
  'julia',

  // ── Build tools & compilers ──
  'make',
  'cmake',
  'bazel',
  'buck',
  'buck2',
  'ninja',
  'meson',
  'autoconf',
  'automake',
  'configure',
  'gcc',
  'g++',
  'gfortran',
  'cobc',
  'cc',
  'c++',
  'clang',
  'clang++',
  'ld',
  'ar',
  'strip',
  'objdump',
  'objcopy',
  'nm',
  'ldd',
  'nasm',
  'yasm',
  'as',
  'pkg-config',
  'libtool',
  'scons',
  'waf',
  'premake',
  'xmake',
  'vcpkg',
  'conan',
  'zig',
  'nim',
  'nimble',

  // ── Version managers ──
  'nvm',
  'fnm',
  'volta',
  'asdf',
  'pyenv',
  'goenv',
  'tfenv',
  'corepack',
  'mise',
  'rtx',
  'sdkman',
  'jabba',

  // ── General CLI tools ──
  'curl',
  'wget',
  'wget2',
  'aria2c',
  'git',
  'git-lfs',
  'svn',
  'hg',
  'jq',
  'yq',
  'fq',
  'xq',
  'xargs',
  'parallel',
  'tee',
  'sed',
  'awk',
  'gawk',
  'mawk',
  'grep',
  'egrep',
  'fgrep',
  'rg',
  'ag',
  'fd',
  'fzf',
  'bat',
  'exa',
  'eza',
  'lsd',
  'tree',
  'dust',
  'duf',
  'procs',
  'btop',
  'htop',
  'glances',
  'neofetch',
  'tokei',
  'cloc',
  'hyperfine',
  'entr',
  'watchexec',
  'direnv',
  'starship',
  'zoxide',

  // ── File / directory operations (unambiguous subset) ──
  'mkdir',
  'mktemp',
  'rmdir',
  'chmod',
  'chown',
  'chgrp',
  'chattr',
  'lsattr',
  'ln',
  'rsync',
  'scp',
  'dd',
  'install',
  'shred',
  'truncate',
  'fallocate',
  'mkfifo',
  'mknod',
  'readlink',
  'realpath',
  'dirname',
  'basename',
  'pathchk',

  // ── Archive / compression ──
  'tar',
  'gzip',
  'gunzip',
  'bzip2',
  'bunzip2',
  'unzip',
  'zip',
  'xz',
  'unxz',
  'zstd',
  'unzstd',
  'pigz',
  'unpigz',
  'lz4',
  'unlz4',
  '7z',
  '7za',
  'rar',
  'unrar',
  'cpio',
  'pax',
  'zcat',
  'bzcat',
  'xzcat',
  'zless',

  // ── Process / system (unambiguous subset) ──
  'echo',
  'printf',
  'nohup',
  'crontab',
  'lsof',
  'fuser',
  'strace',
  'ltrace',
  'perf',
  'valgrind',
  'gdb',
  'lldb',
  'pgrep',
  'pkill',
  'killall',
  'renice',
  'ionice',
  'taskset',
  'chrt',
  'ulimit',
  'prlimit',
  'sysctl',
  'dmesg',
  'journalctl',
  'logger',
  'systemd-analyze',
  'systemd-run',
  'loginctl',
  'timedatectl',
  'localectl',
  'hostnamectl',
  'coredumpctl',
  'uname',
  'uptime',
  'whoami',
  'hostname',
  'domainname',
  'printenv',
  'getent',
  'nproc',
  'free',
  'vmstat',
  'iostat',
  'mpstat',
  'sar',
  'pidof',
  'pmap',

  // ── Shell builtins (low-ambiguity subset) ──
  'export',
  'source',
  'eval',
  'exec',
  'alias',
  'unalias',
  'umask',
  'trap',
  'getopts',
  'shift',
  'shopt',
  'typeset',
  'declare',
  'readonly',
  'local',

  // ── Shell interpreters ──
  'bash',
  'sh',
  'zsh',
  'fish',
  'dash',
  'ksh',
  'csh',
  'tcsh',
  'pwsh',
  'powershell',

  // ── Package managers / system administration ──
  'sudo',
  'su',
  'apt-get',
  'apt',
  'apt-cache',
  'apt-key',
  'apt-file',
  'aptitude',
  'dpkg',
  'dpkg-deb',
  'yum',
  'dnf',
  'rpm',
  'zypper',
  'brew',
  'cask',
  'apk',
  'pacman',
  'yay',
  'paru',
  'snap',
  'flatpak',
  'nix',
  'nix-env',
  'nix-shell',
  'nix-build',
  'nix-store',
  'guix',
  'emerge',
  'portage',
  'pkg',
  'pkg_add',
  'pkgin',
  'xbps-install',
  'xbps-query',

  // ── User / group management ──
  'useradd',
  'usermod',
  'userdel',
  'groupadd',
  'groupmod',
  'groupdel',
  'passwd',
  'chpasswd',
  'adduser',
  'addgroup',
  'deluser',
  'delgroup',
  'visudo',

  // ── Disk / filesystem ──
  'fdisk',
  'gdisk',
  'parted',
  'mkfs',
  'mkfs.ext4',
  'mkfs.xfs',
  'mkfs.btrfs',
  'mkswap',
  'swapon',
  'swapoff',
  'fsck',
  'e2fsck',
  'xfs_repair',
  'blkid',
  'lsblk',
  'findmnt',
  'losetup',
  'cryptsetup',
  'lvs',
  'vgs',
  'pvs',
  'lvcreate',
  'vgcreate',
  'pvcreate',
  'resize2fs',
  'xfs_growfs',
  'btrfs',

  // ── Service / daemon management ──
  'systemctl',
  'supervisord',
  'supervisorctl',
  'initctl',
  'rc-service',
  'rc-update',
  'chkconfig',
  'update-rc.d',

  // ── Database CLIs ──
  'mysql',
  'mysqldump',
  'mysqladmin',
  'mysqlimport',
  'psql',
  'pg_dump',
  'pg_restore',
  'pg_basebackup',
  'pgbench',
  'createdb',
  'dropdb',
  'createuser',
  'dropuser',
  'sqlite3',
  'mongosh',
  'mongo',
  'mongodump',
  'mongorestore',
  'mongoexport',
  'mongoimport',
  'redis-cli',
  'redis-server',
  'redis-benchmark',
  'influx',
  'influxd',
  'cqlsh',
  'nodetool',
  'clickhouse-client',
  'etcdctl',
  'consul',
  'vault',

  // ── Networking (unambiguous subset) ──
  'ssh',
  'ssh-keygen',
  'ssh-copy-id',
  'ssh-add',
  'ssh-agent',
  'sftp',
  'sshfs',
  'telnet',
  'ping',
  'ping6',
  'traceroute',
  'traceroute6',
  'tracepath',
  'mtr',
  'dig',
  'nslookup',
  'whois',
  'ifconfig',
  'iptables',
  'ip6tables',
  'nftables',
  'nft',
  'ufw',
  'firewall-cmd',
  'firewalld',
  'tcpdump',
  'tshark',
  'wireshark',
  'nmap',
  'masscan',
  'netcat',
  'ncat',
  'socat',
  'ab',
  'wrk',
  'hey',
  'siege',
  'vegeta',
  'fortio',
  'iperf',
  'iperf3',
  'mitmproxy',
  'ngrok',
  'localtunnel',
  'caddy',
  'nginx',
  'apache2',
  'httpd',
  'lighttpd',
  'haproxy',
  'envoy',
  'traefik',

  // ── Infrastructure / CI-CD / deployment ──
  'terraform',
  'terragrunt',
  'ansible',
  'ansible-playbook',
  'ansible-galaxy',
  'ansible-vault',
  'vagrant',
  'packer',
  'pulumi',
  'cdk',
  'cdktf',
  'sam',
  'cloudformation',
  'serverless',
  'sls',
  'vercel',
  'netlify',
  'heroku',
  'flyctl',
  'gh',
  'hub',
  'act',
  'circleci',
  'gitlab-runner',
  'jenkins-cli',
  'tekton',
  'argo',
  'spinnaker',
  'waypoint',

  // ── Security / crypto tools ──
  'openssl',
  'gpg',
  'gpg2',
  'ssh-keyscan',
  'certbot',
  'cfssl',
  'step',
  'age',
  'sops',
  'sealed-secrets',
  'htpasswd',
  'fail2ban-client',

  // ── Linters / formatters / code quality ──
  'shellcheck',
  'hadolint',
  'yamllint',
  'jsonlint',
  'markdownlint',
  'vale',
  'proselint',
  'semgrep',
  'snyk',
  'grype',
  'syft',
  'checkov',
  'tflint',
  'tfsec',
  'kube-score',
  'kube-linter',
  'polaris',
  'conftest',
  'opa',
  'gitleaks',
  'trufflehog',

  // ── Text processing (unambiguous subset) ──
  'colrm',
  'column',
  'fmt',
  'fold',
  'nl',
  'rev',
  'shuf',
  'tsort',
  'unexpand',
  'expand',
  'csplit',
  'iconv',
  'dos2unix',
  'unix2dos',
  'xxd',
  'hexdump',
  'od',
  'base64',
  'base32',
  'md5sum',
  'sha256sum',
  'sha512sum',
  'shasum',
  'cksum',
  'b2sum',
  'wc',
]);

/**
 * Words that are both common shell commands AND common English words.
 * These only match as code when the rest of the line contains shell-like
 * syntax (flags, file paths, operators, quoted args) — see `hasShellSyntax`.
 */
const AMBIGUOUS_CODE_COMMANDS: ReadonlySet<string> = new Set([
  // File operations
  'cat',
  'cp',
  'mv',
  'rm',
  'ls',
  'cd',
  'pwd',
  'du',
  'df',
  'touch',
  'file',
  'stat',
  'find',
  'head',
  'tail',
  'cut',
  'tr',
  'sort',
  'uniq',
  'diff',
  'patch',
  'split',
  'join',
  'paste',
  'comm',
  'tac',
  'look',

  // Editors
  'vi',
  'vim',
  'nano',
  'emacs',
  'ed',
  'less',
  'more',

  // Process / control
  'kill',
  'wait',
  'sleep',
  'test',
  'time',
  'timeout',
  'watch',
  'at',
  'nice',
  'jobs',
  'bg',
  'fg',
  'top',
  'ps',
  'free',
  'last',
  'who',
  'w',
  'id',

  // Shell builtins
  'set',
  'unset',
  'read',
  'return',
  'exit',
  'enable',
  'type',
  'which',
  'command',
  'hash',

  // Networking
  'host',
  'ip',
  'nc',
  'ss',

  // System
  'env',
  'date',
  'cal',
  'yes',
  'true',
  'false',
  'seq',
  'expr',
  'bc',
  'dc',
  'mount',
  'link',
  'open',
  'write',

  // Service names that double as English words
  'service',
]);

/**
 * Check whether a line (beyond its first word) contains syntax that is
 * characteristic of shell commands — flags, file paths, operators, etc.
 * Used to disambiguate words that are both commands and English words.
 */
function hasShellSyntax(trimmed: string): boolean {
  // Command-line flags: -x, --flag, or -9  (space before dash to avoid prose hyphens)
  if (/\s-{1,2}[a-zA-Z0-9]/.test(trimmed)) return true;

  // Path-like arguments: word containing /  (but not http:// URLs at line start)
  if (/\s\S*\/\w/.test(trimmed) && !/^https?:\/\//.test(trimmed)) return true;

  // Glob patterns: *.ext or file.*
  if (/[*?]/.test(trimmed) && !/[.!?]\s*$/.test(trimmed)) return true;

  // Shell operators within the line: |, ;, &&
  if (/\s[|;]\s/.test(trimmed) || /\s&&\s/.test(trimmed)) return true;

  // Output redirection: > or >>
  if (/\s>{1,2}\s/.test(trimmed) || /2>&1/.test(trimmed)) return true;

  // Heredoc operator: <<EOF, <<'EOF', <<"EOF", <<-EOF
  if (/<<[-~]?\s*['"]?\w+['"]?\s*$/.test(trimmed)) return true;

  // Quoted arguments: "..." or '...'
  if (/\s["'][^"'\s]/.test(trimmed)) return true;

  // Variable references: $VAR or ${VAR}
  if (/\$[{A-Z_]/.test(trimmed)) return true;

  // Inline KEY=value assignment (e.g. env NODE_ENV=production)
  if (/\s[A-Z_][A-Z0-9_]*=\S/.test(trimmed)) return true;

  // Backtick command substitution
  if (/`[^`]+`/.test(trimmed)) return true;

  // File arguments: word.ext where ext is a known code/config file extension
  // (e.g. "touch app.yaml", "vim config.json", "cat main.py")
  if (
    /\s[\w./-]+\.(ya?ml|json|toml|py|rs|go|js|ts|sh|bash|conf|cfg|ini|txt|log|md|html|css|xml|sql|env|lock|mod|sum)\b/.test(
      trimmed
    )
  )
    return true;

  return false;
}

/**
 * Detect "file header" comments — lines like `# Cargo.toml`, `// src/main.rs`,
 * `# Dockerfile` that signal the start of a different file's content.
 * Used by `normalizeTerminalMarkdown` to break code blocks at file-type
 * boundaries (e.g. shell commands → Cargo.toml → Rust source).
 *
 * Matches comment lines where the comment body is a bare filename or path
 * (with extension), or a well-known extensionless filename.
 *
 * YAML file headers (e.g. `# k8s.yaml`, `# deploy.yml`) are excluded
 * because their content should be handled by `wrapBareYamlBlocks` instead.
 */
function isFileHeaderComment(trimmed: string): boolean {
  // # filename.ext  or  // path/to/file.ext
  if (/^(#|\/\/)\s+\S+\.\w+\s*$/.test(trimmed)) {
    // Exclude YAML file headers — let wrapBareYamlBlocks handle those
    if (/\.ya?ml\s*$/i.test(trimmed)) return false;
    return true;
  }
  // Well-known extensionless filenames
  if (
    /^(#|\/\/)\s+(Dockerfile|Makefile|Vagrantfile|Gemfile|Rakefile|Procfile|Brewfile)\s*$/.test(
      trimmed
    )
  )
    return true;
  return false;
}

/**
 * Detect standalone filename headings — lines like `Cargo.toml`, `src/main.rs`,
 * `Dockerfile` that Rich terminal renders as bold headings outside code panels.
 * After ANSI stripping these become bare filenames on their own line.
 *
 * Used by `normalizeTerminalMarkdown` and `wrapBareCodeBlocks` to recognise
 * that the next block of space-prefixed lines is a code file.
 *
 * YAML file headings are excluded — handled by `wrapBareYamlBlocks`.
 */
function isBoldFileHeading(trimmed: string): boolean {
  // filename.ext  or  path/to/file.ext  (standalone on a line, no other words)
  // Also matches dot-prefixed files like .env, .gitignore, .dockerignore
  if (/^([\w.-]+\/)*[\w.-]*\.\w+$/.test(trimmed)) {
    return true;
  }
  // Well-known extensionless filenames
  if (/^(Dockerfile|Makefile|Vagrantfile|Gemfile|Rakefile|Procfile|Brewfile)$/.test(trimmed))
    return true;
  return false;
}

/**
 * Heuristic: does a trimmed line look like a shell command, Dockerfile
 * instruction, or similar code that belongs in a fenced code block?
 *
 * Uses three tiers:
 *  1. **Unambiguous keyword** — the first word is in `KNOWN_CODE_COMMANDS`
 *     (~500 entries).  Immediate match.
 *  2. **Ambiguous keyword + shell syntax** — the first word is in
 *     `AMBIGUOUS_CODE_COMMANDS` (~50 entries: words like "cat", "find",
 *     "sort", "kill" that are also common English) AND the rest of the line
 *     contains shell-like syntax (flags, paths, operators).
 *  3. **Structural patterns** — syntax like `./path`, `$ cmd`, `#!/bin/bash`,
 *     `KEY=value`, `cmd | cmd`, `cmd && cmd`, `> file`, `$(cmd)`, and
 *     line-continuation `\` are strong shell indicators regardless of the
 *     specific command name.
 *
 * Callers should combine this with a "≥ N code-like lines" threshold (see
 * `normalizeTerminalMarkdown`) to guard against single-line false positives.
 */
function looksLikeShellOrDockerCodeLine(trimmed: string): boolean {
  if (trimmed === '') return false;

  // ── Tier 1: unambiguous first-word keyword lookup ──
  const firstWord = trimmed.split(/\s/)[0];
  if (KNOWN_CODE_COMMANDS.has(firstWord)) return true;

  // ── Tier 2: ambiguous keyword — require shell syntax confirmation ──
  if (AMBIGUOUS_CODE_COMMANDS.has(firstWord) && hasShellSyntax(trimmed)) return true;

  // ── Tier 3: structural / syntactic patterns ──

  // Executable path: ./script.sh
  if (/^\.\/\w/.test(trimmed)) return true;

  // Shell prompt marker: $ command
  if (/^\$\s+\w/.test(trimmed)) return true;

  // Shebang: #!/bin/bash, #!/usr/bin/env python3
  if (/^#!\//.test(trimmed)) return true;

  // Dockerfile parser directive: # syntax=..., # escape=..., # check=...
  if (/^#\s*\w+=.+/.test(trimmed)) return true;

  // Shell comment containing a URL (e.g. "# then open http://localhost:8080")
  // or an absolute path — these appear inside code blocks as documentation comments.
  // The path check requires the slash to be preceded by whitespace or start-of-string
  // so that prose like "config/secrets" doesn't false-positive.
  if (/^#\s/.test(trimmed) && /https?:\/\/|localhost|(?:^|\s)\/\w/.test(trimmed)) return true;

  // Environment variable assignment: VAR=value or VAR="value"
  if (/^[A-Z_][A-Z0-9_]*=\S/.test(trimmed)) return true;

  // Pipe between commands: word | word  (but not markdown table starting with |)
  if (/\w\s+\|\s+\w/.test(trimmed) && !/^\|/.test(trimmed)) return true;

  // Output redirection: > file, >> file, 2>&1
  if (/\s>{1,2}\s+\S/.test(trimmed) || /2>&1/.test(trimmed)) return true;

  // Command chaining with &&
  if (/\s&&\s/.test(trimmed)) return true;

  // Command substitution: $(...)
  if (/\$\(/.test(trimmed)) return true;

  // Line continuation: ends with backslash (short lines only to avoid prose)
  if (/\\\s*$/.test(trimmed) && trimmed.length < 80) return true;

  // Bash for/while/done: "for x in ...; do", "while ...; do", "done"
  if (/^for\s+\w+\s+in\s/.test(trimmed)) return true;
  if (/^while\s+.+;\s*do/.test(trimmed)) return true;
  if (/^done\s*$/.test(trimmed)) return true;
  // Bash echo with variable expansion: "echo ..." containing $var
  if (/^echo\s+.*\$/.test(trimmed)) return true;

  // ── Tier 4: Python-specific patterns ──

  // Python import: from X import Y  or  from X.Y import Z
  if (/^from\s+\w+(\.\w+)*\s+import\s/.test(trimmed)) return true;

  // Python import: import X  or  import X.Y  or  import X, Y
  if (/^import\s+\w+/.test(trimmed)) return true;

  // Python function definition: def func_name(
  if (/^def\s+\w+\s*\(/.test(trimmed)) return true;

  // Python class definition: class Name:  or  class Name(Base):
  if (/^class\s+[A-Z]\w*[\s(:]/.test(trimmed)) return true;

  // Python decorator: @app.route(...)  or  @staticmethod
  if (/^@\w+/.test(trimmed)) return true;

  // Python dunder (double underscore) patterns: __name__, __init__, __main__
  // These are uniquely Python and should never be interpreted as markdown bold
  if (/__\w+__/.test(trimmed)) return true;

  // ── Tier 5: Rust / Go / general C-family patterns ──

  // Rust use statement: use axum::{...}; — require :: (path separator) or ;
  // to distinguish from English prose like "use this command"
  if (/^(pub\s+)?use\s+\w+/.test(trimmed) && (/::/.test(trimmed) || /;\s*$/.test(trimmed)))
    return true;

  // Rust/Go function definition: fn main(), async fn root(), pub fn new()
  if (/^(pub\s+)?(async\s+)?fn\s+\w+/.test(trimmed)) return true;

  // Rust let binding: let app = ..., let mut x = ...
  if (/^let\s+(mut\s+)?\w+\s*[:=]/.test(trimmed)) return true;

  // Rust/Go type definitions: struct, enum, trait, impl, mod, type
  if (/^(pub(\s*\(\s*crate\s*\))?\s+)?(struct|enum|trait|impl|mod)\s+\w+/.test(trimmed))
    return true;

  // Rust attribute: #[derive(...)], #[tokio::main]
  if (/^#\[[\w:]+/.test(trimmed)) return true;

  // Method chain continuation: .route("/", ...), .await, .unwrap()
  // Require the dot to be followed by a typical method name pattern (word + paren
  // or .await / .unwrap style) — excludes prose like ". However, the API..."
  if (
    /^\.\w+\(/.test(trimmed) ||
    /^\.(await|unwrap|expect|then|catch|map|filter|and_then|or_else|into|collect|iter)\b/.test(
      trimmed
    )
  )
    return true;

  // Lone closing brace (with optional semicolon): }  or };
  if (/^\}\s*;?\s*$/.test(trimmed)) return true;

  // Go-specific: func, var, package, type keywords
  if (/^(func|package)\s+\w+/.test(trimmed)) return true;
  if (/^(var|type)\s+\w+\s+\w+/.test(trimmed)) return true;

  // Go control flow: if, for, switch, select, return, defer, go
  // Require opening brace or parenthesis to avoid matching English prose.
  if (/^(if|for|switch|select)\s+.+\{/.test(trimmed)) return true;
  if (/^(defer|go)\s+(func\b|\w+\.\w+)/.test(trimmed)) return true;
  if (/^return\s+\S/.test(trimmed) && /[;{}()\[\]]/.test(trimmed)) return true;

  // Go/Rust short variable declaration: identifier := expr
  if (/^\w+\s*:=\s*\S/.test(trimmed)) return true;

  // ── Tier 6: TOML / INI config patterns ──

  // TOML section headers: [package], [dependencies], [workspace.dependencies], etc.
  if (/^\[[\w.-]+\]/.test(trimmed)) return true;
  // TOML key = value: name = "foo", version = "1.0", key = { ... }
  if (/^[\w.-]+\s*=\s*["'{[\d]/.test(trimmed)) return true;

  // ── Tier 7: XML/HTML patterns ──

  // XML opening/closing tags: <project ...>, </dependencies>, <?xml ...>
  if (/^<\/?[\w?]/.test(trimmed)) return true;

  // ── Tier 8: kubectl / K8s structured output ──

  // kubectl describe output: "Key:   value" with 2+ spaces between
  if (/^[\w]+:\s{2,}\S/.test(trimmed)) return true;
  // kubectl table headers/rows: "NAME   STATUS   AGE" or dashed separators "----"
  if (/^-{4,}/.test(trimmed)) return true;
  // Log lines: "2026-03-12T10:23:45Z INFO ..."
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) return true;
  // Tabular output: lines with 3+ column-aligned gaps (2+ spaces between words)
  // e.g. "NAME   STATUS   AGE", "Type    Reason   Age   From     Message"
  if ((trimmed.match(/\S\s{2,}\S/g) ?? []).length >= 2) return true;

  return false;
}

/**
 * Collapse blank lines that result from terminal-formatted output.
 *
 * Rich / terminal output pads every line to 80 chars and sends each line as a
 * separate chunk followed by \r\n.  After ANSI stripping the chunks produce a
 * blank line between every pair of content lines.  This function removes those
 * artefact blank lines so that downstream transforms (normalizeTerminalMarkdown,
 * wrapBareYamlBlocks) see clean, contiguous content.
 *
 * Heuristics:
 *  - Between two space-prefixed lines (terminal code): a single blank line is
 *    a terminal artefact → remove.  Two or more blanks indicate an intentional
 *    blank line in the source code → collapse to one.
 *  - Between two prose lines where the previous line is long (≥ 60 chars) and
 *    the next starts with a lowercase letter: terminal line-wrapping artefact →
 *    remove (markdown will join adjacent lines into one paragraph).
 *  - Otherwise: collapse runs of multiple blank lines to one.
 */
function collapseTerminalBlankLines(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeFence = false;
  let collapsedCount = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track code fences — never alter content inside existing fences
    if (/^\s*```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      result.push(line);
      i++;
      continue;
    }
    if (inCodeFence) {
      result.push(line);
      i++;
      continue;
    }

    // Non-blank line → push as-is
    if (trimmed !== '') {
      result.push(line);
      i++;
      continue;
    }

    // ── Blank line: count the full run ──
    let blankCount = 0;
    let j = i;
    while (j < lines.length && lines[j].trim() === '') {
      blankCount++;
      j++;
    }

    // Find the previous non-blank line (already in result)
    let prevLine = '';
    for (let p = result.length - 1; p >= 0; p--) {
      if (result[p].trim() !== '') {
        prevLine = result[p];
        break;
      }
    }
    // Find the next non-blank line (still in input)
    const nextLine = j < lines.length ? lines[j] : '';

    // A line is "terminal code" if it starts with 1–4 spaces (Rich panel
    // padding) and is non-empty.  Lines with ≥ 5 leading spaces are usually
    // centered headings from terminal formatting, not code, so we exclude
    // them unless they actually look like code or YAML.
    const isTermCodeLine = (ln: string): boolean => {
      if (!ln.startsWith(' ') || ln.trim() === '') return false;
      const indent = ln.match(/^(\s*)/)?.[1].length ?? 0;
      const t = ln.trim();
      if (indent <= 4) {
        // Typical Rich panel indentation.  However, Rich also renders bold
        // section headings with 1-space indent (e.g. " Kubernetes manifests
        // (Namespace + ...)") — those are prose, not code.  Distinguish by
        // checking if the content actually looks like code or YAML.
        if (looksLikeShellOrDockerCodeLine(t) || looksLikeYaml(t)) return true;
        // Short lines that are just YAML values/keys also count
        if (/^[\w.-]+:\s/.test(t) || /^---\s*$/.test(t) || /^- /.test(t)) return true;
        // If the line has many words and doesn't look like code/YAML, it's prose
        const wordCount = t.split(/\s+/).length;
        if (
          wordCount >= PROSE_WORD_THRESHOLD &&
          !looksLikeShellOrDockerCodeLine(t) &&
          !looksLikeYaml(t)
        )
          return false;
        // Ordered list items (" 1 Create...", " 2 Apply...") are prose, not code
        if (/^\d+\s+\S/.test(t)) return false;
        return true; // default: treat as code for short lines
      }
      // Heavily indented — only treat as code if it looks like code/YAML
      return looksLikeShellOrDockerCodeLine(t) || looksLikeYaml(t);
    };
    const prevIsTermCode = isTermCodeLine(prevLine);
    const nextIsTermCode = isTermCodeLine(nextLine);

    if (prevIsTermCode && nextIsTermCode) {
      // Both sides are terminal-formatted code lines
      if (blankCount <= 1) {
        // Single blank = terminal chunk artefact → drop entirely
        // EXCEPT: preserve when next line is a file header comment
        // (e.g. "# Cargo.toml", "// src/main.rs") to keep a blank line
        // at file-type boundaries so normalizeTerminalMarkdown can split
        // the code into separate blocks.
        if (isFileHeaderComment(nextLine.trim())) {
          result.push('');
        }
        collapsedCount++;
      } else {
        // Multiple blanks = intentional blank in source code → keep one
        result.push('');
        collapsedCount++;
      }
    } else if (
      !prevIsTermCode &&
      !nextIsTermCode &&
      prevLine.trimEnd().length >= 60 &&
      !/[.!?:]\s*$/.test(prevLine.trimEnd())
    ) {
      // Prose continuation: long line wrapped at terminal width that doesn't
      // end with sentence-ending punctuation → join (remove blank)
      collapsedCount++;
    } else {
      // Default: keep at most one blank line
      result.push('');
      if (blankCount > 1) collapsedCount++;
    }

    i = j; // skip past all blanks in this run
  }

  if (collapsedCount > 0) {
    verboseLog(
      '[AKS Agent Parse] collapseTerminalBlankLines: collapsed',
      collapsedCount,
      'blank line groups'
    );
  }

  return result.join('\n');
}

/**
 * Normalize terminal-styled AI output into markdown-friendly formatting:
 *  - numbered choice lines like " 1 Kubernetes..." → "1. Kubernetes..."
 *  - centered heading lines get trimmed
 *  - indented Dockerfile / shell command blocks get wrapped in code fences
 */
function normalizeTerminalMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeFence = false;
  let orderedListCount = 0;
  let trimmedHeadingCount = 0;
  let wrappedCodeBlockCount = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^\s*```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      result.push(line);
      i++;
      continue;
    }
    if (inCodeFence) {
      result.push(line);
      i++;
      continue;
    }

    if (/^\s*\d+\s+\S/.test(line) && /^\s*\d+\s+/.test(line)) {
      const converted = line.replace(/^\s*(\d+)\s+/, '$1. ');
      if (converted !== line) {
        orderedListCount++;
        result.push(converted);
        i++;
        continue;
      }
    }

    // Detect Makefile targets at column 0: a bare "word:" followed by a
    // tab-indented line.  Wrap the target and its recipes in a code block.
    if (
      /^[\w.-]+:\s*$/.test(trimmed) &&
      !/^\s+/.test(line) &&
      i + 1 < lines.length &&
      /^\s*\t/.test(lines[i + 1])
    ) {
      const makefileLines: string[] = [line];
      let mj = i + 1;
      while (mj < lines.length) {
        const ml = lines[mj];
        const mt = ml.trim();
        if (mt === '') break;
        // Makefile recipe (tab-indented) or another target (word:)
        if (/^\s*\t/.test(ml) || /^[\w.-]+:\s*$/.test(mt)) {
          makefileLines.push(ml);
          mj++;
          continue;
        }
        break;
      }
      result.push('```');
      for (const ml of makefileLines) result.push(ml);
      result.push('```');
      wrappedCodeBlockCount++;
      i = mj;
      continue;
    }

    const prevTrimmed = i > 0 ? lines[i - 1].trim() : '';
    const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';
    if (
      /^\s{6,}\S/.test(line) &&
      prevTrimmed === '' &&
      nextTrimmed === '' &&
      !looksLikeShellOrDockerCodeLine(trimmed) &&
      !isBoldFileHeading(trimmed)
    ) {
      trimmedHeadingCount++;
      result.push(trimmed);
      i++;
      continue;
    }

    // Bold file headings (e.g. "Cargo.toml", "src/main.rs", "Dockerfile")
    // Rich terminal renders these as bold text outside code panels.
    // After ANSI stripping they appear as bare filenames on their own line
    // (possibly centered with leading whitespace), followed by a blank line
    // and then space-prefixed code content.
    // Emit the heading, then collect subsequent space-prefixed lines as a
    // code block (the content may be TOML, Rust, Dockerfile, etc.).
    if (isBoldFileHeading(trimmed)) {
      // Emit the heading (trimmed if centered with whitespace)
      result.push(trimmed);
      i++;
      // Skip blank lines after the heading
      while (i < lines.length && lines[i].trim() === '') {
        result.push(lines[i]);
        i++;
      }
      // Collect space-prefixed content lines as a code block
      if (i < lines.length && /^\s+\S/.test(lines[i])) {
        const blockLines: string[] = [];
        let j = i;
        // Track YAML literal/folded block scalars (| or >) so that their
        // indented content is never mistaken for prose headings.
        let inLiteralBlock = false;
        let literalBlockIndent = 0;
        while (j < lines.length) {
          const bl = lines[j];
          const bt = bl.trim();
          if (bt === '') {
            // Blank lines inside literal blocks are part of the scalar
            if (inLiteralBlock) {
              blockLines.push(bl);
              j++;
              continue;
            }
            // Allow single blank lines within the block
            let peekIdx = j + 1;
            while (peekIdx < lines.length && lines[peekIdx].trim() === '') peekIdx++;
            const blankCount = peekIdx - j;
            if (blankCount >= 2 || peekIdx >= lines.length) break;
            const peekLine = lines[peekIdx];
            const peekTrimmed = peekLine.trim();
            if (!/^\s+\S/.test(peekLine)) break;
            // Break at next file heading boundary
            if (isBoldFileHeading(peekTrimmed)) break;
            // Break at centered headings (deeply indented non-code content,
            // e.g. "                 2) Containerize it ..." section headings
            // or "                           Optional: Ingress" title headings).
            // Code panel content typically has 1-8 spaces indent; centered
            // headings have 6+ and look like prose.  Only break when the line
            // has multiple words and no code-like characters — deeply indented
            // code (Rust assert_eq!, XML tags, nested blocks) must not break.
            // Also break when the line looks like a section title with a colon
            // (e.g. "Optional: Ingress") — these match looksLikeYaml but are
            // clearly headings, not YAML data.
            const peekIndent = peekLine.match(/^(\s*)/)?.[1].length ?? 0;
            const peekWords = peekTrimmed.split(/\s+/).length;
            // Detect centered titles: "Optional: Ingress", "1) Deploy to K8s",
            // "Step 2: Configure", "3. Deploy to Kubernetes"
            const isCenteredTitle =
              peekIndent > 6 &&
              peekWords >= 2 &&
              !looksLikeShellOrDockerCodeLine(peekTrimmed) &&
              (/^[A-Z][\w]*:\s+\S/.test(peekTrimmed) ||
                /^\d+[.)]\s+\S/.test(peekTrimmed) ||
                /^Step\s+\d+/i.test(peekTrimmed)) &&
              peekWords <= 8;
            if (
              isCenteredTitle ||
              (peekIndent > 6 &&
                peekWords >= PROSE_WORD_THRESHOLD &&
                !looksLikeShellOrDockerCodeLine(peekTrimmed) &&
                !looksLikeYaml(peekTrimmed) &&
                !/[{};=<>[\]]/.test(peekTrimmed)) ||
              // Also break at prose-like headings at any indent level
              // (e.g. "  Build + push (example with Docker Hub):" at 2-space indent)
              (peekWords >= PROSE_WORD_THRESHOLD &&
                !looksLikeShellOrDockerCodeLine(peekTrimmed) &&
                !looksLikeYaml(peekTrimmed) &&
                !/[{};=<>[\].$`"'\\|@#!]/.test(peekTrimmed) &&
                !/--\w/.test(peekTrimmed))
            )
              break;
            blockLines.push(bl);
            j++;
            continue;
          }
          if (!/^\s+\S/.test(bl)) break;
          // Break at next bold file heading (e.g. " src/main.rs" after Cargo.toml panel)
          if (isBoldFileHeading(bt)) break;

          // Inside a YAML literal/folded block scalar: include all lines
          // that are indented deeper than the indicator line.
          if (inLiteralBlock) {
            const curIndent = bl.match(/^(\s*)/)?.[1].length ?? 0;
            if (curIndent > literalBlockIndent) {
              blockLines.push(bl);
              j++;
              continue;
            }
            // Indentation dropped — exit literal block
            inLiteralBlock = false;
          }

          // Also break at centered headings appearing directly (no blank line)
          // but only when it actually looks like prose (many words, no code chars)
          // or a short title heading like "Optional: Ingress"
          const lineIndent = bl.match(/^(\s*)/)?.[1].length ?? 0;
          const lineWords = bt.split(/\s+/).length;
          const isDirectCenteredTitle =
            lineIndent > 6 &&
            lineWords >= 2 &&
            !looksLikeShellOrDockerCodeLine(bt) &&
            (/^[A-Z][\w]*:\s+\S/.test(bt) || /^\d+[.)]\s+\S/.test(bt) || /^Step\s+\d+/i.test(bt)) &&
            lineWords <= 8;
          // Break at prose-like lines (many words, no code/YAML patterns).
          // These may appear at any indent level — Rich terminal bold headings
          // like "Build + push (example with Docker Hub):" have just 2 spaces.
          // Exclude lines with code-like chars (flags, operators, braces, dots)
          // to avoid breaking multiline strings and Makefile targets.
          const isProseHeading =
            lineWords >= PROSE_WORD_THRESHOLD &&
            !looksLikeShellOrDockerCodeLine(bt) &&
            !looksLikeYaml(bt) &&
            !/[{};=<>[\].$`"'\\|@#!]/.test(bt) &&
            !/--\w/.test(bt);
          if (isDirectCenteredTitle || isProseHeading) break;
          blockLines.push(bl);
          // Track start of YAML literal/folded block scalar (e.g. "key: |")
          if (/[|>][-+]?\d?\s*$/.test(bt)) {
            inLiteralBlock = true;
            literalBlockIndent = lineIndent;
          }
          j++;
        }
        // Trim trailing blank lines
        while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '') {
          blockLines.pop();
        }
        if (blockLines.length > 0) {
          result.push('```');
          for (const bl of blockLines) result.push(bl);
          result.push('```');
          i = j;
          continue;
        }
      }
      continue;
    }

    // Also start indented code blocks when panel content (1–4 space indent)
    // looks like YAML data (key: value, - item, etc.).  Deeper indentation
    // (centered headings at 6+ spaces) is excluded to avoid false positives.
    // Ordered list items (e.g. " 1 Create...", " 2 Apply...") are excluded.
    const lineIndentN = line.match(/^(\s*)/)?.[1].length ?? 0;
    if (
      /^\s+\S/.test(line) &&
      !/^\s*\d+\s+\S/.test(line) &&
      (looksLikeShellOrDockerCodeLine(trimmed) ||
        isFileHeaderComment(trimmed) ||
        (lineIndentN <= 4 && looksLikeYaml(trimmed) && trimmed !== '---'))
    ) {
      // Don't wrap indented lines that are Python function/class/if bodies.
      // If the previous non-blank line is an unindented Python block opener
      // (e.g. "def index():", "if __name__:"), this line is part of its body
      // and should be left for wrapBareCodeBlocks to handle as one block.
      let prevNonBlankLine = '';
      for (let p = i - 1; p >= 0; p--) {
        const pt = lines[p].trim();
        if (pt !== '' && !/^```/.test(pt)) {
          prevNonBlankLine = lines[p];
          break;
        }
      }
      const prevTrim = prevNonBlankLine.trim();
      // Check if previous non-blank line is a block opener — either
      // Python-style (ends with :) or C-family (ends with {).
      // If so, this indented line is a body continuation and should
      // be left for wrapBareCodeBlocks to handle as one unified block.
      const prevIsBlockOpener =
        prevTrim !== '' &&
        /[{:]\s*$/.test(prevTrim) &&
        !/^\s+/.test(prevNonBlankLine) &&
        looksLikeShellOrDockerCodeLine(prevTrim);
      if (prevIsBlockOpener) {
        // Leave for wrapBareCodeBlocks to handle
        result.push(line);
        i++;
        continue;
      }

      const blockLines: string[] = [];
      let j = i;
      let codeLikeLineCount = 0;
      const baseIndent = line.match(/^(\s*)/)?.[1].length ?? 0;
      // Track whether this block was started by a file header comment
      // (e.g. "# Cargo.toml"): if so, we collect ALL space-prefixed lines
      // regardless of whether they match looksLikeShellOrDockerCodeLine,
      // since the content may be TOML, INI, or other config that has no
      // shell/Dockerfile syntax markers.
      const startedByFileHeader = isFileHeaderComment(trimmed);
      if (startedByFileHeader) {
        codeLikeLineCount++; // count the file header itself
      }

      while (j < lines.length) {
        const blockLine = lines[j];
        const blockTrimmed = blockLine.trim();

        if (blockTrimmed === '') {
          // Peek ahead: if next non-blank line isn't code-like, stop here
          let peekIdx = j + 1;
          while (peekIdx < lines.length && lines[peekIdx].trim() === '') peekIdx++;

          const trimTrailingBlanks = () => {
            while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '') {
              blockLines.pop();
            }
          };

          if (peekIdx < lines.length) {
            const peekTrimmed = lines[peekIdx].trim();
            const peekLine = lines[peekIdx];
            // Break at file-type boundaries: a blank line followed by a
            // "file header" comment (e.g. "# Cargo.toml", "// src/main.rs")
            // signals a transition to different file content.
            if (isFileHeaderComment(peekTrimmed)) {
              trimTrailingBlanks();
              break;
            }
            // For file-header blocks (started by e.g. "# Cargo.toml"):
            // allow blank lines within the block (config/source files
            // often contain them), but break if the next content is no
            // longer space-prefixed (left the terminal code area) or
            // two consecutive blank lines were found.
            if (startedByFileHeader) {
              const blankLineCount = peekIdx - j;
              if (blankLineCount >= 2 || !/^\s+\S/.test(peekLine)) {
                trimTrailingBlanks();
                break;
              }
            } else if (!looksLikeShellOrDockerCodeLine(peekTrimmed)) {
              // Non-file-header blocks: break when peek line doesn't look like code.
              trimTrailingBlanks();
              break;
            }
          } else if (startedByFileHeader) {
            trimTrailingBlanks();
            break;
          }
          blockLines.push(blockLine);
          j++;
          continue;
        }

        if (!/^\s+\S/.test(blockLine)) {
          break;
        }

        // Stop at prose lines: if the trimmed content is long (5+ words),
        // doesn't look like code/YAML, and isn't a continuation of the
        // previous code, it's likely a wrapped bold heading or description
        // (e.g. "Kubernetes manifests (Namespace + ConfigMap + ...)").
        const blockWords = blockTrimmed.split(/\s+/).length;
        if (
          !startedByFileHeader &&
          blockWords >= PROSE_WORD_THRESHOLD &&
          !looksLikeShellOrDockerCodeLine(blockTrimmed) &&
          !looksLikeYaml(blockTrimmed)
        ) {
          break;
        }

        // Stop at heavily-indented non-code lines (centered headings)
        // Skip this check for file-header blocks since config/YAML files
        // commonly have deep indentation.
        const lineIndent = blockLine.match(/^(\s*)/)?.[1].length ?? 0;
        if (
          !startedByFileHeader &&
          lineIndent > baseIndent + 4 &&
          !looksLikeShellOrDockerCodeLine(blockTrimmed)
        ) {
          break;
        }

        if (looksLikeShellOrDockerCodeLine(blockTrimmed)) {
          codeLikeLineCount++;
        }

        blockLines.push(blockLine);
        j++;
      }

      // Trim trailing blank lines from the block
      while (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '') {
        blockLines.pop();
      }

      if (codeLikeLineCount >= 1) {
        // Don't wrap small fragments if they're surrounded by YAML-like content.
        // Terminal line wrapping (80 chars) can split long YAML comments into
        // fragments that look like shell code (e.g. "call /api/*" from a split
        // "# ... this would call /api/*").  Wrapping these fragments in code
        // fences breaks the surrounding YAML block.
        let prevContentTrimmed = '';
        for (let p = i - 1; p >= 0; p--) {
          const pt = lines[p].trim();
          if (pt !== '' && !/^```/.test(pt)) {
            prevContentTrimmed = pt;
            break;
          }
        }
        let nextContentTrimmed = '';
        for (let n = j; n < lines.length; n++) {
          const nt = lines[n].trim();
          if (nt !== '') {
            nextContentTrimmed = nt;
            break;
          }
        }
        const prevIsYaml = prevContentTrimmed !== '' && looksLikeYaml(prevContentTrimmed);
        const nextIsYaml = nextContentTrimmed !== '' && looksLikeYaml(nextContentTrimmed);
        // Previous line ends with |, |-, |+, >-, |2, etc. → YAML literal/folded
        // block scalar; all indented lines that follow are scalar content.
        const prevIsLiteralBlockIndicator = /[|>][-+]?\d?\s*$/.test(prevContentTrimmed);
        const isFragmentInsideYaml =
          (codeLikeLineCount <= 2 && prevIsYaml && nextIsYaml) || prevIsLiteralBlockIndicator;

        if (!isFragmentInsideYaml) {
          const nonBlank = blockLines.filter(l => l.trim() !== '');
          const minIndent = nonBlank.reduce((min, l) => {
            const indent = l.match(/^(\s*)/)?.[1].length ?? 0;
            return Math.min(min, indent);
          }, Infinity);
          const shift = minIndent === Infinity ? 0 : minIndent;
          const dedented = blockLines.map(l => (l.trim() === '' ? '' : l.slice(shift)));
          result.push('```');
          result.push(...dedented);
          result.push('```');
          wrappedCodeBlockCount++;
          i = j;
          continue;
        } else {
          // Inside YAML context — don't wrap, but advance past all collected
          // block lines to prevent re-processing individual lines.
          result.push(...blockLines);
          i = j;
          continue;
        }
      }
    }

    result.push(line);
    i++;
  }

  if (orderedListCount > 0 || trimmedHeadingCount > 0 || wrappedCodeBlockCount > 0) {
    verboseLog(
      '[AKS Agent Parse] normalizeTerminalMarkdown: converted',
      orderedListCount,
      'ordered-list lines, trimmed',
      trimmedHeadingCount,
      'heading lines, wrapped',
      wrappedCodeBlockCount,
      'code blocks'
    );
  }

  return result.join('\n');
}

/**
 * Check whether a trimmed line looks like YAML content (key-value,
 * list item, comment, flow-mapping shorthand, etc.).
 */
function looksLikeYaml(trimmed: string): boolean {
  if (trimmed === '' || trimmed.startsWith('#')) return true;
  // YAML document separator (exactly ---) and document end marker (exactly ...)
  if (trimmed === '---' || trimmed === '...') return true;
  // key: or key:  (with optional value)
  if (/^[\w][\w.\/-]*:\s?/.test(trimmed)) return true;
  // quoted key
  if (/^["'][^"']+["']:\s?/.test(trimmed)) return true;
  // list item:  - something
  if (/^-\s/.test(trimmed) || trimmed === '-') return true;
  // flow mapping/sequence opener: { ... } or [ ... ]
  if (/^[{\[]/.test(trimmed)) return true;
  // flow mapping/sequence closer: } or ] (continuation from previous line)
  if (/^[}\]]/.test(trimmed)) return true;
  // Quoted scalar value (e.g. "http://..." on its own line after key:)
  if (/^["'][^"']*["']$/.test(trimmed)) return true;
  // continuation value (indented scalar, e.g. multiline string)
  return false;
}

/**
 * Detect contiguous blocks of bare YAML (not already inside markdown code
 * fences) and wrap each one in ```yaml / ``` so that ReactMarkdown routes
 * them through CodeComponent → YamlDisplay.
 *
 * The detection starts when a line matching `apiVersion:` is found outside
 * of a code fence. It then collects all following YAML-shaped lines (or
 * single blank lines) and stops at two consecutive blanks or a line that
 * is clearly not YAML.
 */

/**
 * Join a YAML continuation value onto the previous line in `yamlLines`.
 * Returns true if the line was joined, false otherwise.
 * Handles: key: on one line + "value" on next; unclosed { or [ flow expressions.
 */
function joinYamlContinuation(yamlLines: string[], trimmedLine: string): boolean {
  if (yamlLines.length === 0) return false;
  const prev = yamlLines[yamlLines.length - 1].trim();
  const prevEndsWithColon = /:\s*$/.test(prev);
  const openBraces = prev.split('{').length - prev.split('}').length;
  const openBrackets = prev.split('[').length - prev.split(']').length;
  const prevUnclosed = openBraces > 0 || openBrackets > 0;
  const lineIsQuotedOrCloser = /^["']/.test(trimmedLine) || /^[}\]]/.test(trimmedLine);
  // A bare word value like "Kustomization" after "kind:" — single token, no colon
  const lineIsBareValue = /^\w[\w./-]*$/.test(trimmedLine) && !trimmedLine.includes(':');

  if (
    (prevEndsWithColon && (lineIsQuotedOrCloser || lineIsBareValue)) ||
    (prevUnclosed && lineIsQuotedOrCloser)
  ) {
    yamlLines[yamlLines.length - 1] = yamlLines[yamlLines.length - 1].trimEnd() + ' ' + trimmedLine;
    return true;
  }
  return false;
}

function wrapBareYamlBlocks(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;
  let inCodeFence = false;
  let wrappedBlockCount = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track existing code fences
    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      result.push(line);
      i++;
      continue;
    }
    if (inCodeFence) {
      result.push(line);
      i++;
      continue;
    }

    // Detect start of a bare YAML block: apiVersion: (with optional value)
    // Skip if the previous non-blank line is a heredoc operator (cat <<EOF, etc.)
    // — the YAML content is part of the heredoc body, not a standalone YAML block.
    let prevNonBlankForHeredoc = '';
    for (let p = i - 1; p >= 0; p--) {
      if (lines[p].trim() !== '') {
        prevNonBlankForHeredoc = lines[p].trim();
        break;
      }
    }
    const insideHeredoc = /<<\s*['"]?\w+['"]?\s*$/.test(prevNonBlankForHeredoc);

    if (/^\s*apiVersion:\s*/.test(line) && !insideHeredoc) {
      verboseLog(
        '[AKS Agent Parse] wrapBareYamlBlocks: detected bare apiVersion: at line',
        i,
        ':',
        line.trim()
      );

      // Look back: include preceding YAML comment lines (# ...) and
      // document separators (---) that belong to this YAML block.
      // This handles the common pattern of section headers before apiVersion.
      const prefixLines: string[] = [];
      let backIdx = result.length - 1;
      // Skip trailing blank lines
      while (backIdx >= 0 && result[backIdx].trim() === '') backIdx--;
      // Collect YAML comments / separators going backwards
      while (backIdx >= 0) {
        const bt = result[backIdx].trim();
        if (bt.startsWith('#') || bt === '---') {
          prefixLines.unshift(result[backIdx]);
          backIdx--;
        } else {
          break;
        }
      }
      // Remove the prefix lines from result (they'll go inside the fence)
      if (prefixLines.length > 0) {
        // First remove the prefix lines themselves
        for (let p = 0; p < prefixLines.length; p++) {
          result.pop();
        }
        // Then remove trailing blank lines, keeping one for readability
        while (result.length > 0 && result[result.length - 1].trim() === '') {
          result.pop();
        }
        if (result.length > 0) {
          result.push('');
        }
      }

      const yamlLines: string[] = [...prefixLines];
      let j = i;
      let consecutiveBlanks = 0;

      // Track base indentation of the apiVersion: line so we can stop the
      // block when the indent drops below it (e.g. prose like "Apply:" at
      // column 0 after indented YAML).
      const baseIndent = line.match(/^(\s*)/)?.[1].length ?? 0;

      // Track YAML literal/folded block scalars (| or >) — all content
      // indented deeper than the indicator line is part of the scalar value,
      // regardless of content (may contain Python, shell, etc.).
      let inLiteralBlock = false;
      let literalBlockIndent = 0;

      while (j < lines.length) {
        const yl = lines[j];
        const yt = yl.trim();

        if (yt === '') {
          // Inside a YAML literal/folded block scalar (| or >): blank lines
          // are part of the scalar content and should NOT count toward
          // the "two consecutive blank lines = end of block" rule.
          if (inLiteralBlock) {
            yamlLines.push(yl);
            j++;
            continue;
          }
          consecutiveBlanks++;
          if (consecutiveBlanks >= 2) break; // two blank lines = end of block
          yamlLines.push(yl);
          j++;
          continue;
        }
        consecutiveBlanks = 0;

        // Inside a YAML literal/folded block scalar (| or >): include
        // lines that are indented deeper than the indicator, regardless
        // of their content (they may be Python, shell, etc.).
        if (inLiteralBlock) {
          const lineIndent = yl.match(/^(\s*)/)?.[1].length ?? 0;
          if (lineIndent > literalBlockIndent) {
            yamlLines.push(yl);
            j++;
            continue;
          }
          // Indentation dropped — exit literal block
          inLiteralBlock = false;
        }

        // Check indentation: a non-blank line with less indent than the
        // base apiVersion: line is outside the YAML block, UNLESS it's a
        // YAML document separator (---).
        const lineIndent = yl.match(/^(\s*)/)?.[1].length ?? 0;
        if (j !== i && lineIndent < baseIndent && yt !== '---') {
          break;
        }

        if (j === i || looksLikeYaml(yt)) {
          // Check if this is a YAML value that should be joined to the
          // previous key line (terminal line wrapping split key: value)
          if (joinYamlContinuation(yamlLines, yt)) {
            // Joined to previous line
          } else {
            yamlLines.push(yl);
          }
          // Track start of literal/folded block scalar (e.g. "- |" or "key: |")
          // Also matches chomping indicators (|-, |+, >-) and explicit indent (|2, >2)
          if (/[|>][-+]?\d?\s*$/.test(yt)) {
            inLiteralBlock = true;
            literalBlockIndent = yl.match(/^(\s*)/)?.[1].length ?? 0;
          }
          j++;
        } else {
          // Check if this line is a YAML value continuation:
          // - Previous line ended with ':' (key with value on next line)
          // - Previous line had unclosed braces/brackets (flow expression continues)
          if (joinYamlContinuation(yamlLines, yt)) {
            j++;
          } else {
            // Peek ahead: if the next non-blank line looks like YAML,
            // this line may be a terminal line-wrap fragment — include it
            // to avoid breaking the YAML block.
            // However, if there's a blank line between this line and the
            // next YAML, this is a prose paragraph separator — NOT a terminal
            // wrap — so stop the YAML block here.
            let peekIdx = j + 1;
            const hasBlankBefore = peekIdx < lines.length && lines[peekIdx].trim() === '';
            while (peekIdx < lines.length && lines[peekIdx].trim() === '') peekIdx++;
            const peekTrimmed = peekIdx < lines.length ? lines[peekIdx].trim() : '';
            if (peekTrimmed !== '' && looksLikeYaml(peekTrimmed) && !hasBlankBefore) {
              yamlLines.push(yl);
              j++;
            } else {
              break;
            }
          }
        }
      }

      // Trim trailing blank lines from the YAML block
      while (yamlLines.length > 0 && yamlLines[yamlLines.length - 1].trim() === '') {
        yamlLines.pop();
      }

      if (yamlLines.length > 0) {
        // Dedent: strip the common leading whitespace (from Rich's 1-space padding)
        const nonBlank = yamlLines.filter(l => l.trim() !== '');
        const minIndent = nonBlank.reduce((min, l) => {
          const indent = l.match(/^(\s*)/)?.[1].length ?? 0;
          return Math.min(min, indent);
        }, Infinity);
        const shift = minIndent === Infinity ? 0 : minIndent;
        const dedented = yamlLines.map(l => (l.trim() === '' ? '' : l.slice(shift)));

        result.push('```yaml');
        result.push(...dedented);
        result.push('```');
        wrappedBlockCount++;
        i = j;
      } else {
        result.push(line);
        i++;
      }
    } else if (
      // Detect start of a bare non-K8s YAML block: a key: value line at
      // column 0 that isn't apiVersion but looks like YAML, followed by
      // enough YAML-like lines to be confident it's structured YAML and
      // not prose.  This catches Helm values.yaml, Ansible playbooks, etc.
      !inCodeFence &&
      !insideHeredoc &&
      trimmed !== '' &&
      !/^\s+/.test(line) &&
      /^[\w][\w.\/-]*:\s?/.test(trimmed) &&
      !looksLikeShellOrDockerCodeLine(trimmed) &&
      // Reject prose sentences that happen to start with "Word: ..." — real YAML
      // values are short (key: value), not long English sentences.  Count the
      // words after the colon; if there are many, it's prose, not YAML.
      (trimmed.match(/:\s+(.*)/)?.[1]?.split(/\s+/).length ?? 0) < PROSE_WORD_THRESHOLD
    ) {
      // Peek ahead to count consecutive YAML-like lines
      let peek = i;
      let yamlLineCount = 0;
      while (peek < lines.length) {
        const pt = lines[peek].trim();
        if (pt === '') {
          // Allow single blank lines
          let nextNonBlank = peek + 1;
          while (nextNonBlank < lines.length && lines[nextNonBlank].trim() === '') nextNonBlank++;
          if (nextNonBlank - peek >= 2) break; // 2+ blanks = end
          if (nextNonBlank < lines.length && looksLikeYaml(lines[nextNonBlank].trim())) {
            peek++;
            continue;
          }
          break;
        }
        if (!looksLikeYaml(pt)) break;
        // Reject prose sentences that start with "Word: long sentence" — the
        // PROSE_WORD_THRESHOLD check on the initial line must also apply to
        // continuation lines within the peek loop.
        if (
          /^[\w][\w.\/-]*:\s+/.test(pt) &&
          (pt.match(/:\s+(.*)/)?.[1]?.split(/\s+/).length ?? 0) >= PROSE_WORD_THRESHOLD
        )
          break;
        yamlLineCount++;
        peek++;
      }
      // Require 3+ YAML-like lines to wrap as yaml (avoid false positives
      // on single key: value lines that are prose descriptions).
      const MIN_YAML_LINES = 3;
      if (yamlLineCount >= MIN_YAML_LINES) {
        const yamlLines: string[] = [];
        let j = i;
        while (j < peek) {
          yamlLines.push(lines[j]);
          j++;
        }
        // Trim trailing blank lines
        while (yamlLines.length > 0 && yamlLines[yamlLines.length - 1].trim() === '') {
          yamlLines.pop();
        }
        if (yamlLines.length > 0) {
          result.push('```yaml');
          result.push(...yamlLines);
          result.push('```');
          wrappedBlockCount++;
          i = j;
        } else {
          result.push(line);
          i++;
        }
      } else {
        result.push(line);
        i++;
      }
    } else if (
      // Detect start of a bare YAML list block: "- key: value" or "- item"
      // at column 0 outside a code fence, followed by enough YAML-like
      // lines to be confident it's structured YAML and not prose.
      !inCodeFence &&
      trimmed !== '' &&
      !/^\s+/.test(line) &&
      /^-\s+/.test(trimmed) &&
      !looksLikeShellOrDockerCodeLine(trimmed)
    ) {
      // Peek ahead to count consecutive YAML-like lines
      let peek = i;
      let yamlLineCount = 0;
      while (peek < lines.length) {
        const pt = lines[peek].trim();
        if (pt === '') {
          let nextNonBlank = peek + 1;
          while (nextNonBlank < lines.length && lines[nextNonBlank].trim() === '') nextNonBlank++;
          if (nextNonBlank - peek >= 2) break;
          if (nextNonBlank < lines.length && looksLikeYaml(lines[nextNonBlank].trim())) {
            peek++;
            continue;
          }
          break;
        }
        if (!looksLikeYaml(pt)) break;
        yamlLineCount++;
        peek++;
      }
      const MIN_YAML_LINES = 3;
      if (yamlLineCount >= MIN_YAML_LINES) {
        const yamlLines: string[] = [];
        let j = i;
        while (j < peek) {
          yamlLines.push(lines[j]);
          j++;
        }
        while (yamlLines.length > 0 && yamlLines[yamlLines.length - 1].trim() === '') {
          yamlLines.pop();
        }
        if (yamlLines.length > 0) {
          result.push('```yaml');
          result.push(...yamlLines);
          result.push('```');
          wrappedBlockCount++;
          i = j;
        } else {
          result.push(line);
          i++;
        }
      } else {
        result.push(line);
        i++;
      }
    } else {
      result.push(line);
      i++;
    }
  }

  if (wrappedBlockCount > 0) {
    verboseLog(
      '[AKS Agent Parse] wrapBareYamlBlocks: wrapped',
      wrappedBlockCount,
      'bare YAML blocks'
    );
  }

  return result.join('\n');
}

/**
 * Check if any line in the collected code block contains patterns from a
 * structured language (Python, Rust, Go, etc.) that uses indentation for
 * function/class/block bodies.  Used by wrapBareCodeBlocks to decide
 * whether to keep collecting indented continuation lines.
 */
function hasStructuredCodeContext(codeLines: string[]): boolean {
  return codeLines.some(l => {
    const t = l.trim();
    return (
      // Python
      /^(from|import|def|class)\s/.test(t) ||
      /^@\w/.test(t) ||
      /__\w+__/.test(t) ||
      // Rust
      /^(pub(\s*\(\s*crate\s*\))?\s+)?(async\s+)?fn\s/.test(t) ||
      /^(pub(\s*\(\s*crate\s*\))?\s+)?use\s/.test(t) ||
      /^let\s/.test(t) ||
      /^(pub(\s*\(\s*crate\s*\))?\s+)?(struct|enum|impl|trait|mod)\s/.test(t) ||
      /^#\[/.test(t) ||
      // Go
      /^(func|package)\s/.test(t) ||
      /^(var|type)\s+\w+\s+\w+/.test(t) ||
      /\w+\s*:=\s*\S/.test(t) ||
      /^(if|for|switch|select)\s+.+\{/.test(t)
    );
  });
}

/**
 * Detect contiguous blocks of bare shell/Docker commands (not already inside
 * markdown code fences and not indented) and wrap each one in ``` fences so
 * that ReactMarkdown renders them as code blocks.
 *
 * This handles the case where the AI response includes bare commands like
 *   curl http://localhost:8080
 *   kubectl apply -f deploy.yaml
 * that are not indented (so normalizeTerminalMarkdown doesn't catch them)
 * and are not YAML (so wrapBareYamlBlocks doesn't catch them).
 *
 * Detection starts when a non-blank, non-indented line matches
 * looksLikeShellOrDockerCodeLine(). It collects consecutive code lines
 * (allowing single blank lines between them) and wraps them in ``` fences.
 */
function wrapBareCodeBlocks(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let i = 0;
  let inCodeFence = false;
  let wrappedBlockCount = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Track existing code fences
    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      result.push(line);
      i++;
      continue;
    }
    if (inCodeFence) {
      result.push(line);
      i++;
      continue;
    }

    // Detect start of a bare code block: non-blank, non-indented, looks like code
    // Exclude lines that start with # (could be markdown headings) unless they
    // match a Dockerfile directive or shell comment with URL/path
    //
    // Also detect Makefile targets: bare "word:" (no value after colon) followed
    // by a tab-indented continuation line.  These look like YAML to looksLikeYaml
    // but are actually code (Makefile recipes).
    const isMakefileTarget =
      /^[\w.-]+:\s*$/.test(trimmed) && i + 1 < lines.length && /^\t/.test(lines[i + 1]);
    if (
      trimmed !== '' &&
      !/^\s+/.test(line) &&
      (isMakefileTarget || (looksLikeShellOrDockerCodeLine(trimmed) && !looksLikeYaml(trimmed)))
    ) {
      const codeLines: string[] = [];
      let j = i;

      // Track heredoc delimiter: if the starting line contains <<WORD, collect
      // everything (including YAML-looking content) until the delimiter is found.
      const heredocMatch = trimmed.match(/<<[-~]?\s*['"]?(\w+)['"]?\s*$/);
      const heredocDelimiter = heredocMatch?.[1] ?? null;

      while (j < lines.length) {
        const cl = lines[j];
        const ct = cl.trim();

        // Inside a heredoc: collect everything until the closing delimiter.
        if (heredocDelimiter) {
          codeLines.push(cl);
          j++;
          if (ct === heredocDelimiter) break; // closing delimiter found
          continue;
        }

        // Allow single blank lines within a code block
        if (ct === '') {
          // Peek ahead: if next non-blank line is also code, keep collecting
          let peekIdx = j + 1;
          while (peekIdx < lines.length && lines[peekIdx].trim() === '') peekIdx++;
          if (peekIdx < lines.length) {
            const peekTrimmed = lines[peekIdx].trim();
            const peekIsIndented = /^\s+/.test(lines[peekIdx]);
            // Break at file-type boundaries (e.g. "# Cargo.toml",
            // "// src/main.rs") to avoid merging different file contents.
            if (isFileHeaderComment(peekTrimmed)) {
              break;
            }
            // In Python context, allow blank lines followed by indented
            // continuation (function/class body) or by the next top-level
            // Python statement.
            const hasCodeCtx = hasStructuredCodeContext(codeLines);
            if (
              looksLikeShellOrDockerCodeLine(peekTrimmed) &&
              !looksLikeYaml(peekTrimmed) &&
              (!peekIsIndented || hasCodeCtx)
            ) {
              codeLines.push(cl);
              j++;
              continue;
            }
          }
          break;
        }

        // Stop if line is indented (belongs to different formatting)
        // UNLESS we are inside a Python code block — Python uses indentation
        // for function/class bodies (e.g. the body of `def index():`)
        // Also allow tab-indented Makefile recipe lines.
        if (/^\s+/.test(cl)) {
          if (hasStructuredCodeContext(codeLines) || (isMakefileTarget && /^\t/.test(cl))) {
            codeLines.push(cl);
            j++;
            continue;
          }
          break;
        }

        // Stop if line doesn't look like code
        // Exception: a lone closing brace `}` also matches looksLikeYaml
        // (YAML flow mapping closer), but in structured code context
        // (Rust/Go/C) it's a block closer and should stay in the code block.
        // Exception: Makefile targets ("word:") in a Makefile block.
        if (!looksLikeShellOrDockerCodeLine(ct) || looksLikeYaml(ct)) {
          if (/^\}\s*;?\s*$/.test(ct) && hasStructuredCodeContext(codeLines)) {
            codeLines.push(cl);
            j++;
            continue;
          }
          if (isMakefileTarget && /^[\w.-]+:\s*$/.test(ct)) {
            codeLines.push(cl);
            j++;
            continue;
          }
          break;
        }

        codeLines.push(cl);
        j++;
      }

      // Trim trailing blank lines
      while (codeLines.length > 0 && codeLines[codeLines.length - 1].trim() === '') {
        codeLines.pop();
      }

      if (codeLines.length > 0) {
        result.push('```');
        result.push(...codeLines);
        result.push('```');
        wrappedBlockCount++;
        i = j;
        continue;
      }
    }

    result.push(line);
    i++;
  }

  if (wrappedBlockCount > 0) {
    verboseLog(
      '[AKS Agent Parse] wrapBareCodeBlocks: wrapped',
      wrappedBlockCount,
      'bare code blocks'
    );
  }

  return result.join('\n');
}

/**
 * Clean up Rich terminal UI decorations and terminal line-padding:
 *  - Remove Rich panel border lines  (┏━━━┓ / ┗━━━┛)
 *  - Unwrap Rich panel content lines (┃  text  ┃  →  text)
 *  - Trim trailing whitespace that the terminal pads every line to 80 chars
 *  - Restore newlines between terminal lines that were concatenated without \n
 *    (terminal auto-wrap leaves no explicit newline at column 80)
 */
function cleanTerminalFormatting(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inCodeFence = false;
  let droppedBorders = 0;
  let unwrappedPanels = 0;

  for (const line of lines) {
    const rTrimmed = line.trimEnd(); // trailing 80-char padding removed

    // Track code-fence boundaries — never alter content inside fences
    if (/^\s*```/.test(rTrimmed)) {
      inCodeFence = !inCodeFence;
      result.push(rTrimmed);
      continue;
    }
    if (inCodeFence) {
      result.push(rTrimmed);
      continue;
    }

    const stripped = rTrimmed.trimStart(); // leading indentation removed (for box detection only)

    // Drop Rich panel border lines — may be indented: ┏━━━━┓ and ┗━━━━┛
    if (/^[┏┗][━\s]*[┓┛]$/.test(stripped)) {
      droppedBorders++;
      continue;
    }

    // Drop Rich horizontal rule lines — only pure box-drawing chars, at least 4 wide
    if (/^[─━═]{4,}$/.test(stripped)) {
      droppedBorders++;
      continue;
    }

    // Unwrap Rich panel content lines — preserve internal indentation
    // ┃   text   ┃  →  text  (trimming only the outer box characters + 1 space padding)
    if (stripped.startsWith('┃')) {
      const inner = stripped
        .replace(/^┃\s?/, '') // remove leading ┃ and at most one space
        .replace(/\s?┃$/, ''); // remove trailing ┃ and at most one space
      if (inner) {
        unwrappedPanels++;
        result.push(inner);
      }
      continue;
    }

    result.push(rTrimmed);
  }

  if (droppedBorders > 0 || unwrappedPanels > 0) {
    verboseLog(
      '[AKS Agent Parse] cleanTerminalFormatting: dropped',
      droppedBorders,
      'border lines, unwrapped',
      unwrappedPanels,
      'panel lines'
    );
  }

  // Rejoin YAML keys split across lines by terminal wrapping.
  // e.g. "          averageUtilization\n : 70" → "          averageUtilization: 70"
  // This happens when a YAML key is too long for the 80-char terminal width
  // and the colon + value wraps to the next line.
  let rejoinedCount = 0;
  for (let idx = 0; idx < result.length - 1; idx++) {
    const cur = result[idx];
    const next = result[idx + 1];
    // Current line ends with a bare word (no colon) and is space-indented
    // Next line starts with optional space + colon (for key-only YAML like "metadata:")
    // or colon + space + value (e.g. ": 70" from "averageUtilization\n: 70")
    if (/^\s+[\w.-]+$/.test(cur) && (/^\s*:\s*\S/.test(next) || /^\s*:$/.test(next))) {
      result[idx] = cur + next.replace(/^\s*/, '');
      result.splice(idx + 1, 1);
      rejoinedCount++;
    }
  }
  if (rejoinedCount > 0) {
    verboseLog(
      '[AKS Agent Parse] cleanTerminalFormatting: rejoined',
      rejoinedCount,
      'split YAML key-value lines'
    );
  }

  return result.join('\n');
}

/**
 * Patterns that match agent infrastructure / tool-call noise lines.
 * These lines are emitted by the aks-agent CLI during processing and
 * should never appear in the final user-visible answer.
 */
const AGENT_NOISE_PATTERNS: RegExp[] = [
  // Shell prompt lines: root@aks-agent-...:...#
  /^root@[^:]*:[^#]*#/,
  // The python command we exec'd into the pod
  /^python\s+\/app\/aks-agent\.py/,
  // Task-list table decorations (borders, header, data rows, section header)
  // Matches +---+, +====+, and mixed variants like +-=+-+
  /^Task List:\s*$/,
  /^\+[-+=]+\+$/,
  /^\|\s*ID\s*\|/,
  /^\|\s*t\d+\s*\|/,
  // /show N hints
  /^\s*-\s*\/show\s+\d+\s+to view contents/,
  // Echo of the user's question (User: ...)
  /^User:\s+/,
  // Echo of assistant's answer from conversation history
  /^Assistant:\s+/,
  // Enriched prompt markers from echoed command
  /^IMPORTANT INSTRUCTIONS:\s*$/,
  /^---\s*(CONVERSATION HISTORY|END OF CONVERSATION HISTORY)\s*---\s*$/,
  /^Now answer the following new question:\s*$/,
  // Table remnant lines: only pipes, plus, dashes, equals, whitespace — must contain at
  // least one "+" to distinguish agent task-table borders (+---+---+) from GFM markdown
  // table separators (|---|---|) which must be preserved for proper table rendering.
  /^[\s|+=\-]*\+[\s|+=\-]*$/,
];

/** Return true if a trimmed line matches any agent-noise pattern. */
function isAgentNoiseLine(trimmedLine: string): boolean {
  return AGENT_NOISE_PATTERNS.some(re => re.test(trimmedLine));
}

/**
 * Strip all agent infrastructure noise from an array of lines.
 * Also collapses runs of consecutive blank lines into a single blank line.
 */
function stripAgentNoise(lines: string[]): string[] {
  const cleaned: string[] = [];
  let prevBlank = false;
  let inCodeFence = false;
  let droppedCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track code-fence boundaries — never strip lines inside fences
    if (/^```/.test(trimmed)) {
      inCodeFence = !inCodeFence;
      prevBlank = false;
      cleaned.push(line);
      continue;
    }
    if (inCodeFence) {
      cleaned.push(line);
      continue;
    }

    // Drop noise lines
    if (isAgentNoiseLine(trimmed)) {
      droppedCount++;
      verboseLog('[AKS Agent Parse] stripAgentNoise: dropping noise line:', trimmed);
      continue;
    }

    // Collapse multiple blank lines
    if (trimmed === '') {
      if (prevBlank) continue;
      prevBlank = true;
    } else {
      prevBlank = false;
    }

    cleaned.push(line);
  }

  if (droppedCount > 0) {
    verboseLog('[AKS Agent Parse] stripAgentNoise: dropped', droppedCount, 'noise lines total');
  }

  return cleaned;
}

/**
 * Remove the echoed command block from output lines.
 * When tty echo is active, the entire multi-line `python /app/aks-agent.py ask '…'`
 * command is echoed line-by-line.  The first line matches the python invocation and
 * subsequent lines are bash PS2 continuation prompt lines starting with "> ".
 * This helper strips that block so it doesn't leak into the extracted answer.
 */
function stripCommandEcho(lines: string[]): string[] {
  const cmdIdx = lines.findIndex(l => /python\s+\/app\/aks-agent\.py/.test(l));
  if (cmdIdx < 0) {
    verboseLog(
      '[AKS Agent Parse] stripCommandEcho: no python command line found, returning all lines'
    );
    return lines;
  }

  // Skip the command line and all subsequent bash continuation prompt lines
  let end = cmdIdx + 1;
  while (end < lines.length && /^\s*>/.test(lines[end])) {
    end++;
  }
  verboseLog(
    '[AKS Agent Parse] stripCommandEcho: found command at line',
    cmdIdx,
    '— stripping',
    end - cmdIdx,
    'lines (command + continuation prompts)'
  );

  return [...lines.slice(0, cmdIdx), ...lines.slice(end)];
}

/**
 * Extract the AI's final answer from the full raw exec output.
 * Finds the "AI:" line and returns everything after it, stripped of any
 * trailing bash prompt, agent tool-call noise, and Rich terminal decorations.
 * Converts Unicode bullets to markdown syntax.
 */
function extractAIAnswer(rawOutput: string): string {
  detailLog('[AKS Agent Parse] extractAIAnswer: raw input length:', rawOutput.length);

  // Split the raw output into terminal line chunks (each chunk = one terminal line)
  // and reassemble with proper \n separators, trimming 80-char padding as we go.
  const normalised = rawOutput
    .split('\n')
    .map(l => stripAnsi(l).trimEnd())
    .join('\n');

  const normalisedLines = normalised.split('\n');
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: normalised line count:',
    normalisedLines.length,
    'char count:',
    normalised.length
  );

  // Strip the echoed command block before parsing — when tty echo is on,
  // the entire multi-line command (including conversation history) is echoed
  // back through stdout as the python invocation line followed by bash
  // continuation prompt lines ("> ...").
  const lines = stripCommandEcho(normalisedLines);
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: after stripCommandEcho:',
    lines.length,
    'lines remaining'
  );

  // Locate the "AI:" line — it may be alone or have content after the colon
  const aiLineIdx = lines.findIndex(l => /^AI:\s*$/.test(l.trim()) || /^AI:\s+\S/.test(l));
  detailLog('[AKS Agent Parse] extractAIAnswer: AI: line index:', aiLineIdx);

  let contentLines: string[];

  if (aiLineIdx >= 0) {
    const aiLine = lines[aiLineIdx];

    if (/^AI:\s*$/.test(aiLine.trim())) {
      // "AI:" alone on its own line — content starts on the next line
      contentLines = lines.slice(aiLineIdx + 1);
      detailLog(
        '[AKS Agent Parse] extractAIAnswer: AI: on own line, content lines:',
        contentLines.length
      );
    } else {
      // "AI: content…" on the same line — strip the prefix and keep the rest
      contentLines = [aiLine.replace(/^AI:\s+/, ''), ...lines.slice(aiLineIdx + 1)];
      detailLog(
        '[AKS Agent Parse] extractAIAnswer: AI: with inline content, content lines:',
        contentLines.length
      );
    }
  } else {
    // Fallback: use all lines (will be cleaned below)
    contentLines = [...lines];
    detailLog('[AKS Agent Parse] extractAIAnswer: no AI: line found — using all lines as fallback');
  }

  // Strip agent infrastructure noise from content lines
  const beforeNoiseStrip = contentLines.length;
  contentLines = stripAgentNoise(contentLines);
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: stripAgentNoise removed',
    beforeNoiseStrip - contentLines.length,
    'lines'
  );

  // Drop trailing blank lines and bash-prompt line(s).
  const beforeTrim = contentLines.length;
  while (contentLines.length > 0) {
    const last = contentLines[contentLines.length - 1].trim();
    if (last === '' || /^root@/.test(last)) {
      contentLines.pop();
    } else {
      break;
    }
  }

  // Drop leading blank lines
  while (contentLines.length > 0 && contentLines[0].trim() === '') {
    contentLines.shift();
  }
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: trimmed',
    beforeTrim - contentLines.length,
    'leading/trailing blank/prompt lines, remaining:',
    contentLines.length
  );

  const joined = contentLines.join('\n').trim();
  detailLog('[AKS Agent Parse] extractAIAnswer: after trim, content length:', joined.length);

  const afterTerminal = cleanTerminalFormatting(joined);
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: after cleanTerminalFormatting, length:',
    afterTerminal.length
  );

  const afterCollapse = collapseTerminalBlankLines(afterTerminal);
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: after collapseTerminalBlankLines, length:',
    afterCollapse.length
  );

  const afterBullets = normalizeBullets(afterCollapse);
  const afterTerminalMarkdown = normalizeTerminalMarkdown(afterBullets);
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: after normalizeTerminalMarkdown, length:',
    afterTerminalMarkdown.length
  );
  const afterYamlWrap = wrapBareYamlBlocks(afterTerminalMarkdown);
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: after wrapBareYamlBlocks, length:',
    afterYamlWrap.length
  );
  const result = wrapBareCodeBlocks(afterYamlWrap);
  detailLog(
    '[AKS Agent Parse] extractAIAnswer: final result length:',
    result.length,
    'result:',
    result
  );

  if (!result) {
    detailLog('[AKS Agent Parse] extractAIAnswer: result is empty after all transforms');
  }

  // Dump raw→parsed as JSON strings for easy copy-paste into test cases
  dumpForTestCase('extractAIAnswer', rawOutput, result);

  return result;
}

// ─── Real-time thinking-step parser ──────────────────────────────────────────

/**
 * Convert a raw "Running tool #N ToolName: description" line into a
 * user-friendly label for the executing phase.
 */
function friendlyToolLabel(rawToolLine: string): string {
  const match = rawToolLine.match(/^Running tool\s+#\d+\s+(.+)/);
  if (!match) return 'Running tool';

  const toolPart = match[1].trim();

  if (/^call_kubectl/i.test(toolPart)) return null as any; // tracked via task table, skip
  if (/^TodoWrite/i.test(toolPart)) return null as any; // handled separately, skip
  if (/^web_search/i.test(toolPart)) return 'Searching the web';
  if (/^read_file|file_read/i.test(toolPart)) return 'Reading file';

  const colonIdx = toolPart.indexOf(':');
  const name = colonIdx > 0 ? toolPart.slice(0, colonIdx).trim() : toolPart;
  return `Running ${name}`;
}

/**
 * Extract a task description + status from a task-list table row.
 * Returns { content, status } or null.
 *
 * Input examples:
 *   `| t1 | List all pods across all namespaces in AKS cluster | [~] in_progress |`
 *   `| t2 | Filter pods whose name contains 'gadget'           | [✓] completed   |`
 *   `| t3 | Verify and present the matching pods                | [ ] pending     |`
 */
function extractTaskRow(
  line: string
): { content: string; status: 'pending' | 'in_progress' | 'completed' } | null {
  const m = line.match(
    /^\|\s*t\d+\s*\|\s*(.*?)\s*\|\s*\[(.)\]\s*(pending|in_progress|completed)\s*\|$/
  );
  if (!m) return null;
  const statusMap: Record<string, 'pending' | 'in_progress' | 'completed'> = {
    ' ': 'pending',
    '~': 'in_progress',
    '✓': 'completed',
  };
  return { content: m[1].trim(), status: statusMap[m[2]] || (m[3] as any) };
}

/**
 * State tracker for building thinking steps from streaming output.
 * Call `processLine()` for each new line and read `steps` for current state.
 *
 * Phases:
 *  init      – model loading, toolset loading
 *  planning  – TodoWrite task items (the actual investigation plan)
 *  executing – kubectl and other tool calls
 */
class ThinkingStepTracker {
  steps: AgentThinkingStep[] = [];
  private nextId = 1;
  /** Map of tool call # → step id so we can mark them completed */
  private toolIdMap = new Map<number, number>();
  /** Track which task labels we've already added (by content) */
  private knownTasks = new Map<string, number>(); // content → step id
  /** Buffer for task-table rows that wrap across multiple terminal lines */
  private partialTaskRow = '';

  /** Process a single cleaned (ANSI-stripped, trimmed-end) line. Returns true if steps changed. */
  processLine(line: string): boolean {
    const trimmed = line.trim();

    // ── Handle partial (wrapped) task-table row buffering ──
    if (this.partialTaskRow) {
      // Blank line, table border, table header, or new task row → abandon partial, fall through
      if (!trimmed || /^\+[-+=]+\+$/.test(trimmed) || /^\|\s*(ID|t\d+)\s*\|/.test(trimmed)) {
        verboseLog('[AKS Agent Parse] ThinkingStepTracker: abandoning partial task row');
        this.partialTaskRow = '';
        // Fall through to normal processing below
      } else {
        // Continuation of the wrapped row — join, collapse whitespace, try to parse
        const joined = (this.partialTaskRow + ' ' + trimmed).replace(/\s+/g, ' ').trim();
        const taskRow = extractTaskRow(joined);
        if (taskRow) {
          verboseLog(
            '[AKS Agent Parse] ThinkingStepTracker: completed wrapped task row:',
            taskRow.content,
            taskRow.status
          );
          this.partialTaskRow = '';
          return this.applyTaskRow(taskRow);
        }
        // If the joined text ends with `|` but still didn't match, give up
        if (/\|\s*$/.test(trimmed)) {
          this.partialTaskRow = '';
        }
        return false;
      }
    }

    if (!trimmed) return false;
    let changed = false;

    // ── Init phase: model loading ──
    const modelMatch = trimmed.match(/^Loaded models:\s*\[(.+)\]/);
    if (modelMatch) {
      const models = modelMatch[1].replace(/'/g, '').trim();
      verboseLog('[AKS Agent Parse] ThinkingStepTracker: model loaded:', models);
      this.steps.push({
        id: this.nextId++,
        label: `Model: ${models}`,
        status: 'completed',
        phase: 'init',
        timestamp: Date.now(),
      });
      return true;
    }

    // ── Init phase: toolset loaded ──
    const toolsetMatch = trimmed.match(/^[✅⚠️❌]\s*Toolset\s+(.+)/);
    if (toolsetMatch) {
      const toolsetName = toolsetMatch[1].trim();
      this.steps.push({
        id: this.nextId++,
        label: `Toolset: ${toolsetName}`,
        status: 'completed',
        phase: 'init',
        timestamp: Date.now(),
      });
      return true;
    }

    // ── Init phase: Using model line (marks init as done) ──
    if (/^Using model:/i.test(trimmed)) {
      // We don't add a step but we mark all init steps completed (they should be already)
      return false;
    }

    // ── "Thinking..." indicator ──
    if (/^Thinking\.{3}$/i.test(trimmed)) {
      // Don't add a separate step; the planning phase will start shortly
      return false;
    }

    // ── Planning phase: task-list rows ──
    const taskRow = extractTaskRow(trimmed);
    if (taskRow) {
      verboseLog(
        '[AKS Agent Parse] ThinkingStepTracker: task row:',
        taskRow.content,
        taskRow.status
      );
      return this.applyTaskRow(taskRow);
    }
    // Start buffering if this looks like a partial (wrapped) task row
    if (/^\|\s*t\d+\s*\|/.test(trimmed)) {
      verboseLog('[AKS Agent Parse] ThinkingStepTracker: buffering partial task row');
      this.partialTaskRow = trimmed;
      return false;
    }

    // ── Executing phase: Running tool #N ──
    const runMatch = trimmed.match(/^Running tool\s+#(\d+)\s+/);
    if (runMatch) {
      const toolNum = parseInt(runMatch[1], 10);
      verboseLog('[AKS Agent Parse] ThinkingStepTracker: running tool #' + toolNum + ':', trimmed);
      // Skip TodoWrite and kubectl tools — they're tracked via the task table
      if (/TodoWrite/i.test(trimmed) || /call_kubectl/i.test(trimmed)) {
        // Still record the tool number so we can mark it finished without noise
        this.toolIdMap.set(toolNum, -1);
        return false;
      }
      const label = friendlyToolLabel(trimmed);
      if (!label) return false; // friendlyToolLabel returns null for TodoWrite
      const stepId = this.nextId++;
      this.toolIdMap.set(toolNum, stepId);
      this.steps.push({
        id: stepId,
        label,
        status: 'running',
        phase: 'executing',
        timestamp: Date.now(),
      });
      return true;
    }

    // ── Executing phase: Finished #N ──
    const finMatch = trimmed.match(/^Finished\s+#(\d+)\s+in\b/);
    if (finMatch) {
      const toolNum = parseInt(finMatch[1], 10);
      const stepId = this.toolIdMap.get(toolNum);
      if (stepId !== null && stepId !== undefined && stepId !== -1) {
        const step = this.steps.find(s => s.id === stepId);
        if (step && step.status !== 'completed') {
          step.status = 'completed';
          step.timestamp = Date.now();
          changed = true;
        }
      }
      return changed;
    }

    return false;
  }

  /** Apply a parsed task row to the steps list. Returns true if steps changed. */
  private applyTaskRow(taskRow: {
    content: string;
    status: 'pending' | 'in_progress' | 'completed';
  }): boolean {
    const existingId = this.knownTasks.get(taskRow.content);
    if (existingId !== undefined) {
      // Update existing task step
      const step = this.steps.find(s => s.id === existingId);
      if (step) {
        const newStatus: AgentThinkingStep['status'] =
          taskRow.status === 'completed'
            ? 'completed'
            : taskRow.status === 'in_progress'
            ? 'running'
            : 'pending';
        if (newStatus !== step.status) {
          step.status = newStatus;
          step.timestamp = Date.now();
          return true;
        }
      }
      return false;
    }
    // New task
    const stepStatus: AgentThinkingStep['status'] =
      taskRow.status === 'completed'
        ? 'completed'
        : taskRow.status === 'in_progress'
        ? 'running'
        : 'pending';
    const sid = this.nextId++;
    this.knownTasks.set(taskRow.content, sid);
    this.steps.push({
      id: sid,
      label: taskRow.content,
      status: stepStatus,
      phase: 'planning',
      timestamp: Date.now(),
    });
    return true;
  }
}

/**
 * Runs a question against the AKS agent pod by exec-ing directly into it
 * via the Kubernetes exec API (WebSocket) through Headlamp's proxy.
 * Returns only the final AI answer (clean, no ANSI codes, bullets normalised).
 *
 * The underlying exec WebSocket session is **reused** across questions to the
 * same cluster/pod so that subsequent questions skip the connection setup
 * overhead.  Call `destroyAgentSession()` to tear down the cached session
 * (e.g. on cluster change or chat-history clear).
 *
 * @param onProgress — optional callback invoked with an updated array of
 *   thinking steps every time a new step is detected in the agent stream.
 */
export async function runAksAgent(
  question: string,
  podInfo: AksAgentPodInfo,
  clusterName: string,
  onProgress?: AgentProgressCallback,
  conversationHistory: ConversationEntry[] = []
): Promise<string> {
  console.log(
    `[AKS Agent] Exec into pod ${podInfo.podName} in namespace ${podInfo.namespace}, cluster ${clusterName}`
  );

  // Build the enriched prompt with base instructions + conversation history
  const enrichedPrompt = buildEnrichedPrompt(question, conversationHistory);

  // Get or create a persistent session for this cluster+pod
  const session = getOrCreateSession(clusterName, podInfo);
  const result = await session.ask(enrichedPrompt, onProgress);

  if (result && result.trim().length > 0) {
    debugLog('[AKS Agent Parse] runAksAgent: raw result length:', result.length, 'result:', result);
    const answer = extractAIAnswer(result);
    console.log(`[AKS Agent] Exec succeeded, extracted answer length: ${answer.length}`);
    if (answer) {
      return answer;
    }
    // extractAIAnswer stripped everything — the agent ran but produced no
    // user-visible answer.  Return a generic message instead of raw noise.
    console.warn('[AKS Agent] extractAIAnswer returned empty — agent output had no AI answer.');
    return 'The agent processed the request but did not produce a final answer. Please try again.';
  }

  throw new Error('No response received from AKS agent pod.');
}

// ─── Persistent Agent Session ────────────────────────────────────────────────

/** Idle timeout: resets every time data arrives.  Only fires on silence. */
const IDLE_TIMEOUT_MS = 120_000; // 2 min
/** Hard wall-clock cap per question so a stuck stream cannot run forever. */
const MAX_WALL_TIMEOUT_MS = 600_000; // 10 min

/** Module-level cached session. */
let activeSession: AgentSession | null = null;

/**
 * Destroy the cached agent exec session.
 * Call this when the user changes cluster or clears chat history so that
 * the next question opens a fresh connection.
 */
export function destroyAgentSession(): void {
  if (activeSession) {
    console.log('[AKS Agent] Destroying cached agent session');
    activeSession.destroy();
    activeSession = null;
  }
}

/**
 * Return an existing session if it matches the requested cluster+pod and is
 * still alive, otherwise create a fresh one.
 */
function getOrCreateSession(clusterName: string, podInfo: AksAgentPodInfo): AgentSession {
  if (
    activeSession &&
    activeSession.isAlive &&
    activeSession.clusterName === clusterName &&
    activeSession.podName === podInfo.podName
  ) {
    console.log('[AKS Agent] Reusing existing exec session');
    return activeSession;
  }

  // Tear down stale session if any
  destroyAgentSession();

  console.log('[AKS Agent] Creating new exec session');
  const session = new AgentSession(clusterName, podInfo);
  session.connect();
  activeSession = session;
  return session;
}

/**
 * Manages a persistent WebSocket exec session to an AKS agent pod.
 *
 * The session opens an interactive bash shell on the pod via the Kubernetes
 * exec API.  Each call to `ask()` sends a `python /app/aks-agent.py ask …
 * --no-interactive` command over stdin and collects the answer.  Between
 * questions the bash shell (and the WebSocket) remain open so the next
 * question avoids the connection-setup overhead.
 */
class AgentSession {
  readonly clusterName: string;
  readonly podName: string;
  private podInfo: AksAgentPodInfo;
  private streamHandle: any = null;
  private _alive = false;
  /** True once the initial bash prompt has been received. */
  private bashReady = false;
  /** True once `stty -echo` has been confirmed active. */
  private echoDisabled = false;
  /** True while `stty -echo` has been sent but not yet confirmed. */
  private sttyInFlight = false;

  // ── Per-question state ──────────────────────────────────────────────────
  private output = '';
  private errorOutput = '';
  private questionResolved = false;
  private commandSent = false;
  private pendingCommand: string | null = null;
  private pendingResolve: ((value: string) => void) | null = null;
  private pendingReject: ((reason: Error) => void) | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private wallTimer: ReturnType<typeof setTimeout> | null = null;
  private tracker: ThinkingStepTracker | null = null;
  private onProgress: AgentProgressCallback | null = null;

  constructor(clusterName: string, podInfo: AksAgentPodInfo) {
    this.clusterName = clusterName;
    this.podName = podInfo.podName;
    this.podInfo = podInfo;
  }

  get isAlive(): boolean {
    return this._alive;
  }

  // ── Connection setup ────────────────────────────────────────────────────

  /** Open the exec WebSocket to the pod's bash shell. */
  connect(): void {
    const { namespace, podName, containerName } = this.podInfo;
    const command = ['bash'];
    const commandStr = command.map(c => '&command=' + encodeURIComponent(c)).join('');
    const url = `/api/v1/namespaces/${namespace}/pods/${podName}/exec?container=${encodeURIComponent(
      containerName
    )}${commandStr}&stdin=1&stderr=1&stdout=1&tty=1`;

    console.log(`[AKS Agent] Session exec URL: ${url}`);

    const additionalProtocols = [
      'v4.channel.k8s.io',
      'v3.channel.k8s.io',
      'v2.channel.k8s.io',
      'channel.k8s.io',
    ];

    this._alive = true;

    this.streamHandle = stream(url, (data: ArrayBuffer | string) => this.handleData(data), {
      isJson: false,
      additionalProtocols,
      cluster: this.clusterName,
      reconnectOnFailure: false,
      failCb: () => this.handleConnectionFailure(),
    });
  }

  // ── Question lifecycle ──────────────────────────────────────────────────

  /**
   * Send a question to the agent and return the raw output.
   * Only one question can be in-flight at a time.
   */
  ask(question: string, onProgress?: AgentProgressCallback): Promise<string> {
    if (!this._alive) {
      return Promise.reject(new Error('Agent session is not alive'));
    }
    if (this.pendingResolve) {
      return Promise.reject(new Error('A question is already in progress'));
    }

    return new Promise<string>((resolve, reject) => {
      // Reset per-question state
      this.output = '';
      this.errorOutput = '';
      this.questionResolved = false;
      this.commandSent = false;
      this.pendingCommand = null;
      this.pendingResolve = resolve;
      this.pendingReject = reject;
      this.tracker = onProgress ? new ThinkingStepTracker() : null;
      this.onProgress = onProgress ?? null;

      const escapedQuestion = shellEscapeSingleQuote(question);
      const pythonCommand = `python /app/aks-agent.py ask ${escapedQuestion} --no-interactive`;

      if (this.bashReady) {
        // Bash is already at its prompt — send immediately
        this.sendStdin(pythonCommand + '\n');
        this.commandSent = true;
        console.log('[AKS Agent] Sent command on existing session');
      } else {
        // First question — wait for initial bash prompt to trigger sending
        this.pendingCommand = pythonCommand;
        console.log('[AKS Agent] Waiting for bash prompt before sending command');
      }

      this.startIdleTimer();
      this.startWallTimer();
    });
  }

  /** Tear down the session and close the WebSocket. */
  destroy(): void {
    this._alive = false;
    this.clearTimers();

    // Reject any in-flight question
    if (this.pendingReject && !this.questionResolved) {
      this.questionResolved = true;
      this.pendingReject(new Error('Agent session destroyed'));
    }
    this.pendingResolve = null;
    this.pendingReject = null;

    if (this.streamHandle) {
      try {
        this.streamHandle.cancel();
      } catch {
        /* ignore */
      }
      this.streamHandle = null;
    }
  }

  // ── Data handling ───────────────────────────────────────────────────────

  private handleData(data: ArrayBuffer | string): void {
    if (!this._alive) return;

    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      const channel = bytes[0];
      const text = new TextDecoder().decode(bytes.slice(1));
      debugLog(
        '[AKS Agent Data] handleData: ArrayBuffer channel:',
        channel,
        'text length:',
        text.length,
        'text:',
        text
      );

      this.handleChannel(channel, text);
    } else {
      // Plain string data (base64 protocol)
      debugLog('[AKS Agent Data] handleData: string data length:', data.length);
      console.log('[AKS Agent] string data from exec:', data);
      this.output += data;
    }
  }

  private handleChannel(channel: number, text: string): void {
    detailLog('[AKS Agent Data] handleChannel:', channel, 'text length:', text.length);
    if (channel === 1) {
      this.handleStdout(text);
    } else if (channel === 2) {
      this.handleStderr(text);
    } else if (channel === 3) {
      this.handleStatusChannel();
    }
  }

  private handleStdout(text: string): void {
    // ── Phase 0: Disable terminal echo on very first stdout ──
    // Sending `stty -echo` prevents the TTY from echoing multi-line commands
    // back through stdout, which would otherwise pollute the output with the
    // full conversation history embedded in the prompt.
    if (!this.echoDisabled) {
      if (!this.sttyInFlight) {
        // First stdout ever (initial bash prompt) — send stty -echo
        this.sendStdin('stty -echo\n');
        this.sttyInFlight = true;
        console.log('[AKS Agent] Sent stty -echo to disable terminal echo');
        return;
      }
      // Waiting for stty to complete — look for the bash prompt
      const plainStty = stripAnsi(text);
      if (/root@[^:]+:[^#]*#\s*$/.test(plainStty.trim())) {
        this.echoDisabled = true;
        this.bashReady = true;
        console.log('[AKS Agent] Terminal echo disabled, bash ready');
        // If ask() has already queued a command, send it now
        if (!this.commandSent && this.pendingCommand) {
          this.sendStdin(this.pendingCommand + '\n');
          this.commandSent = true;
          this.pendingCommand = null;
          console.log('[AKS Agent] Sent initial command after echo disabled');
        }
      }
      return; // Don't add stty-related output to command output
    }

    // ── First-time initialisation (fallback): send the stored command when bash is ready
    if (!this.bashReady && !this.commandSent && this.pendingCommand) {
      const socket = this.getSocket();
      if (socket && socket.readyState === WebSocket.OPEN) {
        this.sendStdin(this.pendingCommand + '\n');
        this.commandSent = true;
        this.bashReady = true;
        this.pendingCommand = null;
        console.log('[AKS Agent] Sent initial command after bash prompt');
      }
    }

    // If no question in flight, ignore (e.g. stray bash output between questions)
    if (this.questionResolved || !this.pendingResolve) return;

    this.resetIdleTimer();
    debugLog(
      '[AKS Agent Data] handleStdout: chunk length:',
      text.length,
      'accumulated output length:',
      this.output.length,
      'chunk:',
      text
    );

    // Ensure each terminal line chunk is newline-terminated.
    this.output += text.endsWith('\n') ? text : text + '\n';

    // Feed each line to the thinking-step tracker for live progress
    if (this.tracker && this.onProgress) {
      const chunkLines = stripAnsi(text).split('\n');
      let anyChanged = false;
      for (const cl of chunkLines) {
        if (this.tracker.processLine(cl)) anyChanged = true;
      }
      if (anyChanged) {
        detailLog(
          '[AKS Agent Data] handleStdout: thinking steps updated, count:',
          this.tracker.steps.length
        );
        this.onProgress([...this.tracker.steps]);
      }
    }

    // Detect the returning bash prompt — the command has finished.
    // Only close once we've already seen "AI:" in the output.
    const plainText = stripAnsi(text);
    const hasAiMarker = this.output.includes('AI:');
    const hasPrompt = /root@[^:]+:[^#]*#\s*$/.test(plainText.trim());
    detailLog(
      '[AKS Agent Data] handleStdout: completion check — commandSent:',
      this.commandSent,
      'hasAiMarker:',
      hasAiMarker,
      'hasPrompt:',
      hasPrompt
    );
    if (this.commandSent && hasAiMarker && hasPrompt) {
      console.log('[AKS Agent] Bash prompt detected after AI answer — question complete.');
      debugLog('[AKS Agent Data] handleStdout: total output length:', this.output.length);
      this.resolveCurrentQuestion(this.output);
    }
  }

  private handleStderr(text: string): void {
    if (this.questionResolved || !this.pendingResolve) return;
    this.resetIdleTimer();
    this.errorOutput += text;
    debugLog('[AKS Agent Data] handleStderr: stderr chunk length:', text.length, 'text:', text);
    console.warn(`[AKS Agent] exec stderr: ${text}`);
  }

  private handleStatusChannel(): void {
    // Status channel — the exec process exited (bash terminated).
    // The session is no longer usable.
    console.log(
      `[AKS Agent] Exec completed via status channel. stdout length: ${this.output.length}, stderr length: ${this.errorOutput.length}`
    );
    this._alive = false;

    if (!this.questionResolved && this.pendingResolve) {
      this.resolveCurrentQuestion(this.output || this.errorOutput);
    }
  }

  private handleConnectionFailure(): void {
    this._alive = false;
    this.clearTimers();
    debugLog(
      '[AKS Agent Session] handleConnectionFailure: stdout length:',
      this.output.length,
      'stderr length:',
      this.errorOutput.length,
      'questionResolved:',
      this.questionResolved
    );
    console.warn(
      `[AKS Agent] WebSocket closed. stdout: ${this.output.length}, stderr: ${this.errorOutput.length}`
    );

    if (!this.questionResolved && this.pendingResolve) {
      if (this.output.trim()) {
        this.resolveCurrentQuestion(this.output);
      } else if (this.errorOutput.trim()) {
        this.questionResolved = true;
        const reject = this.pendingReject;
        this.pendingResolve = null;
        this.pendingReject = null;
        reject?.(new Error(`AKS agent error: ${this.errorOutput.trim()}`));
      } else {
        this.questionResolved = true;
        const reject = this.pendingReject;
        this.pendingResolve = null;
        this.pendingReject = null;
        reject?.(new Error('WebSocket connection to agent pod failed'));
      }
    }

    // Invalidate so next call creates a fresh session
    if (activeSession === this) {
      activeSession = null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Resolve the in-flight question Promise and reset per-question state. */
  private resolveCurrentQuestion(result: string): void {
    this.clearTimers();
    this.questionResolved = true;
    debugLog(
      '[AKS Agent Session] resolveCurrentQuestion: output length:',
      result.length,
      'has AI: marker:',
      result.includes('AI:'),
      'output:',
      result
    );
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    this.pendingReject = null;
    this.tracker = null;
    this.onProgress = null;
    resolve?.(result);
  }

  /** Send text to stdin of the exec session. */
  private sendStdin(text: string): void {
    const socket = this.getSocket();
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn('[AKS Agent] Cannot send stdin — socket not open');
      return;
    }
    const encoder = new TextEncoder();
    const encoded = encoder.encode(text);
    const buffer = new Uint8Array([0, ...encoded]); // 0 = stdin channel
    socket.send(buffer);
  }

  private getSocket(): WebSocket | null {
    try {
      return this.streamHandle?.getSocket?.() ?? null;
    } catch {
      return null;
    }
  }

  // ── Timers ──────────────────────────────────────────────────────────────

  private startIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (!this.questionResolved && this.pendingResolve) {
        if (this.output.trim()) {
          console.log('[AKS Agent] Idle timeout — returning partial output');
          this.resolveCurrentQuestion(this.output);
        } else {
          this.questionResolved = true;
          const reject = this.pendingReject;
          this.pendingResolve = null;
          this.pendingReject = null;
          reject?.(new Error(`Exec timed out after ${IDLE_TIMEOUT_MS / 1000}s of inactivity`));
        }
      }
    }, IDLE_TIMEOUT_MS);
  }

  private resetIdleTimer(): void {
    this.startIdleTimer();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private startWallTimer(): void {
    this.clearWallTimer();
    this.wallTimer = setTimeout(() => {
      if (!this.questionResolved && this.pendingResolve) {
        this.clearIdleTimer();
        if (this.output.trim()) {
          console.log('[AKS Agent] Wall-clock timeout — returning partial output');
          this.resolveCurrentQuestion(this.output);
        } else {
          this.questionResolved = true;
          const reject = this.pendingReject;
          this.pendingResolve = null;
          this.pendingReject = null;
          reject?.(new Error(`Exec timed out after ${MAX_WALL_TIMEOUT_MS / 1000}s total`));
        }
      }
    }, MAX_WALL_TIMEOUT_MS);
  }

  private clearWallTimer(): void {
    if (this.wallTimer) {
      clearTimeout(this.wallTimer);
      this.wallTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearIdleTimer();
    this.clearWallTimer();
  }
}

// Exported for testing — these are internal parsing helpers that
// need thorough test coverage for correctness.
export const _testing = {
  stripAnsi,
  normalizeBullets,
  looksLikeYaml,
  wrapBareYamlBlocks,
  wrapBareCodeBlocks,
  cleanTerminalFormatting,
  collapseTerminalBlankLines,
  stripAgentNoise,
  isAgentNoiseLine,
  extractAIAnswer,
  ThinkingStepTracker,
  extractTaskRow,
  friendlyToolLabel,
  stripCommandEcho,
  looksLikeShellOrDockerCodeLine,
  hasShellSyntax,
  normalizeTerminalMarkdown,
  isFileHeaderComment,
  isBoldFileHeading,
  hasStructuredCodeContext,
};
