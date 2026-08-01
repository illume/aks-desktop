# Headlamp downstream commit audit

This is the commit-level companion to
[Removing the Headlamp submodule](headlamp-packaging.md). It answers which
changes should go upstream and where useful AKS Desktop differences should live
after the fork is removed.

See the strategy's [terminology table](headlamp-packaging.md#terminology) for
standard technical abbreviations.

## Scope and method

- Audited downstream tip: `4d00ea845c8f4faf2c7fde887f6a4bf9da2000c6`.
- Baseline: upstream `v0.43.0`, commit
  `2ca733d234a5eca4159ccd28279c0f8787fbb6e3`.
- Distance: 117 commits, comprising 115 non-merge commits and two merges.
- Compared with upstream `v0.44.0` and upstream `main` at
  `506465d78ca162f65e46c57fab7b014fd771d047`.
- `git cherry` found all 115 downstream patches unmatched on upstream `main`;
  a strict `git range-diff` found no matches either. Subject similarity is
  therefore not treated as proof that a patch landed.
- Semantic matches were checked in current source. They remain rebase
  hypotheses until the relevant behavior tests pass.

The order below is the chronological inventory generated from the commit graph.
Commits on the two merged side branches are included. Same-day topology can
produce a different display order without changing the set.

## Status at a glance

Every audited commit has a primary disposition:

| Measure | Result |
| --- | --- |
| Classified inventory | 115 of 115 non-merge commits |
| Upstream work | 61 rows: 37 fixes and 24 extensions |
| AKS-owned work | 7 rows: 3 configuration changes and 4 plugin changes |
| No independent submission | 47 rows: 36 folds and 11 removals |
| Patch artifacts | 69 upstream candidates and 69 matching fork cleanups, all linked from 63 ledger rows |
| Unresolved classifications | None |
| Open product decisions | Row 43: confirm the supported AKS Desktop architectures before declaring package targets |

These are mutually exclusive counts based on the leading decision in each row.
A combined decision such as **Upstream extension + AKS plugin** is counted as
upstream work but still has the stated AKS migration.

A linked patch is a candidate implementation against the commits recorded
above, not evidence of upstream acceptance. Rebase it onto the intended
submission base and rerun its checks before opening a pull request. The
downstream patches are migration aids: when a rebase can omit the original fork
commit, prefer that over applying a cleanup patch.

## Decision labels and replacement areas

The ledger uses full labels rather than abbreviations so each row can be read
without repeatedly consulting a key.

| Decision | Meaning |
| --- | --- |
| **Upstream fix** | Rebase and submit as a product-neutral upstream change with tests. No AKS switch should remain. |
| **Upstream extension** | Upstream a generic extension or configuration interface, not the hard-coded AKS implementation. |
| **AKS configuration** | Express in the AKS product manifest or external assembly; do not upstream as core code. |
| **AKS plugin** | Move to the AKS plugin or provider after the required generic extension exists. |
| **Fold** | Squash into the named feature or commit; it is not an independent change. |
| **Remove** | Obsolete or supplied by current upstream; confirm with behavior tests after rebase. |

The replacement names used in the ledger mean:

| Replacement | Required boundary |
| --- | --- |
| **Product identity** | Product name/version, app ID, protocol, icons, legal files, targets, artifact names, and verification paths in a product/build manifest. |
| **Public frontend configuration** | Non-secret frontend runtime product data and branded messages/assets. |
| **Plugin bundle** | Manifest of bundled plugins, canonical IDs, sources, enabled defaults, and compatibility. |
| **External tools** | Per-platform external-tool paths, versions, and verified digests. |
| **Command execution** | Permissioned host command broker using plugin identity, executable plus argument arrays, exact scopes, and consent. |
| **Cluster registration** | Generic host cluster-provider interface with AKS/Arc registration policy implemented by the AKS provider. |
| **Secure storage** | Namespaced Electron secure-storage interface. |
| **OAuth sign-in** | Generic main-process OAuth/deep-link provider using secure storage. |
| **Project extensions** | Supported project extension hooks; AKS project policy remains in the plugin. |
| **Translations** | Supported locale extension/overlay; generated AKS strings remain outside core. |

## Required application order

The chains below are independent unless one explicitly refers to another. They
record semantic prerequisites, not a guarantee that every mailbox patch applies
sequentially without rebasing. Arrows mean “must precede”; they do not mean the
patches belong in one pull request.

| Chain | Order |
| --- | --- |
| Ordered fixes | Apply the four row 68 patches and the five row 92 patches in their listed order. Apply row 86 before row 98. |
| Build and plugin manifests | Rows 47 and 23 were authored against the same baseline and overlap in `setup-plugins.js`; reconcile them first, preserving both `enabledByDefault` and external-manifest selection. Then apply row 2 product metadata → row 41 platform metadata → row 43 targets → row 32 resources → row 31 verification. |
| Privileged capabilities | In row 23, apply the external manifest before packaged-plugin identity. In row 106, apply command capabilities → explicit prefixes → option isolation; then row 22 verified tools → row 19 cluster providers. Apply row 19 product policy only after packaged identity, option isolation, and cluster providers; apply row 82 provider context last. |
| OAuth sign-in | Rows 96 (product protocol) and 78 (secure storage) → row 79 provider registry. |
| Fork cleanup | Complete the row's AKS configuration or plugin migration first, then pair its cleanup with the upstream replacement. Never ship a cleanup alone. |

