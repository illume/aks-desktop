# Headlamp distribution and product builds

> Research snapshot: 2026-07-30; implementation updated 2026-08-01. Proposed
> upstream package name remains a publication prototype. The local
> `@headlamp-k8s/headlamp-source` artifact and npm-native consumer patch now
> exercise the design.
> The vendored `plugins/ai-assistant/` directory is outside this audit.

This document expands the
[Headlamp packaging strategy](headlamp-packaging.md) with concrete designs for
a literal all-platform npm package, an AKS-derived container image, bundling
several plugins, and moving reusable build logic upstream.
See the strategy's [terminology table](headlamp-packaging.md#terminology) for
standard technical abbreviations.

## A single all-platform npm package

A literal package is technically viable. It should contain Headlamp build
inputs and prebuilt Headlamp servers, not already signed AKS installers:

```text
@headlamp-k8s/headlamp/
├── bin/headlamp-dist.mjs
├── frontend/                    # prebuilt static assets
├── desktop/                     # Electron shell/build kit
├── plugin-api/                  # supported types/runtime API
├── servers/
│   ├── darwin-arm64/headlamp-server
│   ├── darwin-x64/headlamp-server
│   ├── linux-arm64/headlamp-server
│   ├── linux-x64/headlamp-server
│   ├── win32-arm64/headlamp-server.exe
│   └── win32-x64/headlamp-server.exe
├── schemas/product-manifest-v1.json
├── manifest.json                # versions, paths, modes, and SHA-256 values
├── LICENSE
└── THIRD_PARTY_NOTICES
```

The package CLI would accept an explicit target, locate and verify that server,
and copy only the selected server plus shared frontend/shell files into a
product assembly directory. It must support an explicit target rather than
using only `process.platform`, because AKS CI cross-builds installers. Extraction
must restore executable modes and fail for an unsupported OS/architecture.
Windows ARM64 is buildable, but upstream does not currently publish or qualify
a Windows ARM64 desktop artifact; omit that target initially or add
target-specific CI and release testing.

A future AKS dependency could therefore be:

```json
{
  "devDependencies": {
    "@headlamp-k8s/headlamp": "0.45.0"
  },
  "scripts": {
    "build:headlamp": "headlamp-dist assemble --product aks-product.json"
  }
}
```

The package should have no install lifecycle script. `npm ci --ignore-scripts`
must still produce a usable package; downloads/extraction happen only in the
explicit assembly command. The npm lock integrity protects the tarball, while
`manifest.json` detects an incorrectly produced or modified inner artifact.
Release CI should publish npm provenance and generate the package, native
artifacts, checksums, licenses, and SBOM from the same Headlamp tag.

### Practical limits

| Concern | Literal all-platform tarball |
| --- | --- |
| One update | Excellent: one exact npm version and one lockfile change. |
| Offline/cross-build | Excellent: every supported server is already present. |
| Download/cache | Poor: every developer and CI job receives every server. |
| Public npm size | High risk: at the time of this research, npm's public Open Source Terms state a 100 MB compressed tarball limit; measure with `npm pack --json` and recheck registry policy before choosing this form. |
| Electron runtimes | Including all runtimes/installers would make the package much larger; let the desktop build kit resolve Electron unless a private offline package is required. |
| Platform additions | Any new server target republishes the entire package. |
| Security review | Simple dependency graph, but a compromise exposes every platform artifact at once. |
| Private registry | Viable if its size/retention limits are acceptable. |

There are therefore two valid "single package" meanings:

1. **One physical package:** the layout above. Prefer it for a private,
   air-gapped build cache where one large download is acceptable.
2. **One top-level npm dependency:** a small
   `@headlamp-k8s/headlamp` package exact-pins shared JS units and lists
   per-platform server packages as `optionalDependencies` with npm `os`/`cpu`
   constraints. This is physically multiple packages but normally installs
   only the host server.

The second form is smaller for developers but does not naturally support
cross-target builds from one host. The resolver would need an explicit artifact
fetch/lock for non-host targets. Do not add a fallback `postinstall` download:
it breaks offline and `--ignore-scripts` builds and enlarges the supply-chain
attack surface.

**Recommendation:** publish the one-top-level-dependency form publicly and
optionally produce the literal all-platform tarball for AKS's private/offline
pipeline. Both should expose the same CLI and product-manifest contract.

