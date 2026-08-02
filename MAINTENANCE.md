# Maintenance

This document outlines the maintenance procedures for this project.

## Headlamp distribution

AKS Desktop depends on the unpacked npm package in
`packages/headlamp-source/`. It contains the complete pinned Headlamp source
tree and reusable npm scripts for source updates, patch composition, product
manifests, plugin bundling, application/container builds, and runtime smoke
tests. The package records upstream base tag `v0.44.0` and commit
`99a230be9c9c679a70d59c219cc246c00ae2be45`. The numbered files in
`patches/series` reference the root-owned, reviewable patch series. npm supports
one patch file per package version, so `npm run headlamp:patches` normalizes and
concatenates that series into the file declared by `patchedDependencies`. npm
verifies and applies the aggregate; there is no submodule or custom patch
applicator.
The same tag, branch, repository, and full commit are the single source of truth
in `package.json#headlampSource`.

To validate or update the distribution:

```bash
nvm use                         # Node.js version required by npm 12
npm ci                          # verify the source package and apply the patch series
npm run headlamp:install        # explicitly install the source build toolchain
npm run test:headlamp-patches   # inspect npm's patch and package contract
npm run headlamp:assemble       # stage plugins, tools, and product configuration
npm run headlamp:doctor         # verify the generated product manifest
```

The repository requires npm 12 or newer because native dependency patches are
part of installation and are not lifecycle scripts. The source package itself
has no install lifecycle script; `headlamp:install` is an explicit command and
permits only the build dependencies reviewed in the consumer patches. Build with
`npm run build:linux`, `npm run build:mac`, `npm run build:win`, or
`npm run build:container`. After an application build,
`npm run test:distribution` verifies packaged tools and starts the application
in headless mode. Linux CI appends `-- --no-sandbox`; normal launches never
disable the sandbox.

### Test or adopt another Headlamp commit

Check out the exact configured commit in a clean Headlamp worktree. To probe a
new commit without editing the configuration first, pass its full SHA:

```bash
git -C /path/to/headlamp checkout <full-commit-sha>
npm ci
npm run headlamp:source -- \
  --source /path/to/headlamp \
  --commit <full-commit-sha>
npm ci
npm run test:headlamp-patches
npm run test:build
```

`headlamp:source` verifies the clean worktree's `HEAD`, replaces
`packages/headlamp-source/source/` with only Git-tracked files, derives the
package version from the base tag and SHA, and updates the package metadata,
exact dependency, local lockfile resolution, patch selector, and patch
integrity. It does not apply the patches; the second `npm ci` is the
authoritative npm-native patch check. Update `baseTag` in
`package.json#headlampSource` when the upstream release baseline changes. Stage
the complete source update with `git add -f packages/headlamp-source` only after
the replacement passes.

The
[`Headlamp main compatibility`](.github/workflows/headlamp-main-compatibility.yml)
workflow resolves `main` to a full SHA every day, prepares that source package,
lets npm apply the AKS patch series, builds an unpacked AKS Desktop application, runs
TypeScript and lint checks, and starts the packaged application in headless
mode. It never changes the committed pin.

### Update patches after a conflict

If `npm ci` reports that a patch does not apply, keep the newly generated
source directory and rebase the numbered patches in `patches/series`, in order.
The package is local until `@headlamp-k8s/headlamp-source` is published, so npm
cannot fetch its clean baseline for `npm patch update`. This maintenance-only
rebase uses Git; normal installs continue to use npm as the only patch
applicator:

```bash
work=$(mktemp -d)
cp -a packages/headlamp-source "$work/edit"
read -r _ scope patch < "$PWD/patches/series"
target="$work/edit/source"
git -C "$target" init
git -C "$target" add -A
git -C "$target" \
  -c user.name=patch -c user.email=patch@example.invalid \
  commit -m baseline
git -C "$target" apply --reject "$PWD/patches/$patch"
```

Each `source` entry in `patches/series` is maintained against a clean Headlamp
worktree; each `package` entry is maintained against the source-bearing npm
package. Resolve any `*.rej`, remove the reject files, regenerate that patch
against the preceding committed state, and commit it in the temporary
repository before continuing. After the `source` entries, remove the temporary
`source/.git`, initialize the package root, and repeat for the `package`
entries:

