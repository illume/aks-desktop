# Maintenance

This document outlines the maintenance procedures for this project.

## Headlamp distribution

AKS Desktop depends on `@headlamp-k8s/headlamp-source`, an npm package containing
the complete pinned Headlamp source tree and npm scripts for applications and
containers. The package records upstream base tag `v0.44.0` and commit
`99a230be9c9c679a70d59c219cc246c00ae2be45`. npm verifies the package integrity
from `package-lock.json` and applies the root-owned patch declared by
`patchedDependencies`; there is no submodule or custom patch applicator.

To validate or update the distribution:

```bash
nvm use                         # Node.js version required by npm 12
npm ci                          # verify the source package and apply its patch
npm run headlamp:install        # explicitly install the source build toolchain
npm run test:headlamp-patches   # inspect npm's patch and package contract
npm run headlamp:assemble       # stage plugins, tools, and product configuration
npm run headlamp:doctor         # verify the generated product manifest
```

The repository requires npm 12 or newer because native dependency patches are
part of installation and are not lifecycle scripts. The source package itself
has no install lifecycle script; `headlamp:install` is an explicit command and
permits only the build dependencies reviewed in the consumer patch. Build with
`npm run build:linux`, `npm run build:mac`, `npm run build:win`, or
`npm run build:container`. After an application build,
`npm run test:distribution` verifies packaged tools and starts the application
in headless mode. Linux CI appends `-- --no-sandbox`; normal launches never
disable the sandbox.

An update changes the exact dependency version, package artifact, lockfile, and
native patch together. Use `npm patch update` after the package is published;
until then, refresh the local package artifact and regenerate the same root
patch. Product identity, update policy, legal documents, plugin workspaces,
defaults, and capability ceilings belong in the root `package.json` under
`headlamp`; AKS behavior belongs in plugin APIs. Do not edit the installed
package under `node_modules`.

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