## Shipping an AKS-derived container image

The official source already builds a non-root multi-stage image containing the
Go server, static frontend, development plugins, and shipped static plugins.
Upstream publishes `ghcr.io/headlamp-k8s/headlamp` for Linux `amd64`, `arm64`,
`s390x`, and `ppc64le` under the legacy `headlamp-k8s` registry namespace.

### Option 1: extend the official image

Use this when AKS changes are plugins and backend runtime configuration. Build
the multi-plugin bundle described below first, then use a small Dockerfile:

```dockerfile
ARG HEADLAMP_IMAGE=ghcr.io/headlamp-k8s/headlamp@sha256:<reviewed-manifest-digest>
FROM ${HEADLAMP_IMAGE}

USER root
RUN rm -rf /headlamp/static-plugins && mkdir -p /headlamp/static-plugins
COPY --chown=headlamp:headlamp build/headlamp-plugin-bundle/plugins/ /headlamp/static-plugins/
COPY --chown=headlamp:headlamp build/headlamp-plugin-bundle/plugin-bundle.lock.json /headlamp/plugin-bundle.lock.json
USER headlamp

LABEL org.opencontainers.image.title="AKS Desktop Headlamp"
LABEL org.opencontainers.image.base.name="ghcr.io/headlamp-k8s/headlamp:v0.44.0"
```

The upstream image already sets
`HEADLAMP_STATIC_PLUGINS_DIR=/headlamp/static-plugins`. Pin the multi-platform
manifest digest, not a mutable tag. Store the base tag and digest in the AKS
distribution lock.

Clear the base image's static-plugin directory as shown so a base update cannot
leave stale files or collide with an AKS-pinned plugin such as Prometheus. An
additive variant must instead reject every `bundleKey` already present in the
base image.

This approach cannot change frontend values that were compiled by Vite, nor can
it add Electron main-process APIs. Until public runtime frontend configuration
exists, changing core branding/title requires the source-build option. Plugins
must feature-detect desktop mode and hide or replace Electron-only command,
secure-storage, OAuth, and cluster-registration flows in a browser container.
Do not expose an unrestricted server-side command broker to imitate Electron.

### Option 2: build the upstream Dockerfile with AKS inputs

Use this when the frontend must be rebuilt or a generic upstream change has not
yet reached a release. This is the implemented prototype:

1. Install the exact source-bearing npm package and let npm verify and apply the
   consumer patch.
2. Build the plugin bundle once and stage it as the upstream `.plugins` input,
   or add it to the final `/headlamp/static-plugins` layer.
3. Pass the product manifest and package-recorded source commit as Docker build
   arguments. The Dockerfile does not copy `.git`; the generated frontend
   records the manifest's product name/version and the pinned commit.
4. Build the upstream Dockerfile for the required Linux architectures.
5. Run the image as its non-root user and require its HTTP endpoint and staged
   plugins to pass smoke checks.
6. Stop carrying this source-build difference when runtime product
   configuration or the required upstream API is released.

Do not `sed` files inside an already-built image: it is brittle, invalidates
precompression metadata, and obscures provenance.

`npm run build:container` implements these steps for the local platform. The
manifest contains public build configuration only. Pass backend secrets and
`HEADLAMP_CONFIG_*` at deployment time.

### Publish and verify

A proposed AKS pipeline should:

- tag both product and base versions, for example
  `ghcr.io/azure/aks-desktop-headlamp:0.9.0-headlamp-0.44.0`;
- build with `docker buildx` for the supported target set;
- record the upstream base digest and plugin-bundle lock as OCI annotations;
- run the image as its existing non-root user and smoke-test server startup,
  plugin discovery, public configuration, and Kubernetes authentication;
- generate SBOM/provenance, scan the final image, and sign the resulting
  multi-platform manifest;
- inject credentials only through the orchestrator at runtime; and
- rebuild promptly when either the Headlamp base digest or a bundled plugin is
  updated.

The resulting image is an AKS product artifact. It should not replace or
overwrite upstream Headlamp tags.

## Bundling several plugins

The current build has two different plugin paths:

