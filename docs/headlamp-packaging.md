# Removing the Headlamp submodule

> Research snapshot: 2026-07-30. Headlamp `v0.44.0` is the latest release
> considered here. Proposed package names and manifests in this document do not
> exist yet.

## Terminology

| Term | Meaning |
| --- | --- |
| AKS | Azure Kubernetes Service. AKS Desktop is the product discussed here. |
| API | Application programming interface: a supported contract between components. |
| CI | Continuous integration: automated build and test jobs. |
| CLI | Command-line interface. |
| CRD | Kubernetes custom resource definition. |
| DMG | A macOS disk-image installer. |
| IPC | Inter-process communication, used between Electron processes. |
| MSW | Mock Service Worker, the request-mocking library used by frontend tests and stories. |
| MUI | Material UI, the frontend component library. |
| OAuth | Open Authorization, the delegated sign-in protocol used for GitHub authentication. |
| OCI | Open Container Initiative; here it refers to container image formats and metadata. |
| RBAC | Role-based access control. |
| SBOM | Software bill of materials: an inventory of components in a build artifact. |
| SDK | Software development kit. |
| SHA-256 | Secure Hash Algorithm 256-bit digest, used here to verify downloaded files. |
| UX | User experience. |

## Recommendation

Do not replace the submodule with an official Headlamp installer. Installers are
finished applications: they do not provide a supported way to inject AKS
Desktop's plugins, external tools, identity, or Electron main-process services.
Also do not remove the fork until the command, cluster-registration, storage,
and OAuth capabilities listed below have replacement APIs.

Use this two-step dependency strategy:

1. **Near term:** build a pristine, commit- and tree-pinned upstream source
   export. Keep AKS product configuration, plugins, external tools, and
   packaging in this repository. This removes the fork and Git submodule once
   the required extension APIs are available, even before Headlamp publishes
   composable packages.
2. **Target:** consume one logical, lockstep Headlamp distribution made of
   several physical packages/artifacts. JavaScript belongs on npm; native Go
   binaries are better represented by a signed release manifest. One Headlamp
   version must resolve the frontend, server for each target, Electron shell,
   and plugin API.

For public/general use this is preferable to one large npm package containing
every operating-system binary. It preserves a one-line version update without
making every consumer download every platform or hiding downloads in an
install script. A literal all-platform package remains viable for AKS's
private/offline build cache and is detailed in the companion design.

The [commit audit](headlamp-fork-commit-audit.md) gives a disposition and an AKS
replacement for all 115 downstream non-merge commits.
[Distribution and product builds](headlamp-distribution-builds.md) specifies the
literal single-package option, derived container image, multi-plugin bundle,
and reusable build tooling to contribute upstream.

## Current state

### What is coupled to the submodule

| Consumer | Current dependency on `headlamp/` |
| --- | --- |
| `.gitmodules` | Points at the `headlamp-downstream` branch of the AKS Desktop repository. |
| Root build scripts | Run `make app` inside the submodule. |
| `build/setup-plugins.ts` | Builds AKS plugins and copies them to `headlamp/.plugins`. |
| `build/setup-external-tools.ts` | Writes Azure CLI and Python into `headlamp/app/resources/external-tools`. |
| Build verification | Reads `headlamp/app/package.json` and `headlamp/app/dist`. |
| `Localize/translation-manager.mjs` | Reads and writes Headlamp frontend locale files directly. |
| Downstream Headlamp | Contains product identity, build targets, Electron IPC, backend, frontend, and generated translation changes. |

The fork is based on upstream `v0.43.0`. It has 115 non-merge commits and a
large apparent diff; generated translations and snapshots account for much of
the file count. A strict comparison found no patch-identical commits in current
upstream. Several behaviors do now have semantic upstream equivalents, so the
audit treats a rebase and behavior tests—not subject-line matching—as the final
authority.

### What Headlamp distributes today

As of the research date:

- `frontend/package.json` is private. There is no supported core frontend npm
  package, backend library package, Electron shell package, or all-in-one
  Headlamp npm package.
