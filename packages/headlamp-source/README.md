# Headlamp source package

This package skeleton materializes the complete Headlamp source tree at the
commit recorded in `headlampSource`. `source:prepare` copies the verified
upstream commit into the ignored `source/` directory and materializes npm's
ignored aggregate from the consumer's numbered patches; its other npm scripts
build the web/backend distribution, desktop applications, and containers.
The package also generates product manifests, stages shipped plugins, and
smoke-tests packaged applications from consumer configuration.
Consumers own any npm native dependency patches; this package has no install
lifecycle script.

## Consumer setup

Run `node --experimental-strip-types build/setup-npm.ts ci` from the consumer,
then run `node --experimental-strip-types build/setup-npm.ts run install:all`
explicitly before local source or application builds. Route additional
same-shell npm commands through the setup script; CI exports npm 12's path for
later steps.
`build:container` passes the recorded source commit and accepts a
`HEADLAMP_BUILD_MANIFEST` environment value as a Docker build argument, so the
container build does not require Git metadata.

## Script reference

Commands read the consumer repository from npm's `INIT_CWD` and its
`package.json#headlampSource` and `package.json#headlamp` configuration.

| npm command | Implementation | Purpose |
| --- | --- | --- |
| `source:prepare [-- --source <checkout>]` | `scripts/update-source.ts` | Materialize the configured, pinned Headlamp commit and npm's ignored aggregate. An existing checkout is optional. |
| `source:update -- --source <checkout> [--commit <sha>] [--base-tag <tag>]` | `scripts/update-source.ts` | Update the source pin, package metadata, generated npm patch, and lockfile from a verified checkout. |
| `patches:compose [-- --check]` | `scripts/compose-patches.ts` | Compose the ordered root `patches/series` into npm's generated package patch and update, or verify, its lockfile integrity. |
| `bundle:plugins` | `scripts/bundle-plugins.ts` | Validate, build, and stage plugins declared by the consumer under `headlamp.plugins`. |
| `manifest:generate` / `manifest:check` | `scripts/generate-product-manifest.ts` | Generate, or verify, the platform-specific product manifest and resource digests. |
| `smoke:app -- [--dist <dir>] [--executable <file>] [--port <port>] [--timeout <ms>] [--no-sandbox]` | `scripts/smoke-app.ts` | Start a packaged application headlessly and verify that its HTTP endpoint responds. |

The remaining files under `scripts/` are reusable library modules:

| Module | Purpose |
| --- | --- |
| `file-operations.ts` | Safe directory copying and path-pattern removal. |
| `paths.ts` | Resolution and containment checks for package, source, app, manifest, and distribution paths. |
| `product-manifest.ts` | Product-template creation from consumer configuration. |

Headlamp's existing npm commands are exposed without a second build
implementation:

- `install:all`, `build`, `build:backend`, and `build:frontend` install and
  build the source distribution.
- `build:app`, `build:app:<platform>`, and `build:app:unpacked` produce desktop
  applications.
- `build:container` and `build:plugins-container` produce container images.
- `start`, `start:backend`, `start:frontend`, and `start:app` run development
  targets.
- `test`, `lint`, `tsc`, and `verify:images` delegate validation to Headlamp;
  `test:helpers`, `test:package`, and `tsc:helpers` validate this package's
  reusable tooling and package contract.
