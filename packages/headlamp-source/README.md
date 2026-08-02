# Headlamp source package

This package skeleton materializes the complete Headlamp source tree at the
commit recorded in `headlampSource`. `source:prepare` copies the verified
upstream commit into the ignored `source/` directory; its other npm scripts
build the web/backend distribution, desktop applications, and containers.
Consumers own any npm native dependency patches; this package has no install
lifecycle script.

Run `source build/setup-npm.sh` from the consumer before `npm ci`, then run
`npm run install:all` explicitly before local source or application builds.
`build:container` passes the recorded source commit and accepts a
`HEADLAMP_BUILD_MANIFEST` environment value as a Docker build argument, so the
container build does not require Git metadata.