- npm contains plugin tooling, including
  `@kinvolk/headlamp-plugin@0.14.0`,
  `@headlamp-k8s/pluginctl@0.1.1`, and
  `@headlamp-k8s/eslint-config@0.7.0`.
- The `v0.44.0` release contains desktop installers/tarballs and
  `checksums.txt`, but no standalone frontend or embedded server assets.
- Upstream has a manually dispatched workflow that builds embedded server
  archives. Its default Actions retention is two days; those archives were not
  attached to the `v0.44.0` release.
- Containers and the Helm chart are good server deployments, but neither is a
  reusable desktop application shell.

Upstream issue
[`kubernetes-sigs/headlamp#197`](https://github.com/kubernetes-sigs/headlamp/issues/197)
previously proposed an npm package. The main concerns were making the entire
application a component library and distributing the correct native server
binary. The issue was closed by the inactivity bot, not by an implemented
package design.

## Configuration boundaries

Headlamp already has two different environment-variable contracts:

- Frontend `REACT_APP_*` values are converted into Vite build values by
  `frontend/make-env.js`. They are compiled into public static assets.
- Backend `HEADLAMP_CONFIG_*` values are read at runtime. Explicit command-line
  flags override environment values.
- The Electron main process currently sets backend options such as Helm,
  dynamic clusters, kubeconfig changes, the backend token, and the static
  plugin directory before starting the server.

Those contracts should remain separate:

| Layer | Proposed input | Examples | Secret-safe? |
| --- | --- | --- | --- |
| Product assembly | Versioned product manifest | app ID, name, protocol, icons, targets, legal files, external tools | Non-secret only |
| Frontend startup | Public runtime JSON, with build-time defaults | product labels, feature flags, help links, release-notes policy | **Public; never secrets or tokens** |
| Backend runtime | Existing flags and `HEADLAMP_CONFIG_*` | listen address, plugin paths, dynamic clusters, OIDC settings | Process environment/secret store |
| Desktop host | Permissioned extension manifest | command prefixes, secure-storage namespace, OAuth/cluster providers | Capabilities, not credentials |

A runtime public frontend document avoids rebuilding Headlamp merely to change
text or feature defaults. Values needed before startup—icons, executable name,
protocol registration, signing, and installer targets—remain assembly-time
product configuration.

An illustrative AKS product manifest is:

```json
{
  "schemaVersion": 1,
  "product": {
    "id": "com.microsoft.aks-desktop",
    "name": "aks-desktop",
    "displayName": "AKS desktop",
    "protocols": ["aks-desktop"],
    "icons": "branding/icons",
    "legalFiles": ["LICENSES.txt"],
    "targets": ["darwin-arm64", "linux-x64", "win32-x64"]
  },
  "frontend": {
    "publicConfig": {
      "releaseNotes": false,
      "noClustersMessage": "No AKS clusters added"
    }
  },
  "plugins": [
    {
      "id": "aks-desktop",
      "source": "plugins/aks-desktop/dist",
      "enabled": true,
      "capabilities": [
        "clusters:register",
        "storage:aks-desktop",
        "oauth:github"
      ],
      "commandScopes": [
        {"tool": "az", "subcommands": ["account", "aks", "aksarc", "connectedk8s"]},
        {"tool": "kubectl", "subcommands": ["config", "top"]}
      ]
    }
  ],
  "externalTools": {
    "az": {
      "source": "build/output/external-tools/az",
      "sha256": "<platform artifact digest>"
    }
  }
}
```

This schema is a proposal. The real schema should reject unknown keys, validate
paths and capability names, and be versioned independently from product data.
Signing credentials, OAuth tokens, backend tokens, and connection strings must
not appear in it.

## How AKS Desktop could consume Headlamp

### Immediate source distribution

Until packages exist, commit a small lock file instead of a Git link:

```json
{
  "schemaVersion": 1,
  "headlampVersion": "0.44.0",
  "source": {
    "kind": "git",
    "repository": "https://github.com/kubernetes-sigs/headlamp.git",
    "ref": "refs/tags/v0.44.0",
    "commit": "7e2f255cc256a16c39681ffea31fa16e11a11eaf",
    "tree": "6017e6fc330b7c5be930852093b97f173c9f7765"
  }
}
```

The resolver should fetch the advertised ref into a disposable/cache repository,
verify both the commit and Git tree object, export that tree, build unmodified
upstream source, and assemble AKS plugins and resources around it. A moved tag
then fails closed. GitHub's automatically generated source archives are not
guaranteed to remain byte-identical, so their compressed-file digest should not
be the long-term lock. A build that cannot use Git should consume a manually
uploaded immutable source release asset with a signed checksum instead.

The current `v0.44.0` tag is lightweight rather than signed. The interim phase
therefore relies on reviewed lock-file changes and Git object verification;
upstream signatures/provenance become mandatory for the target distribution.
This is source consumption, not the final package API, but it removes submodule
mechanics and the permanent fork.

#### Releases, forks, and local checkouts

The resolver should keep the build independent from where Headlamp comes from.
These source choices serve different purposes:

| Use | Source | Reproducibility rule |
| --- | --- | --- |
| Normal release | Canonical repository and a release tag | Pin and verify the commit and tree, as above. |
| Temporary fork | Fork repository and branch, tag, or pull-request ref | Pin and verify the reviewed commit and tree; never build a floating ref. |
| Published source asset | Manually attached release archive | Require an immutable URL, SHA-256, and preferably a signature/provenance. Do not use GitHub's generated source archive as the lock. |
| Local development | Developer-only path override | Permit dirty files for iteration, print the commit and dirty state, and reject this mode in CI and release builds. |

For example, testing a temporary fork changes only the Git identity in the
checked-in lock:

```json
{
  "schemaVersion": 1,
  "headlampVersion": "0.44.0-aks.1",
  "source": {
    "kind": "git",
    "repository": "https://github.com/example/headlamp.git",
    "ref": "refs/heads/aks-experiment",
    "commit": "<reviewed full commit SHA>",
    "tree": "<reviewed Git tree SHA>"
  }
}
```

The branch documents where to look for updates; the commit and tree determine
what is built. An update command may resolve a requested repository and ref, but
it should write the new commit and tree for review rather than silently building
the current branch tip.

For active development, support this sibling layout without changing the
checked-in lock:

```text
dev/
├── headlamp/
└── aks-desktop/
```

The resolver should accept an explicit, untracked local override such as
`../headlamp`, validate that it is a Headlamp Git worktree, and expose it through
the same build input used for locked sources. This lets a developer edit
Headlamp and AKS Desktop together without copying changes into the submodule or
publishing a fork first. The build must report the local HEAD and whether the
worktree is dirty so test results can be reproduced later. Local mode is an
intentional reproducibility escape hatch: release automation must disable it,
and a local path must never be written to the shared lock.

Released desktop installers remain unsuitable as build inputs because they
cannot be recomposed with AKS plugins and host services. A released *source*
version is supported either through its pinned Git tag/commit/tree or through a
manually published, digest-verified source asset.

Headlamp `v0.44.0` contains plugin SDK `0.14.0`, while the AKS plugin currently
declares `^0.13.1`; the migration must align and test the AKS plugin rather than
assuming compatibility.

### Target package/artifact set

The following names illustrate boundaries, not existing npm packages:

| Proposed unit | Contents | Delivery |
| --- | --- | --- |
| `@headlamp-k8s/plugin-api` | Supported TypeScript types and browser plugin API | npm |
| `@headlamp-k8s/frontend-assets` | Versioned, prebuilt static frontend and public-config schema | npm or release archive |
| `@headlamp-k8s/desktop-kit` | Electron shell source, typed host-extension API, and base builder configuration | npm |
| `headlamp-server-{os}-{arch}` | Compressed Go server binary and metadata | Signed GitHub/OCI release artifacts |
| `@headlamp-k8s/distribution` | Small lockstep manifest/resolver; no hidden unverified downloads | npm |

With the meta-package exact-pinning and exporting the JavaScript units, AKS
Desktop's root dependency could be only:

```json
{
  "dependencies": {
    "@headlamp-k8s/distribution": "0.45.0"
  }
}
```

AKS plugins would still declare the compatible plugin SDK for development; the
distribution manifest supplies the required API version so CI can reject skew.

Publishing platform server packages to npm is possible, using optional
dependencies selected by operating system and CPU. A signed distribution
manifest is a better default because the server is a Go artifact, release
checksums/signatures and SBOMs can cover every platform, and non-JavaScript
consumers can use the same files.

The logical distribution manifest should contain:

```json
{
  "schemaVersion": 1,
  "version": "0.45.0",
  "pluginApiVersion": "0.15",
  "artifacts": {
    "frontend": {"url": "...", "sha256": "..."},
    "desktopKit": {"npm": "@headlamp-k8s/desktop-kit@0.45.0"},
    "server": {
      "darwin-arm64": {"url": "...", "sha256": "..."},
      "linux-x64": {"url": "...", "sha256": "..."},
      "win32-x64": {"url": "...", "sha256": "..."}
    }
  }
}
```

All units should be produced from the same source tag and carry the same
release version. The resolver must fail on a platform without an entry and on
any digest, signature, schema, or plugin-API mismatch. It should materialize
artifacts during an explicit build step, not an npm `postinstall`.

### One package versus several

| Shape | Advantages | Disadvantages | Verdict |
| --- | --- | --- | --- |
| One npm package with source and all binaries | One dependency; offline cross-builds | Large cross-platform install; public registry size; coarse caching | Viable private/offline option |
| Independent npm packages | Clear boundaries; normal JS tooling; platform selection | Easy to create unsupported version combinations | Useful only with lockstep versions |
| Signed artifact manifest only | Language-neutral; natural for Go binaries; signatures/checksums/SBOMs | Needs a resolver and cache | Best native-artifact boundary |
| **Hybrid meta-package + signed manifest** | One update plus appropriate JS/native delivery | Requires upstream release work | **Recommended target** |

### Update workflow

A Headlamp update should become one automated pull request:

1. Change the single distribution version or source lock.
2. Verify signatures and SHA-256 values before extraction.
3. Reject an incompatible plugin API before building plugins.
4. Assemble AKS plugins, product resources, and pinned external tools without
   editing the Headlamp tree.
5. Build every supported OS/architecture and run plugin, Electron IPC,
   cluster-registration, installer, and startup smoke tests.
6. Review release notes and the public configuration schema diff.

No step should update a submodule pointer, merge a long-lived branch, or copy
secrets into frontend assets. Dependabot/Renovate can update npm units; a small
repository-owned updater can refresh the signed native-artifact lock only after
verification.

## Host APIs needed before removing the fork

The browser plugin API cannot implement privileged Electron behavior by itself.
Upstream should expose these generic, least-privilege host services:

1. **Command broker:** identify the calling plugin, accept executable plus
   argument arrays (not shell strings), resolve declared bundled tools, enforce
   executable/subcommand permissions, prompt for consent, stream output, and
   unsubscribe IPC listeners. Identity must come from the host's registered
   plugin context, never a caller-supplied string. AKS configuration requests
   `az`, `kubectl`, and `kubelogin` scopes; it must not hard-code a global
   consent bypass.
2. **Cluster-registration provider:** a plugin registers a typed provider; the
   host performs approved process/file operations. The AKS provider owns
   Azure/Arc choices, managed namespaces, Azure RBAC, and kubeconfig conversion,
   while the generic host honors `KUBECONFIG` and refreshes clusters.
3. **Namespaced secure storage:** Electron `safeStorage` behind a plugin-scoped
   key namespace and narrow preload API. Plugins must not read one another's
   values.
4. **OAuth/deep-link provider:** main-process browser flow, state/PKCE
   validation, configurable product protocol, and token storage through the
   namespaced service. Tokens never enter build/public configuration.
5. **Product/build kit:** product identity, artifact naming, targets, icons,
   legal resources, bundled plugins/tools, backend app name, and verification
   paths supplied by the product manifest.
6. **Frontend extension/config APIs:** public runtime product information,
   configurable empty/error/404/release-note content, conditional project
   overview sections, project-header navigation, default-disabled plugins, and
   a supported locale overlay.

These APIs turn useful differences into AKS configuration or plugin code.
Generic correctness, accessibility, table, theme, source-map, and backend fixes
should be contributed upstream without AKS switches. Headlamp `v0.44.0` supplies
comparable workload-log functionality through its exported Activity API, but
not the downstream inline `LogsViewer` interface. The
[commit audit](headlamp-fork-commit-audit.md#commit-ledger), particularly row
30, describes the product decision and AKS plugin migration required before
removing it.

## Alternatives

| Alternative | Update effort | Keeps AKS desktop behavior | Fork removed? | Main trade-off |
| --- | --- | --- | --- | --- |
| Pinned pristine Git tree/source asset | Low/medium | Yes, after extension APIs | Yes | AKS still builds Headlamp |
| Hybrid packages + signed manifest | **Low** | Yes | Yes | Requires upstream packaging/API work |
| Official desktop installer | Low | No | Yes | Cannot safely compose the product |
| Container or Helm chart | Low | Server only | Yes | Not a desktop shell |
| Derived AKS container from pinned base | Low | Browser/plugin subset | Yes | Electron-only capabilities need alternatives |
| External fork builds published artifacts | Medium | Yes | No; only the local submodule | Fork maintenance merely moves to CI |
| Small patch queue on pristine source | Medium | Yes | No; only the Git link | Patches still rebase and delay upstreaming |
| Git subtree/vendored source | High | Yes | No; same downstream delta | Larger repository; same merge burden |
| Keep the present submodule/fork | High over time | Yes | No | Lowest immediate migration risk |

An external artifact-producing fork is a useful temporary fallback if release
deadlines precede the host APIs, but it is not the end state: AKS still owns and
rebases the same code.

## Migration plan and exit criteria

### Phase 0: reduce the delta

- Treat the rebase as the main schedule risk: `v0.43.0..v0.44.0` contains 743
  commits (504 non-merge), and generated translations/snapshots enlarge the
  conflict surface.
- Rebase onto `v0.44.0`.
- Drop behavior already supplied upstream and squash fixup/generated commits.
- Submit the generic batches listed in the commit audit.
- Add behavior tests for every retained privileged capability.

### Phase 1: separate product assembly

- Introduce a validated AKS product manifest outside `headlamp/`.
- Stage plugins and external tools in a repository-owned assembly directory.
- Stop writing translations and resources into the Headlamp source tree.
- Keep the submodule temporarily, but build it without product edits.

### Phase 2: establish extension APIs

- Land the generic host and frontend APIs upstream.
- Move AKS registration, Azure policy, wording, and defaults to the AKS plugin
  and product manifest.
- Pin and test plugin API compatibility.

### Phase 3: remove the submodule

- Replace `.gitmodules`, the submodule pointer, and
  `scripts/headlamp-submodule.sh` with the verified source lock/resolver.
- Build a pristine verified source tree and assemble AKS Desktop externally.
- The exit test is a successful update to a newer upstream commit without an
  AKS patch applied inside the extracted tree.

### Phase 4: switch to published distributions

- Upstream publishes frontend assets, desktop kit, plugin API, per-platform
  server artifacts, signatures/checksums, provenance, and SBOMs from one tag.
- Replace the source lock with the lockstep distribution version.
- The final success criterion is one version-bump pull request that produces
  all AKS Desktop installers without checking out Headlamp source.

## Primary sources

- [Headlamp `v0.44.0` release and assets](https://github.com/kubernetes-sigs/headlamp/releases/tag/v0.44.0)
- [Private frontend package at `v0.44.0`](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/frontend/package.json)
- [Frontend build environment generation](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/frontend/make-env.js)
- [Backend environment/flag configuration](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/backend/pkg/config/config.go)
- [Embedded server artifact workflow](https://github.com/kubernetes-sigs/headlamp/blob/v0.44.0/.github/workflows/app-artifacts-embedded.yml)
- [Plugin SDK on npm](https://www.npmjs.com/package/@kinvolk/headlamp-plugin)
- [Plugin manager CLI on npm](https://www.npmjs.com/package/@headlamp-k8s/pluginctl)
- [Original npm-package proposal and maintainer response](https://github.com/kubernetes-sigs/headlamp/issues/197)