```bash
git -C "$target" add -N .
git -C "$target" diff --binary --full-index HEAD -- > "$PWD/patches/$patch"
git -C "$target" add -A
git -C "$target" \
  -c user.name=patch -c user.email=patch@example.invalid \
  commit -m "$patch"
```

After all entries apply, compose the npm-required aggregate and validate it:

```bash
npm run headlamp:patches
npm ci
npm run test:headlamp-patches
```

Run the Headlamp TypeScript, lint, focused test, build, and packaged-runtime
checks affected by the rebased hunks. Never edit the installed package under
`node_modules`.

### Ship static plugins

Headlamp's desktop plugin manager lists plugins in the packaged `.plugins`
directory as `shipped`. The reusable `bundle:plugins` command builds that
directory from `package.json#headlamp.plugins` before application or container
assembly. A plugin may use exactly one source:

- a repository-relative `source` string for a workspace that must run `npm ci`
  and `npm run build`;
- `source: {"type": "package"}` for an exact, lockfile-verified root npm
  dependency that already contains `dist/`; or
- an HTTPS `archive` or local `file` with `packageName` and `sha256`, which the
  Electron shipped-plugin installer verifies before extraction.

For example, a prebuilt package declaration is:

```json
{
  "name": "example-plugin",
  "packageName": "@example/headlamp-plugin",
  "source": {"type": "package"},
  "enabledByDefault": false
}
```

Declare `@example/headlamp-plugin` at an exact version in the root dependencies.
npm then verifies its lockfile integrity, while the bundler verifies the package
identity, rejects name collisions and paths outside `node_modules`, copies the
complete distribution, and records the product's default-enabled policy.
Workspace and package sources are staged once and reused by desktop and source
container builds. Archive/file sources currently feed the Electron installer;
do not use them for a cross-target product until the container fetcher shares
the same digest-verified manifest implementation.

Product identity, update policy, legal documents, plugin workspaces, defaults,
and capability ceilings belong in the root `package.json` under `headlamp`; AKS
behavior belongs in plugin APIs.

See the [Headlamp packaging strategy](docs/headlamp-packaging.md), detailed
[distribution builds](docs/headlamp-distribution-builds.md), and
[commit audit](docs/headlamp-fork-commit-audit.md).

## Code Quality

For Headlamp patches and changes in the main repository, we
should all follow best practices to ensure high code quality and maintainability. This includes:

Follow atomic commits and PRs, with clear messages, and keep changes small and focused. This
makes it easier to review, test, and revert changes if necessary.

Atomic commits are commits that contain a single logical change. This means that each commit should
be self-contained and should not depend on other commits. This makes it easier to understand the
history of the project and to revert changes if necessary. This is not about one commit per PR, nor one file change per commit, but about one logical change per commit. E.g. if a PR implements a new feature, it may contain multiple commits, but each commit should implement a single aspect of that feature.

Each commit (not just each PR) should build and pass all tests. This ensures that the project is always in a
working state and will help with bisecting issues.

When writing commit messages, follow these guidelines:

- Use the imperative mood in the subject line (e.g., "Fix bug" instead of "Fixed bug" or "Fixes bug").
- Limit the subject line and body to 72 characters or less.
- Use the body to explain what and why vs. how.

### Tests

As new functionality is added, tests of that functionality should be added to an automated test suite.
As bugs are fixed, there should be a test covering that bug fix.

## Translations

Translation strings from the installed Headlamp source package and
`plugins/aks-desktop/` are managed via OneLocBuild. English source files are
collected into `Localize/locales/en/`, and OneLocBuild produces translated files
into `Localize/locales/{lang}/`. The `Localize/LocProject.json` file configures
this pipeline.

### Workflow

1. **Collect English keys**: Run `npm run i18n:collect` to copy English locale files from the installed Headlamp source package and `plugins/aks-desktop/` into `Localize/locales/en/`. These are the source files OneLocBuild uses.

2. **Translate**: OneLocBuild picks up the English files and produces translated files in `Localize/locales/{lang}/` for each target language.

3. **Distribute**: Run `npm run i18n:distribute` to copy translated files from `Localize/locales/` back to the installed Headlamp source and plugin locale directories, fully replacing their content for the build.