- The source package's `bundle:plugins` script builds declared workspaces or
  copies exact, lockfile-verified prebuilt package dependencies, then stages each
  `dist/` under `.plugins`. Electron's plugin manager reports this packaged
  directory as `shipped`.
- Headlamp's `app/app-build-manifest.json` and
  `container/build-manifest.json` download shipped plugin archives. The patched
  desktop installer requires SHA-256 and package identity for an external
  product manifest; the current container fetcher does not yet share that
  verification.

Replace both with one product-owned plugin manifest. Excluding the vendored AI
Assistant, an illustrative AKS manifest is:

```json
{
  "schemaVersion": 1,
  "requiredPluginApi": "0.14",
  "plugins": [
    {
      "id": "aks-desktop",
      "bundleKey": "aks-desktop",
      "source": {"type": "workspace", "path": "plugins/aks-desktop"},
      "enabledByDefault": true,
      "permissions": {
        "commands": [
          {"tool": "az", "subcommands": ["account", "aks", "aksarc", "connectedk8s"]},
          {"tool": "kubectl", "subcommands": ["config", "top"]}
        ],
        "services": ["clusters:register", "storage:aks-desktop", "oauth:github"]
      }
    },
    {
      "id": "insights-plugin",
      "bundleKey": "insights-plugin",
      "source": {
        "type": "archive",
        "url": "https://github.com/inspektor-gadget/insights-plugin/releases/download/v0.2.8/insights-plugin-0.2.8.tar.gz",
        "sha256": "913c8023b8f03e9e0ae327897760e220f5b05c2a3bcfd969bb1ce5355a4c049c"
      },
      "enabledByDefault": true
    },
    {
      "id": "prometheus",
      "bundleKey": "prometheus",
      "source": {
        "type": "archive",
        "url": "https://github.com/headlamp-k8s/plugins/releases/download/prometheus-0.9.0/prometheus-0.9.0.tar.gz",
        "sha256": "061cd8ad94d4795f397c85ee7338fc724d59d11f7853f6b78dea28e4931cc021"
      },
      "enabledByDefault": true
    },
    {
      "id": "kaito",
      "bundleKey": "kaito",
      "packageName": "headlamp-kaito",
      "source": {
        "type": "archive",
        "url": "https://github.com/kaito-project/headlamp-kaito/releases/download/0.0.7/headlamp-kaito-0.0.7.tar.gz",
        "sha256": "a7228766e7b8d8413b44cdc727722a51a6825c61a1d0f052c06adab67a882ef6"
      },
      "enabledByDefault": false
    }
  ]
}
```

The URLs and versions reflect current manifests, and the digests are from the
corresponding GitHub release assets; the schema is a proposal. Exact npm
packages with lockfile integrity may be another source type. Floating versions,
branches, and unverified archives should be rejected.
The `0.14` API gate is a target state and should fail today: the AKS plugin
declares `^0.13.1`, so it needs an SDK update and compatibility tests first.
When replacing the hard-coded list, preserve the Assistant's existing vendoring
flow as a separate input; do not rebuild it or add it to this manifest.
The current Insights workspace is a download wrapper without checksum
verification; resolving its `0.2.8` archive directly makes the digest
authoritative and can remove that extra build script.

### Deterministic bundle algorithm

1. Validate the schema, unique canonical IDs, unique `bundleKey` values, source
   paths, API range, dependencies, and permission names before running builds.
2. For workspaces, run the locked package-manager install/build. For archives,
   verify the digest before safely extracting; reject absolute paths, `..`,
   links escaping the destination, and multiple unexpected roots.
3. Confirm the extracted `package.json` name matches the declared
   `packageName` (or `id` when omitted). Do not derive an output directory from
   an untrusted package name or discard scopes in a way that lets `@scope-a/x`
   collide with `@scope-b/x`.
4. Copy the complete plugin distribution, package metadata, locales, assets,
   licenses, and notices into a clean
   `build/headlamp-plugin-bundle/plugins/<bundleKey>/`.
5. Emit a sorted `build/headlamp-plugin-bundle/plugin-bundle.lock.json`
   containing source identities, digests, plugin/API versions, permissions,
   defaults, dependencies, and a hash for every output file.
6. Load plugins in dependency order only when explicit `dependsOn` metadata
   requires it; otherwise plugins must not rely on filesystem order. Reject
   missing dependencies and cycles.