## Commit ledger

Candidate patches are linked next to the matching cleanup and any required AKS
Desktop migration. This audit describes those migrations but does not implement
AKS plugin changes.

| # | Commit | Decision / replacement area | What to do |
| ---: | --- | --- | --- |
| 1 | `863957d9d` Add kubectl to valid commands | **Upstream extension / Command execution** | Declare the AKS plugin's `kubectl` scope; remove the global hard-coded allowlist entry. |
| 2 | `af6132f55` Rebrand package name | **Upstream extension + AKS configuration / Product identity** | Apply [app: configure product metadata from build manifests](headlamp-upstream-patches/headlamp-upstream-build-manifest-product-metadata.patch) and [externalize package product metadata](headlamp-upstream-patches/headlamp-downstream-externalize-product-metadata.patch). Declare the package name, display name, version, application ID, artifact template, and protocol in the external manifest. |
| 3 | `35c871acd` Replace icons | **AKS configuration / Product identity** | Supply the AKS icon set during assembly. |
| 4 | `c4b0bb453` Use package name in artifact names | **Upstream fix / Product identity** | Apply [app: use the package name in artifact filenames](headlamp-upstream-patches/headlamp-upstream-artifact-package-name.patch) and [drop the duplicated fork override](headlamp-upstream-patches/headlamp-downstream-remove-artifact-package-name-fix.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 5 | `c25c2099b` Remove Linux `executableName` | **Upstream fix / Product identity** | Apply [app: derive the Linux executable name](headlamp-upstream-patches/headlamp-upstream-linux-executable-name.patch) and [drop the duplicated fork override](headlamp-upstream-patches/headlamp-downstream-remove-linux-executable-name-fix.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 6 | `43dc0e88f` Cache shell environment | **Remove / Command execution** | Upstream `63b629102` and `47c426634` provide newer login-shell caching; run command tests after rebase. |
| 7 | `b6b1c330a` AKS plugin command support | **Fold / Command execution** | Fold into row 106; replace plugin-name branches with broker capabilities. |
| 8 | `920dd7a8b` Frontend kubectl integration | **Fold / Command execution** | Fold into row 106; consume the supported browser command API from the plugin. |
| 9 | `290767161` Update `productName` | **Fold / Product identity** | Fold into row 2 and set `displayName`. |
| 10 | `b2e6b1d94` Include PATH to avoid `ENOENT` | **Remove / Command execution** | Current upstream lazily caches the login-shell environment, merges it with the live process environment, and passes it to direct command spawning. Drop the older implementation and run the command tests on Windows. |
| 11 | `82365514d` Default AKS command consent | **Upstream extension / Command execution** | Use declared, reviewable command scopes; do not silently bypass consent in core. |
| 12 | `44422b2e1` Fix az/kubectl consent | **Fold into row 11** | Preserve final behavior in command-broker tests. |
| 13 | `dd207f955` Add kubelogin | **Upstream extension / Command execution, external tools** | Declare the pinned tool and only its required command scopes. |
| 14 | `bb74bc751` Bundle Azure CLI | **AKS configuration / External tools** | Assemble the pinned platform artifact outside Headlamp. |
| 15 | `915036dc1` Move Azure CLI folder | **Fold / External tools** | Make the final path a product-manifest resource mapping. |
| 16 | `c09a33860` Allow registration script | **Remove / Cluster registration** | The script was removed by row 19; do not expose it through the broker. |
| 17 | `c79db3039` Remove kubelogin permission | **Fold into row 13** | Keep only the final least-privilege scope set. |
| 18 | `3d7ddb3a6` Update branded snapshot | **Fold / Product identity** | Regenerate product tests from the external branding config. |
| 19 | `1d1f03e58` Programmatic AKS registration | **Upstream extension + AKS plugin / Cluster registration** | Apply [app: authorize package-declared cluster providers](headlamp-upstream-patches/headlamp-upstream-cluster-provider-capabilities.patch) and [replace the positional AKS registration bridge](headlamp-upstream-patches/headlamp-downstream-replace-aks-cluster-registration.patch). Then apply [app: enforce product-owned plugin capability ceilings](headlamp-upstream-patches/headlamp-upstream-product-plugin-capability-policy.patch) and [enforce those ceilings in the fork](headlamp-upstream-patches/headlamp-downstream-enforce-product-plugin-capability-policy.patch). Declare each packaged plugin's allowed providers and commands in the build manifest; user or development overrides receive no privileged capabilities. |
| 20 | `72e169328` Windows quoting fix | **Remove / Command execution** | Upstream `v0.44.0` already passes the executable directly to `spawn` with `shell: false`; drop this duplicate after command tests. |
| 21 | `ac7319372` Avoid shell except on Windows | **Upstream fix / Command execution** | Apply [app: skip Unix shell lookup on Windows](headlamp-upstream-patches/headlamp-upstream-windows-shell-lookup.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-windows-shell-lookup-fix.patch). |
| 22 | `d125e6505` Azure CLI path through env | **Upstream extension / Command execution, external tools** | Apply [app: resolve verified external tools](headlamp-upstream-patches/headlamp-upstream-verified-external-tools.patch) and [replace AKS path lookup with verified tool IDs](headlamp-upstream-patches/headlamp-downstream-replace-external-tool-paths.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 23 | `69e20c5dd` Exclude catalog plugins | **Upstream extension + AKS configuration / Plugin bundle** | Apply [app: select an external, digest-verified plugin manifest](headlamp-upstream-patches/headlamp-upstream-external-plugin-manifest.patch) and [externalize the AKS plugin-bundle policy](headlamp-upstream-patches/headlamp-downstream-externalize-plugin-bundle.patch). Then apply [app: verify packaged plugin identities](headlamp-upstream-patches/headlamp-upstream-packaged-plugin-identity.patch) and [bind fork bundles to those identities](headlamp-upstream-patches/headlamp-downstream-bind-packaged-plugin-identities.patch). Product assembly must set `HEADLAMP_BUILD_MANIFEST`, and every plugin entry must declare the exact `packageName`, before cleanup. |
| 24 | `65e207537` Remove Artifact Hub proxy config | **Fold into row 23 / Plugin bundle** | Keep proxy policy in the external manifest selected by the [row 23 patch](headlamp-upstream-patches/headlamp-upstream-external-plugin-manifest.patch). |
| 25 | `33f4cfb35` Change empty cluster message | **Upstream extension + AKS plugin / Public frontend configuration** | Apply [frontend: register a product-owned cluster empty state](headlamp-upstream-patches/headlamp-upstream-cluster-empty-state.patch) and [remove the Azure-specific core rendering](headlamp-upstream-patches/headlamp-downstream-remove-cluster-empty-state.patch). Register the sign-in and provider choices before applying the cleanup. |
| 26 | `24889f999` Update package name and author | **Fold / Product identity** | Fold into row 2. |
| 27 | `5eb5cd53e` Build with AKS version | **Fold into row 2 / Product identity** | Generate the manifest's product version from the AKS release source. |
| 28 | `d68693b04` Show AKS version in About | **Upstream extension / Public frontend configuration** | Apply [frontend: support a distribution product version](headlamp-upstream-patches/headlamp-upstream-product-version.patch) and [drop the hard-coded AKS version helper](headlamp-upstream-patches/headlamp-downstream-remove-product-version-fix.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 29 | `067bf68f3` Show AKS version in top bar | **Fold / Public frontend configuration** | The [product-version patch](headlamp-upstream-patches/headlamp-upstream-product-version.patch) supplies the same value to the top bar. |
| 30 | `024ec74a7` New LogsViewer | **Upstream extension / Remove** | Apply [frontend: export embeddable workload logs](headlamp-upstream-patches/headlamp-upstream-embeddable-workload-logs.patch) and [replace the duplicate `LogsViewer`](headlamp-upstream-patches/headlamp-downstream-remove-logs-viewer.patch). Migrate the AKS Logs tab to `WorkloadLogs` before cleanup. |
| 31 | `7725d00f3` Verify bundled tools | **Upstream extension + AKS configuration / External tools** | After row 32, apply [app: verify packaged resources from build manifests](headlamp-upstream-patches/headlamp-upstream-build-manifest-resource-verification.patch) and [replace product-specific tool verification](headlamp-upstream-patches/headlamp-downstream-replace-tool-verification.patch). Wire the generated external manifest before cleanup, with a SHA-256 digest and target platforms for every packaged tool. |
| 32 | `ed960d0a3` Add external tools to macOS | **Upstream extension + AKS configuration / External tools** | Apply [app: configure platform resources from build manifests](headlamp-upstream-patches/headlamp-upstream-build-manifest-resources.patch) and [externalize bundled tool resources](headlamp-upstream-patches/headlamp-downstream-externalize-bundled-resources.patch). Resolve each resource relative to the selected manifest and declare it per platform. |
| 33 | `9a3ccb390` Remove unscoped external resource | **Fold into row 32 / External tools** | Keep only the final platform-scoped manifest mapping. |
| 34 | `a013f5330` Add DMG license | **Upstream fix** | Apply [app: add generic DMG license support](headlamp-upstream-patches/headlamp-upstream-dmg-license.patch) and [drop the duplicated fork support](headlamp-upstream-patches/headlamp-downstream-remove-dmg-license-fix.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 35 | `5e79994e5` Conditional project overview sections | **Upstream fix / Project extensions** | Apply [frontend: support conditional project overview sections](headlamp-upstream-patches/headlamp-upstream-conditional-project-overview-sections.patch) and [drop the duplicated fork extension](headlamp-upstream-patches/headlamp-downstream-remove-conditional-project-overview-sections-fix.patch). |
| 36 | `e0f08105d` Suppress az confirmation | **Fold into row 11** | Represent any product-approved scope in policy; do not hard-code AKS bypasses. |
| 37 | `d484bcd0f` Disable release notes | **Upstream fix + AKS configuration / Public frontend configuration** | Apply [app: cover configurable update checks](headlamp-upstream-patches/headlamp-upstream-configurable-update-checks.patch) and [drop the hard-coded update disable](headlamp-upstream-patches/headlamp-downstream-remove-disabled-update-checks.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 38 | `0f537cf57` Add LogsViewer index | **Fold into row 30** | Remove it with the [ready row 30 cleanup](headlamp-upstream-patches/headlamp-downstream-remove-logs-viewer.patch) after the plugin migration. |
| 39 | `6e70e0740` Add cached icons | **Fold / Product identity** | Generate/copy all required icon variants during assembly. |
| 40 | `a1d884296` Fix app builds in CI | **Fold into rows 2 and 23 / Product identity** | The row 23 manifest selection removes parent-repository probing; the [row 2 metadata patch](headlamp-upstream-patches/headlamp-upstream-build-manifest-product-metadata.patch) supplies the release identity explicitly. |
| 41 | `f45b3b90c` Fix package for macOS build | **Upstream extension + AKS configuration / Product identity** | Apply [app: configure platform product metadata](headlamp-upstream-patches/headlamp-upstream-build-manifest-platform-metadata.patch) and [externalize platform product metadata](headlamp-upstream-patches/headlamp-downstream-externalize-platform-metadata.patch). Only the allowlisted application ID, version, name, executable, and icon fields cross this boundary; signing policy remains in the product pipeline. |
| 42 | `12b579560` Add `secondaryContrastText` | **Upstream fix** | Apply [frontend: support a secondary contrast theme color](headlamp-upstream-patches/headlamp-upstream-secondary-theme-contrast.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-theme-contrast-fix.patch). |
| 43 | `645f38d2e` Build arm64 only | **Upstream extension + AKS configuration / Product identity** | Apply [app: configure package targets from build manifests](headlamp-upstream-patches/headlamp-upstream-build-manifest-targets.patch) and [externalize package target selection](headlamp-upstream-patches/headlamp-downstream-externalize-package-targets.patch). Declare a non-empty target list using validated Electron architectures; confirm whether AKS still excludes x64. |
| 44 | `c01009765` Update icons | **Fold into row 3** | Keep only the current AKS icon set. |
| 45 | `ceea7720d` Update Azure logo | **Fold into row 25 / Product identity, public frontend configuration** | Render the product-owned logo inside the registered cluster empty state; do not edit Headlamp's core icon. |
| 46 | `bd39620b1` Reload after cluster deletion | **Upstream fix** | Apply [frontend: reload after successful cluster deletion](headlamp-upstream-patches/headlamp-upstream-cluster-deletion-reload.patch) and [drop the duplicated fork reload](headlamp-upstream-patches/headlamp-downstream-remove-cluster-deletion-reload-fix.patch). |
| 47 | `2ce445ee1` Default-disabled plugins | **Upstream fix / Plugin bundle** | Apply [app: support default-disabled bundled plugins](headlamp-upstream-patches/headlamp-upstream-default-disabled-plugins.patch) and [drop the duplicated fork support](headlamp-upstream-patches/headlamp-downstream-remove-default-disabled-plugins-fix.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 48 | `a2be5742f` Add disabled Kaito plugin | **Fold into rows 23 and 47 / Plugin bundle** | Declare Kaito, its SHA-256 archive digest, and its disabled default in the external product manifest. |
| 49 | `7a830d425` Add Microsoft headers | **Fold** | Keep notices only on AKS-owned files after extraction; do not patch upstream files. |
| 50 | `5fae2b773` Separate managed projects by cluster | **Upstream extension + AKS plugin / Project extensions** | Apply [frontend: support custom project grouping](headlamp-upstream-patches/headlamp-upstream-project-grouping.patch) and [replace the AKS-specific grouping fork](headlamp-upstream-patches/headlamp-downstream-replace-project-grouping.patch). After adopting the API, register the AKS grouping callback. |
| 51 | `4d854f759` Add Legal tab | **Upstream extension / Product identity** | Apply [app: expose manifest-declared legal documents](headlamp-upstream-patches/headlamp-upstream-legal-documents.patch) and [replace the branded legal dialog](headlamp-upstream-patches/headlamp-downstream-remove-branded-legal-dialog.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 52 | `40364e142` Update 404 page | **Upstream extension + AKS configuration / Public frontend configuration** | Apply [frontend: read product-owned error and not-found content](headlamp-upstream-patches/headlamp-upstream-product-error-content.patch) and [remove branded core assets and strings](headlamp-upstream-patches/headlamp-downstream-remove-branded-error-content.patch). Supply `REACT_APP_HEADLAMP_NOT_FOUND_PAGE_TITLE` and `REACT_APP_HEADLAMP_NOT_FOUND_PAGE_GRAPHIC` during product assembly. |
| 53 | `e697c0aaf` Override macOS version | **Fold / Product identity** | Use the single product version source from row 27. |
| 54 | `578cd9cb6` Azure-RBAC-only kubelogin auth | **AKS plugin / Cluster registration** | Keep Azure auth selection in the AKS provider. |
| 55 | `fcf1a7759` Replace error page | **Fold into row 52 / Public frontend configuration** | Supply `REACT_APP_HEADLAMP_ERROR_PAGE_TITLE` and `REACT_APP_HEADLAMP_ERROR_PAGE_GRAPHIC`; omitted or blank values retain Headlamp defaults. |
| 56 | `5504295b8` Comment default consent | **Fold into row 11** | Document the generic policy instead of retaining a code-only commit. |
| 57 | `c5a969eab` Open ViewButton activity on right | **Upstream fix** | Apply [frontend: open resource view beside current content](headlamp-upstream-patches/headlamp-upstream-view-button-split-right.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-view-button-split-right-fix.patch). |
| 58 | `00320948b` Stop retries for sub-500 responses | **Upstream fix** | Apply [frontend: avoid retrying permanent HTTP errors](headlamp-upstream-patches/headlamp-upstream-query-retry-policy.patch) and [drop the duplicated fork policy](headlamp-upstream-patches/headlamp-downstream-remove-query-retry-policy-fix.patch). |
| 59 | `06f1208e6` Handle allowed namespaces in list queries | **Upstream fix** | Apply [frontend: fetch allowed namespaces individually](headlamp-upstream-patches/headlamp-upstream-allowed-namespace-list.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-allowed-namespace-list-fix.patch). |
| 60 | `edcdb2ba4` Correct plugin source-map offset | **Upstream fix** | Apply [frontend: correct plugin source-map offsets](headlamp-upstream-patches/headlamp-upstream-plugin-source-map-offset.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-plugin-source-map-offset-fix.patch). |
| 61 | `a73b4302a` Move `getAllowedNamespaces` | **Fold into row 59** | Move only if needed by the final namespace design; the export already exists upstream. |
| 62 | `c9ec6c99c` Update branded error snapshots | **Fold into row 55** | Regenerate product-level tests. |
| 63 | `41d003eca` Import managed-namespace project | **AKS plugin / Cluster registration, project extensions** | Keep managed-namespace semantics in the AKS provider/plugin. |
| 64 | `cdee9d62b` Include kubelogin script conditionally | **Fold into row 54** | Resolve the declared tool only for clusters that need it. |
| 65 | `5f7ade8ca` Honor Table selection/top-bar props | **Upstream fix** | Apply [frontend: honor Table toolbar and selection props](headlamp-upstream-patches/headlamp-upstream-table-props.patch) and [drop the duplicated fork fixes](headlamp-upstream-patches/headlamp-downstream-remove-table-props-fix.patch). |
| 66 | `db7e2db03` Expose desktop platform | **Upstream fix** | Apply [app: expose the platform through the typed desktop API](headlamp-upstream-patches/headlamp-upstream-desktop-platform.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-desktop-platform-fix.patch). |
| 67 | `5944280a5` Override Linux product name | **Fold into row 41 / Product identity** | Set the Linux product and executable names in the platform metadata. |
| 68 | `d709d2ddf` Add base Kubernetes Mock Service Worker handlers | **Upstream fix** | Apply [frontend: mock Custom Resource Definition lists](headlamp-upstream-patches/headlamp-upstream-storybook-crd-mocks.patch) and [drop the duplicated fork handlers and historical snapshots](headlamp-upstream-patches/headlamp-downstream-remove-storybook-crd-mocks-fix.patch). Apply [frontend: mock cluster-wide pod lists](headlamp-upstream-patches/headlamp-upstream-storybook-pod-mocks.patch) and [drop the duplicated fork handler and historical snapshot](headlamp-upstream-patches/headlamp-downstream-remove-storybook-pod-mocks-fix.patch). Apply [frontend: mock apps workload lists](headlamp-upstream-patches/headlamp-upstream-storybook-apps-workload-mocks.patch) and [drop the duplicated fork handlers and historical snapshots](headlamp-upstream-patches/headlamp-downstream-remove-storybook-apps-workload-mocks-fix.patch). Apply [frontend: mock batch workload lists](headlamp-upstream-patches/headlamp-upstream-storybook-batch-workload-mocks.patch) and [drop the duplicated fork handlers and historical snapshots](headlamp-upstream-patches/headlamp-downstream-remove-storybook-batch-workload-mocks-fix.patch). |
| 69 | `013129c89` Fix GraphView CRD watch story | **Upstream fix** | Apply [frontend: avoid Custom Resource Definition watches in the GraphView story](headlamp-upstream-patches/headlamp-upstream-graphview-crd-watch.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-graphview-crd-watch-fix.patch). |
| 70 | `dd6cf9ae4` Fix docs TypeScript errors | **Remove** | The current upstream documentation build passes, and plugin locale metadata now has the dedicated `PluginPackageInfo` type. |
| 71 | `5e3c5e26c` Fix tooltip landmark check | **Upstream fix** | Apply [end-to-end tests: exclude tooltips from landmark checks](headlamp-upstream-patches/headlamp-upstream-tooltip-landmark-check.patch) and [drop the duplicated fork test fix](headlamp-upstream-patches/headlamp-downstream-remove-tooltip-landmark-check-fix.patch). |
| 72 | `2f54e5cde` Fix log-search e2e test | **Fold into row 30** | Replace it with the ready upstream workload-log and `LogViewer` coverage during the row 30 cleanup. |
| 73 | `53917bfee` Use AKS HTML title | **Upstream fix / Public frontend configuration** | Apply [frontend: include product metadata in document titles](headlamp-upstream-patches/headlamp-upstream-product-document-title.patch) and [drop the hard-coded AKS title](headlamp-upstream-patches/headlamp-downstream-remove-product-document-title-fix.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 74 | `642809609` Fix Electron zoom menu | **Upstream fix** | Apply [app: restore zoom actions for plugin-provided menus](headlamp-upstream-patches/headlamp-upstream-electron-zoom-menu-actions.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-electron-zoom-menu-fix.patch). |
| 75 | `ee162d9af` Expand locales | **Upstream extension / Translations** | Apply [frontend: add Czech, Hungarian, Indonesian, Dutch, Polish, Brazilian Portuguese, Swedish, and Turkish locales](headlamp-upstream-patches/headlamp-upstream-generic-locale-packs.patch) and [replace the fork-wide locale rewrite](headlamp-upstream-patches/headlamp-downstream-remove-locale-rewrite.patch). |
| 76 | `3b01fe701` Ignore generated resources | **Fold / Product identity** | Ignore outputs in the AKS assembly workspace, not upstream source. |
| 77 | `195494e46` Announce EmptyContent | **Remove** | The final fork and upstream `EmptyContent.tsx` are identical; table live regions now cover the retained behavior. |
| 78 | `076a7feda` Add Electron secure storage | **Upstream extension / Secure storage** | Apply [app: expose namespaced plugin secure storage](headlamp-upstream-patches/headlamp-upstream-plugin-secure-storage.patch) and [replace renderer-global storage with plugin capabilities](headlamp-upstream-patches/headlamp-downstream-replace-plugin-secure-storage.patch). After adopting the API, migrate GitHub token access to the injected adapter. |
| 79 | `e528e6a05` Add GitHub OAuth flow | **Upstream extension / OAuth sign-in** | Apply [app: register OAuth callback providers](headlamp-upstream-patches/headlamp-upstream-oauth-provider-registry.patch) and [register the GitHub OAuth adapter](headlamp-upstream-patches/headlamp-downstream-register-github-oauth-provider.patch). |
| 80 | `da5a560ed` Move OAuth tests to Vitest | **Fold into row 79** | Include tests with the generalized provider. |
| 81 | `a20c30755` Stabilize EmptyContent timing | **Remove** | Its effect is absent from the final fork; there is no remaining patch to upstream. |
| 82 | `0fa88cf56` Respect `KUBECONFIG` when writing | **Upstream extension + AKS plugin / Cluster registration** | Apply [app: pass the effective host kubeconfig context to providers](headlamp-upstream-patches/headlamp-upstream-cluster-provider-context.patch) and [move AKS write-target selection into the provider](headlamp-upstream-patches/headlamp-downstream-use-host-kubeconfig-provider-context.patch). The host uses backend precedence: command-line path, `HEADLAMP_CONFIG_KUBECONFIG`, `KUBECONFIG` path list, then the standard home path. |
| 83 | `b8f52f6f4` Remove Azure credential format | **AKS plugin / Cluster registration** | Keep this Azure/kubelogin policy in the AKS provider. |
| 84 | `a6e5b073a` Accessible Table column selector | **Upstream fix** | Apply [frontend: use accessible menu items for column visibility](headlamp-upstream-patches/headlamp-upstream-accessible-column-selector.patch) and [drop the duplicated fork implementation](headlamp-upstream-patches/headlamp-downstream-remove-accessible-column-selector-fix.patch). |
| 85 | `adbf7f039` Disable cache for static plugins | **Upstream fix** | Apply [backend: disable local static plugin caching](headlamp-upstream-patches/headlamp-upstream-static-plugin-no-cache.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-static-plugin-no-cache-fix.patch). |
| 86 | `46e6c031b` Make project tabs usable at zoom | **Upstream fix** | Apply [frontend: keep project tabs usable at high zoom](headlamp-upstream-patches/headlamp-upstream-project-tabs-zoom.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-project-tabs-zoom-fix.patch). |
| 87 | `2fd768195` Update project creation menu | **Upstream extension + AKS plugin / Project extensions** | Apply [frontend: expose stable, replaceable project creation choices](headlamp-upstream-patches/headlamp-upstream-replaceable-project-creation.patch) and [replace the core project-menu rewrite](headlamp-upstream-patches/headlamp-downstream-remove-project-creation-menu.patch). After adopting the API, replace the AKS project choices by stable ID. |
| 88 | `c28257a3b` Fix original-name narration | **Remove** | Current upstream `f7c5f76f0` contains the complete fix; verify screen-reader behavior. |
| 89 | `44e78118a` Fix severity narration | **Remove with row 30** | Upstream workload logs use a labeled multi-select with checkbox state; the ready row 30 cleanup drops this old `LogsViewer` refactor. |
| 90 | `26d8e68de` Label log search buttons | **Remove with row 30** | Upstream actions have translated accessible descriptions; remove this with the ready row 30 cleanup. |
| 91 | `22a5008a2` Pass `setSelectedTab` to header actions | **Upstream fix / Project extensions** | Apply [frontend: pass tab selection to project header actions](headlamp-upstream-patches/headlamp-upstream-project-header-action-navigation.patch) and [drop the duplicated fork extension](headlamp-upstream-patches/headlamp-downstream-remove-project-header-action-navigation-fix.patch). |
| 92 | `10c313f02` Fix command/plugin IPC listener leaks | **Upstream fix / Command execution** | Apply [frontend: unsubscribe plugin manager listeners](headlamp-upstream-patches/headlamp-upstream-plugin-manager-listener-cleanup.patch) and [drop the duplicated fork cleanup](headlamp-upstream-patches/headlamp-downstream-remove-plugin-manager-listener-cleanup-fix.patch). Apply [frontend: clean up command listeners on exit](headlamp-upstream-patches/headlamp-upstream-command-listener-cleanup.patch) and [drop the duplicated fork cleanup](headlamp-upstream-patches/headlamp-downstream-remove-command-listener-cleanup-fix.patch). Apply [app: report invalid command exits](headlamp-upstream-patches/headlamp-upstream-invalid-command-exit.patch) and [drop the duplicated fork completion](headlamp-upstream-patches/headlamp-downstream-remove-invalid-command-exit-fix.patch). Apply [app: report permission rejection exits](headlamp-upstream-patches/headlamp-upstream-permission-rejection-exit.patch) and [drop the duplicated fork completion](headlamp-upstream-patches/headlamp-downstream-remove-permission-rejection-exit-fix.patch). Apply [app: report consent rejection exits](headlamp-upstream-patches/headlamp-upstream-consent-rejection-exit.patch) and [drop the duplicated fork completion](headlamp-upstream-patches/headlamp-downstream-remove-consent-rejection-exit-fix.patch). |
| 93 | `d9748fb0c` Improve appearance-control narration | **Upstream fix** | Apply [frontend: include field labels in appearance-control names](headlamp-upstream-patches/headlamp-upstream-appearance-control-narration.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-appearance-control-narration-fix.patch). |
| 94 | `a1769847c` Narrate debug image setting | **Upstream fix** | Apply [frontend: label the pod debug image field](headlamp-upstream-patches/headlamp-upstream-debug-image-narration.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-debug-image-narration-fix.patch). |
| 95 | `0570f3a31` Style Material UI Alert in dark mode | **Upstream fix** | Apply [frontend: improve warning alert contrast in dark mode](headlamp-upstream-patches/headlamp-upstream-dark-alert-contrast.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-dark-alert-contrast-fix.patch). |
| 96 | `86a4ce067` Derive deep-link scheme | **Upstream fix + AKS configuration / Product identity, OAuth sign-in** | Apply [app: derive the custom protocol from product metadata](headlamp-upstream-patches/headlamp-upstream-package-protocol-scheme.patch) and [drop the duplicated package-protocol helper](headlamp-upstream-patches/headlamp-downstream-remove-protocol-scheme-helper.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 97 | `0badba5aa` Reflow map labels at zoom | **Upstream fix** | Apply [frontend: let Resource Map labels reflow at high zoom](headlamp-upstream-patches/headlamp-upstream-resource-map-label-reflow.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-resource-map-label-reflow-fix.patch). |
| 98 | `4b6197255` Keep resource grid visible at zoom | **Upstream fix** | Apply [frontend: keep the project grid visible at high zoom](headlamp-upstream-patches/headlamp-upstream-project-grid-zoom.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-project-grid-zoom-fix.patch). |
| 99 | `65c871c7c` Hide empty project details card | **Upstream fix** | Apply [frontend: hide empty project overview sections](headlamp-upstream-patches/headlamp-upstream-hide-empty-project-sections.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-empty-project-section-fix.patch). |
| 100 | `6f13c6288` Keep EditorDialog visible at zoom | **Upstream fix** | Apply [frontend: keep EditorDialog visible at high zoom](headlamp-upstream-patches/headlamp-upstream-editor-dialog-zoom.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-editor-dialog-zoom-fix.patch). |
| 101 | `b205d0618` Group unscheduled pods | **Upstream fix** | Apply [frontend: group unscheduled pods in Resource Map](headlamp-upstream-patches/headlamp-upstream-unscheduled-pod-grouping.patch) and [drop the duplicated fork feature](headlamp-upstream-patches/headlamp-downstream-remove-unscheduled-pod-grouping-fix.patch). |
| 102 | `0b63e2251` Prevent ConditionsTable truncation | **Upstream fix** | Apply [frontend: remove cell overflow that truncates ConditionsTable](headlamp-upstream-patches/headlamp-upstream-simpletable-overflow.patch) and [drop the folded fork fix](headlamp-upstream-patches/headlamp-downstream-remove-simpletable-overflow-fix.patch). |
| 103 | `513e3ba2d` Announce no table data | **Remove** | Current upstream `de73608f2` supplies the same behavior; verify narration. |
| 104 | `e87e6d6fe` Remove hidden cell overflow | **Fold into row 102** | Duplicate/follow-up application of the same SimpleTable change; submit once. |
| 105 | `148b45e3c` Use AKS backend app/User-Agent name | **Upstream extension / Product identity** | Apply [backend: add a runtime application-name setting](headlamp-upstream-patches/headlamp-upstream-backend-app-name.patch) and [drop the hard-coded AKS backend name](headlamp-upstream-patches/headlamp-downstream-remove-backend-app-name-fix.patch). AKS Desktop: [product manifest](../build/product-manifest.json). |
| 106 | `fa1dcf6d1` Add runCmd plugin identification | **Upstream extension / Command execution** | Apply [app: authorize manifest-declared plugin commands](headlamp-upstream-patches/headlamp-upstream-plugin-command-capabilities.patch) and [replace package command branches with capabilities](headlamp-upstream-patches/headlamp-downstream-replace-plugin-command-capabilities.patch). Then apply [exact command scopes with explicit prefix opt-in](headlamp-upstream-patches/headlamp-upstream-explicit-command-scope-prefixes.patch) and [the matching fork conversion](headlamp-upstream-patches/headlamp-downstream-require-explicit-command-scope-prefixes.patch), followed by [main-process command option isolation](headlamp-upstream-patches/headlamp-upstream-capability-command-options.patch) and [the fork isolation patch](headlamp-upstream-patches/headlamp-downstream-isolate-capability-command-options.patch). Before cleanup, declare the exact AKS scopes in both plugin metadata and the row 19 product policy. |
| 107 | `551275e71` Add AKS Arc cluster type | **AKS plugin / Cluster registration** | Implement Arc as an AKS provider mode. |
| 108 | `0aa41fb22` Fix runCmd test mocks | **Fold into row 106** | Port relevant tests to the generic broker. |
| 109 | `903360924` Expand LogsViewer workload types | **Fold into row 30** | `WorkloadLogs` covers these types; remove this with the ready row 30 cleanup after migrating the plugin. |
| 110 | `2babb4675` Suppress ESLint warnings | **Fold** | Fix warnings in their destination pull requests; do not carry a suppression commit. |
| 111 | `a87a8909f` Update translations | **Fold / Translations** | Regenerate upstream strings in their pull requests and keep AKS strings in the overlay. |
| 112 | `3c9d0b941` Adjust backend output verification | **Upstream fix / Product identity** | Apply [app: derive verification names from package metadata](headlamp-upstream-patches/headlamp-upstream-package-verification-names.patch) and [drop hard-coded AKS verification names](headlamp-upstream-patches/headlamp-downstream-remove-package-verification-names-fix.patch). |
| 113 | `fcad69534` Update verified binary name | **Fold into row 112** | The [package-verification patch](headlamp-upstream-patches/headlamp-upstream-package-verification-names.patch) derives each platform name from package metadata. |
| 114 | `badc4713b` Use `execFileSync` for list-plugins | **Upstream fix** | Apply [app: avoid shell for `list-plugins` command](headlamp-upstream-patches/headlamp-upstream-list-plugins-without-shell.patch) and [drop the duplicated fork fix](headlamp-upstream-patches/headlamp-downstream-remove-list-plugins-fix.patch). |
| 115 | `c7505cce7` Canonical AI Assistant identity | **AKS configuration / Plugin bundle, command execution** | Preserve the host-side ID in separate vendored-plugin policy; the vendored plugin itself is out of scope. |


## Important look-alikes

These comparisons prevent over-aggressive deletion based on similar subjects:

| Downstream | Upstream look-alike | Result |
| --- | --- | --- |
| `c4b0bb453` artifact name | `d76976282` package naming | Current upstream again uses `${productName}`; the tested package-name patch is ready and AKS supplies the product package name. |
| `00320948b` query retry | `ee0532558` cluster error handling | The [ready retry-policy patch](headlamp-upstream-patches/headlamp-upstream-query-retry-policy.patch) adds status tests, skips permanent 400–499 errors, and retains retries for `408` and `429`. |
| `5e79994e5` overview `isEnabled` | `5cc6e4654` tab `isEnabled` | Different extension types; the overview API is still missing. |
| `c5a969eab` ViewButton | `8bb0d3500` Activity refactor | Upstream opens an Activity window; downstream's `split-right` behavior remains. |
| `5f7ade8ca` Table props | `a90f608b1`/`b7b29804e` selection changes | Upstream still renders the top toolbar and range handler unconditionally. |
| `d709d2ddf` base mocks | `fa559202e` shared API base | Centralizing the URL did not add these Kubernetes handlers; four ordered handler patches are ready. |
| `a6e5b073a` keyboard column menu | `61aef6b61` visibility persistence | Persistence does not supply the [ready accessible menu patch](headlamp-upstream-patches/headlamp-upstream-accessible-column-selector.patch). |
| `adbf7f039` static-plugin cache | `f1b8c850d` plugin cache | The old fix covers `/plugins/`, not the separate `/static-plugins/` route. |
| `d9748fb0c` appearance narration | `7c6a4ecf5` initial narration fix | Downstream is a follow-up that adds the field labels to the accessible name. |
| `6f13c6288` EditorDialog zoom | `7e07f4180` DataField zoom | Different components and layout failures. |
| `badc4713b` list-plugins execution | `144f95847` plugin script execution | Upstream Electron `main.ts` still uses a shell string for `list-plugins`. |

## Suggested upstream submission lanes

These lanes cover all 61 rows whose primary decision is an upstream fix or
extension. A lane is a review area, not a request to combine its rows into one
pull request; prefer small, independently testable submissions.

| Lane | Ledger rows | Submission guidance |
| --- | --- | --- |
| Command broker and desktop correctness | 1, 11, 13, 21, 66, 74, 92, 106, 114 | Rows 1, 11, and 13 are policy requirements covered by the row 106 capability design rather than separate submissions. Keep the standalone fixes separate from privileged command APIs. |
| Product and build manifests | 2, 4, 5, 31, 32, 34, 37, 41, 43, 51, 73, 96, 105, 112 | Submit the small product-neutral fixes separately. Preserve the ordered manifest chain in the application-order table. |
| Plugin packaging and host capabilities | 19, 22, 23, 47, 60, 78, 79, 82, 85 | Keep identity, command, storage, OAuth, tool, and cluster-provider security boundaries independently reviewable. |
| Project and frontend extensions | 25, 28, 30, 35, 50, 52, 75, 87, 91 | Migrate the AKS empty state, logs, grouping, translations, and creation choices before their cleanup patches. |
| Kubernetes, queries, tables, and stories | 46, 58, 59, 65, 68, 69, 84, 101, 102 | Row 68 is four ordered mock-handler patches; the other fixes can be submitted independently. |
| Accessibility, theme, and zoom | 42, 57, 71, 86, 93, 94, 95, 97, 98, 99, 100 | Apply row 86 before row 98; otherwise keep the fixes independent and regenerate affected snapshots or translations. |

The patch inventory being complete does not mean the fork can be removed yet.
The generic extension designs still need upstream agreement, the row-specific
AKS migrations need implementation and validation, and all fold/remove
decisions need behavior checks during rebase. Completion is the pristine-source
build defined by the strategy's
[migration exit criteria](headlamp-packaging.md#migration-plan-and-exit-criteria),
not merely applying every patch in this report.