7. Run a loader smoke test and fail on duplicate routes/IDs, unsupported APIs,
   undeclared capabilities, missing locales/assets, or modified files.

Build the JavaScript bundle once and reuse its verified `plugins/` directory
with the adjacent lock:

- the desktop assembler copies it to the shell's shipped/static plugin
  resources;
- the derived container copies it to `/headlamp/static-plugins`; and
- development can point Headlamp's static plugin directory at it.

`enabledByDefault` is product policy, not permission to execute privileged
operations. Keep it in the generated bundle policy instead of silently
rewriting a signed third-party package. Command/service permissions still need
host enforcement and the product's review/consent policy.

The current `copyShippedPlugin()` derives its destination with
`path.basename(packageName)`, so differently scoped packages with the same
basename already collide. The manifest bundler must use the validated
`bundleKey` instead, and that correction must be part of any upstream
contribution based on the current helper.

## Build tooling to upstream

AKS should contribute generic primitives, not Azure product policy. The ideal
result is a versioned `@headlamp-k8s/headlamp` or
`@headlamp-k8s/distribution` CLI used by desktop, containers, and downstream
products.

| Current code | Upstream reusable tool | What remains in AKS |
| --- | --- | --- |
| Source-package `scripts/bundle-plugins.js` and package-owned tests | Safe plugin workspace bundler with package-identity validation, collision rejection, and clean output | Plugin list and permissions in root `package.json` |
| Source-package `scripts/update-source.js` and `scripts/compose-patches.js` | Commit-pinned source updates and deterministic npm patch composition | Exact source pin and root-owned patch series |
| Source-package `scripts/product-manifest.js` | Product-template generation from consumer package metadata | Azure tools, legal resources, and digest enrichment |
| Source-package `app/scripts/setup-plugins.js` and `container/fetch-plugins.sh` | One checksum-verifying manifest implementation for desktop and container builds | Product-selected archives/defaults |
| `build/setup-external-tools.ts` | Platform-aware external-resource staging API | Azure CLI/kubelogin declarations |
| Generic parts of `build/download-az-cli.ts` | Required-digest downloader, redirect policy, safe archive extraction, cache, and platform selector | Azure CLI/Python installation and extensions |
| Source-package `scripts/smoke-app.js` and `build/verify-bundled-tools.ts` | Electron output-layout resolver and manifest-driven resource/executable verifier | Azure-specific invocation probes |
| `Localize/translation-manager.mjs` | Multi-source locale overlay/merge command in the plugin toolchain | OneLoc conventions and AKS locked terms |
| Root `build:*` scripts and downstream builder config | `assemble-desktop --product --target --output` over an exported base builder config | Thin npm aliases, signing inputs, product manifest |
| Downstream `app/scripts/verify-build-*` changes | Cross-platform `verify-distribution` driven by artifact metadata | AKS release policy |
| `scripts/headlamp-submodule.sh` | Nothing | Removed; npm installs the exact source package |

The source-package plugin tests cover scoped names, stale output, and path
traversal; they are a useful seed for the upstream bundler. Before
upstreaming downloader code, make missing checksums fatal and replace shell
command interpolation with argument-array process APIs and safe extraction.

A staged upstream plan is:

1. Consolidate desktop/container plugin manifests and add digest verification.
2. Publish the plugin bundler and external-resource staging/verifier in the
   distribution CLI.
3. Export the Electron builder/product schema and make Headlamp build commands
   accept plugin/resource/output directories.
4. Publish the lockstep distribution package; reduce AKS's root build to one
   manifest plus thin commands.

## Sources

- [npm `package.json` `os`/`cpu` fields](https://docs.npmjs.com/cli/v11/configuring-npm/package-json#os)
- [npm publish documentation](https://docs.npmjs.com/cli/v11/commands/npm-publish)
- [npm Open Source Terms](https://docs.npmjs.com/policies/open-source-terms/)
- [Headlamp `v0.44.0` Dockerfile](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/Dockerfile)
- [Headlamp container plugin manifest](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/container/build-manifest.json)
- [Headlamp container plugin fetcher](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/container/fetch-plugins.sh)
- [Headlamp container publishing workflow](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/.github/workflows/container-publish.yml)
