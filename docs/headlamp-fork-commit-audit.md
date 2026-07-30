# Headlamp downstream commit audit

This is the commit-level companion to
[Removing the Headlamp submodule](headlamp-packaging.md). It answers which
changes should go upstream and where useful AKS Desktop differences should live
after the fork is removed.

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

## Dispositions and replacement contracts

| Code | Meaning |
| --- | --- |
| **UP** | Rebase and submit as a product-neutral upstream change with tests. No AKS switch should remain. |
| **API** | Upstream a generic extension/configuration API, not the hard-coded AKS implementation. |
| **CFG** | Express in the AKS product manifest or external assembly; do not upstream as core code. |
| **AKS** | Move to the AKS plugin/provider after the required generic API exists. |
| **FOLD** | Squash into the named feature/commit; it is not an independent change. |
| **DROP** | Obsolete or supplied by current upstream; confirm with behavior tests after rebase. |
| **CHECK** | Product intent or upstream overlap is unclear; make the stated decision during rebase. |

The replacement names used in the ledger mean:

| Replacement | Required boundary |
| --- | --- |
| `IDENTITY` | Product name/version, app ID, protocol, icons, legal files, targets, artifact names, and verification paths in a product/build manifest. |
| `PUBLIC` | Non-secret frontend runtime product data and branded messages/assets. |
| `PLUGINS` | Manifest of bundled plugins, canonical IDs, sources, enabled defaults, and compatibility. |
| `TOOLS` | Per-platform external-tool paths, versions, and verified digests. |
| `CMD` | Permissioned host command broker using plugin identity, executable plus argument arrays, exact scopes, and consent. |
| `CLUSTER` | Generic host cluster-provider API with AKS/Arc registration policy implemented by the AKS provider. |
| `STORAGE` | Namespaced Electron secure-storage API. |
| `OAUTH` | Generic main-process OAuth/deep-link provider using secure storage. |
| `PROJECT` | Supported project extension hooks; AKS project policy remains in the plugin. |
| `LOCALE` | Supported locale extension/overlay; generated AKS strings remain outside core. |

## Important look-alikes

These comparisons prevent over-aggressive deletion based on similar subjects:

| Downstream | Upstream look-alike | Result |
| --- | --- | --- |
| `c4b0bb453` artifact name | `d76976282` package naming | Current upstream again uses `${productName}`; retain as `IDENTITY` configuration. |
| `00320948b` query retry | `ee0532558` cluster error handling | Upstream skips retries for 401/403; downstream also skips other sub-500 responses, so the remaining policy needs review/upstream tests. |
| `5e79994e5` overview `isEnabled` | `5cc6e4654` tab `isEnabled` | Different extension types; the overview API is still missing. |
| `c5a969eab` ViewButton | `8bb0d3500` Activity refactor | Upstream opens an Activity window; downstream's `split-right` behavior remains. |
| `5f7ade8ca` Table props | `a90f608b1`/`b7b29804e` selection changes | Upstream still renders the top toolbar and range handler unconditionally. |
| `d709d2ddf` base mocks | `fa559202e` shared API base | Centralizing the URL did not add these Kubernetes handlers. |
| `a6e5b073a` keyboard column menu | `61aef6b61` visibility persistence | Persistence does not supply the accessible menu implementation. |
| `adbf7f039` static-plugin cache | `f1b8c850d` plugin cache | The old fix covers `/plugins/`, not the separate `/static-plugins/` route. |
| `d9748fb0c` appearance narration | `7c6a4ecf5` initial narration fix | Downstream is a follow-up that adds the field labels to the accessible name. |
| `6f13c6288` EditorDialog zoom | `7e07f4180` DataField zoom | Different components and layout failures. |
| `badc4713b` list-plugins execution | `144f95847` plugin script execution | Upstream Electron `main.ts` still uses a shell string for `list-plugins`. |

## Commit ledger

| # | Commit | Disposition / replacement | What to do |
| ---: | --- | --- | --- |
| 1 | `863957d9d` Add kubectl to valid commands | **API / CMD** | Declare the AKS plugin's `kubectl` scope; remove the global hard-coded allowlist entry. |
| 2 | `af6132f55` Rebrand package name | **CFG / IDENTITY** | Set product package name in the product manifest. |
| 3 | `35c871acd` Replace icons | **CFG / IDENTITY** | Supply the AKS icon set during assembly. |
| 4 | `c4b0bb453` Use package name in artifact names | **CFG / IDENTITY** | Let the desktop kit accept an artifact-name template. |
| 5 | `c25c2099b` Remove Linux `executableName` | **CFG / IDENTITY** | Derive or override the executable name in product builder configuration. |
| 6 | `43dc0e88f` Cache shell environment | **DROP / CMD** | Upstream `63b629102` and `47c426634` provide newer login-shell caching; run command tests after rebase. |
| 7 | `b6b1c330a` AKS plugin command support | **FOLD / CMD** | Fold into row 106; replace plugin-name branches with broker capabilities. |
| 8 | `920dd7a8b` Frontend kubectl integration | **FOLD / CMD** | Fold into row 106; consume the supported browser command API from the plugin. |
| 9 | `290767161` Update `productName` | **FOLD / IDENTITY** | Fold into row 2 and set `displayName`. |
| 10 | `b2e6b1d94` Include PATH to avoid `ENOENT` | **CHECK / CMD** | Re-test on upstream shell-environment work; otherwise keep as a broker test/fix, not AKS branding. |
| 11 | `82365514d` Default AKS command consent | **API / CMD** | Use declared, reviewable command scopes; do not silently bypass consent in core. |
| 12 | `44422b2e1` Fix az/kubectl consent | **FOLD / row 11** | Preserve final behavior in command-broker tests. |
| 13 | `dd207f955` Add kubelogin | **API / CMD, TOOLS** | Declare the pinned tool and only its required command scopes. |
| 14 | `bb74bc751` Bundle Azure CLI | **CFG / TOOLS** | Assemble the pinned platform artifact outside Headlamp. |
| 15 | `915036dc1` Move Azure CLI folder | **FOLD / TOOLS** | Make the final path a product-manifest resource mapping. |
| 16 | `c09a33860` Allow registration script | **DROP / CLUSTER** | The script was removed by row 19; do not expose it through the broker. |
| 17 | `c79db3039` Remove kubelogin permission | **FOLD / row 13** | Keep only the final least-privilege scope set. |
| 18 | `3d7ddb3a6` Update branded snapshot | **FOLD / IDENTITY** | Regenerate product tests from the external branding config. |
| 19 | `1d1f03e58` Programmatic AKS registration | **API + AKS / CLUSTER** | Upstream a provider contract; move the implementation to the AKS provider. |
| 20 | `72e169328` Windows quoting fix | **UP / CMD** | Rebase as platform-safe argument handling with Windows tests. |
| 21 | `ac7319372` Avoid shell except on Windows | **UP / CMD** | Upstream a no-shell default and use a shell only where platform behavior requires it. |
| 22 | `d125e6505` Azure CLI path through env | **API / CMD, TOOLS** | Resolve a declared tool ID to a verified path instead of a mutable AKS-only env variable. |
| 23 | `69e20c5dd` Exclude catalog plugins | **CFG / PLUGINS** | List product-disabled built-ins in the AKS manifest. |
| 24 | `65e207537` Remove Artifact Hub proxy config | **CFG / PLUGINS** | Put plugin source/proxy policy in the AKS manifest. |
| 25 | `33f4cfb35` Change empty cluster message | **CFG / PUBLIC** | Supply an AKS public message/empty-state contribution. |
| 26 | `24889f999` Update package name and author | **FOLD / IDENTITY** | Fold into row 2. |
| 27 | `5eb5cd53e` Build with AKS version | **CFG / IDENTITY** | Read the product version from the AKS release source. |
| 28 | `d68693b04` Show AKS version in About | **API / PUBLIC** | Expose runtime product information/About contributions. |
| 29 | `067bf68f3` Show AKS version in top bar | **FOLD / PUBLIC** | Consume the same product-information API as row 28. |
| 30 | `024ec74a7` New LogsViewer | **UP** | Submit the complete LogsViewer chain as a cohesive upstream feature. |
| 31 | `7725d00f3` Verify bundled tools | **CFG / TOOLS** | Keep verification in the AKS assembly pipeline and validate every target. |
| 32 | `ed960d0a3` Add external tools to macOS | **CFG / TOOLS** | Use per-platform resource mappings. |
| 33 | `9a3ccb390` Remove unscoped external resource | **FOLD / TOOLS** | Keep only the final platform-scoped mapping. |
| 34 | `a013f5330` Add DMG license | **UP** | Submit generic electron-builder license support. |
| 35 | `5e79994e5` Conditional project overview sections | **UP / PROJECT** | Submit `isEnabled` for overview sections; it is absent upstream. |
| 36 | `e0f08105d` Suppress az confirmation | **FOLD / row 11** | Represent any product-approved scope in policy; do not hard-code AKS bypasses. |
| 37 | `d484bcd0f` Disable release notes | **CFG / PUBLIC** | Set the public `releaseNotes` product flag. |
| 38 | `0f537cf57` Add LogsViewer index | **FOLD / row 30** | Include it in the LogsViewer upstream PR. |
| 39 | `6e70e0740` Add cached icons | **FOLD / IDENTITY** | Generate/copy all required icon variants during assembly. |
| 40 | `a1d884296` Fix app builds in CI | **CFG / IDENTITY** | Move root-version and builder-path assumptions to the product build kit. |
| 41 | `f45b3b90c` Fix package for macOS build | **FOLD / IDENTITY** | Fold the final settings into product builder configuration. |
| 42 | `12b579560` Add `secondaryContrastText` | **UP** | Submit the product-neutral plugin-theme contrast fix. |
| 43 | `645f38d2e` Build arm64 only | **CFG / IDENTITY** | Declare targets; confirm whether the temporary x64 exclusion is still wanted. |
| 44 | `c01009765` Update icons | **FOLD / row 3** | Keep only the current AKS icon set. |
| 45 | `ceea7720d` Update Azure logo | **CFG / IDENTITY, PUBLIC** | Supply product logo assets without editing Headlamp source. |
| 46 | `bd39620b1` Reload after cluster deletion | **CHECK / UP** | Reproduce the stale state, then upstream a targeted reset or justify the full reload. |
| 47 | `2ce445ee1` Default-disabled plugins | **UP / PLUGINS** | Upstream manifest support; select disabled plugins in AKS configuration. |
| 48 | `a2be5742f` Add disabled Kaito plugin | **CFG / PLUGINS** | Declare Kaito and its disabled default in the AKS manifest. |
| 49 | `7a830d425` Add Microsoft headers | **FOLD** | Keep notices only on AKS-owned files after extraction; do not patch upstream files. |
| 50 | `5fae2b773` Separate managed projects by cluster | **API + AKS / PROJECT** | Add a generic project identity/key hook; implement AKS policy in the plugin. |
| 51 | `4d854f759` Add Legal tab | **API / IDENTITY** | Support product legal files/About sections in the desktop kit. |
| 52 | `40364e142` Update 404 page | **CFG / PUBLIC** | Supply branded graphic/text through public product configuration. |
| 53 | `e697c0aaf` Override macOS version | **FOLD / IDENTITY** | Use the single product version source from row 27. |
| 54 | `578cd9cb6` Azure-RBAC-only kubelogin auth | **AKS / CLUSTER** | Keep Azure auth selection in the AKS provider. |
| 55 | `fcf1a7759` Replace error page | **CFG / PUBLIC** | Supply branded error content/assets. |
| 56 | `5504295b8` Comment default consent | **FOLD / row 11** | Document the generic policy instead of retaining a code-only commit. |
| 57 | `c5a969eab` Open ViewButton activity on right | **UP** | Submit the `split-right` UX change; upstream's Activity refactor does not include it. |
| 58 | `00320948b` Stop retries for sub-500 responses | **CHECK / UP** | Decide whether 408/429 should retry, then submit only the agreed generic policy with status tests. |
| 59 | `06f1208e6` Handle allowed namespaces in list queries | **UP** | Submit the generic namespace-query behavior with tests. |
| 60 | `edcdb2ba4` Correct plugin source-map offset | **UP** | Submit the plugin runtime fix and its tests. |
| 61 | `a73b4302a` Move `getAllowedNamespaces` | **FOLD / row 59** | Move only if needed by the final namespace design; the export already exists upstream. |
| 62 | `c9ec6c99c` Update branded error snapshots | **FOLD / row 55** | Regenerate product-level tests. |
| 63 | `41d003eca` Import managed-namespace project | **AKS / CLUSTER, PROJECT** | Keep managed-namespace semantics in the AKS provider/plugin. |
| 64 | `cdee9d62b` Include kubelogin script conditionally | **FOLD / row 54** | Resolve the declared tool only for clusters that need it. |
| 65 | `5f7ade8ca` Honor Table selection/top-bar props | **UP** | Submit both missing generic prop behaviors with tests. |
| 66 | `db7e2db03` Expose desktop platform | **UP** | Submit a narrow typed desktop-platform API. |
| 67 | `5944280a5` Override Linux product name | **FOLD / IDENTITY** | Fold into product builder configuration. |
| 68 | `d709d2ddf` Add base Kubernetes MSW handlers | **UP** | Rebase handlers onto the shared API base and submit with stories. |
| 69 | `013129c89` Fix GraphView CRD watch story | **UP** | Submit the remaining story behavior after rebasing the current CRD mocks. |
| 70 | `dd6cf9ae4` Fix docs TypeScript errors | **UP** | Re-test current docs and submit the generic type fix if still reproducible. |
| 71 | `5e3c5e26c` Fix axe tooltip region check | **UP** | Submit the generic e2e accessibility test fix. |
| 72 | `2f54e5cde` Fix log-search e2e test | **FOLD / row 30** | Include with LogsViewer. |
| 73 | `53917bfee` Use AKS HTML title | **CFG / PUBLIC** | Populate the public title/product name during assembly or startup. |
| 74 | `642809609` Fix Electron zoom menu | **UP** | Submit the generic desktop menu fix. |
| 75 | `ee162d9af` Expand locales | **CHECK / LOCALE** | Upstream only still-missing generic locales; keep AKS strings in a supported overlay. |
| 76 | `3b01fe701` Ignore generated resources | **FOLD / IDENTITY** | Ignore outputs in the AKS assembly workspace, not upstream source. |
| 77 | `195494e46` Announce EmptyContent | **DROP** | The final fork and upstream `EmptyContent.tsx` are identical; table live regions now cover the retained behavior. |
| 78 | `076a7feda` Add Electron secure storage | **API / STORAGE** | Upstream a product-neutral, plugin-namespaced service and tests. |
| 79 | `e528e6a05` Add GitHub OAuth flow | **API / OAUTH** | Generalize provider registration; keep GitHub policy in the AKS plugin. |
| 80 | `da5a560ed` Move OAuth tests to Vitest | **FOLD / row 79** | Include tests with the generalized provider. |
| 81 | `a20c30755` Stabilize EmptyContent timing | **DROP** | Its effect is absent from the final fork; there is no remaining patch to upstream. |
| 82 | `0fa88cf56` Respect `KUBECONFIG` when writing | **AKS / CLUSTER** | Keep in the AKS provider; require the generic provider contract to pass the target path. |
| 83 | `b8f52f6f4` Remove Azure credential format | **AKS / CLUSTER** | Keep this Azure/kubelogin policy in the AKS provider. |
| 84 | `a6e5b073a` Accessible Table column selector | **UP** | Submit the keyboard/menu implementation; persistence work does not replace it. |
| 85 | `adbf7f039` Disable cache for static plugins | **UP** | Extend the existing backend no-cache behavior to the static-plugin route. |
| 86 | `46e6c031b` Make project tabs usable at zoom | **UP** | Submit the generic accessibility/layout fix. |
| 87 | `2fd768195` Update project creation menu | **CHECK / PROJECT** | If generic UX, upstream it; if AKS workflow, implement through a project creation contribution. |
| 88 | `c28257a3b` Fix original-name narration | **DROP** | Current upstream `f7c5f76f0` contains the complete fix; verify screen-reader behavior. |
| 89 | `44e78118a` Fix severity narration | **FOLD / row 30** | Include the accessible LogsViewer control. |
| 90 | `26d8e68de` Label log search buttons | **FOLD / row 30** | Include the accessible LogsViewer control. |
| 91 | `22a5008a2` Pass `setSelectedTab` to header actions | **UP / PROJECT** | Extend the existing generic header-action API and published types. |
| 92 | `10c313f02` Fix command/plugin IPC listener leaks | **UP / CMD** | Rebase on the new preload listener registry; retain command cleanup/error exits not upstream. |
| 93 | `d9748fb0c` Improve appearance-control narration | **UP** | Submit as a follow-up to upstream `7c6a4ecf5`. |
| 94 | `a1769847c` Narrate debug image setting | **UP** | Submit the generic accessibility fix and translations. |
| 95 | `0570f3a31` Style MUI Alert in dark mode | **UP** | Submit the generic theme fix. |
| 96 | `86a4ce067` Derive deep-link scheme | **CFG / IDENTITY, OAUTH** | Read the protocol from the product manifest; do not hard-code AKS. |
| 97 | `0badba5aa` Reflow map labels at zoom | **UP** | Submit the generic accessibility fix. |
| 98 | `4b6197255` Keep resource grid visible at zoom | **UP** | Submit the generic accessibility fix. |
| 99 | `65c871c7c` Hide empty project details card | **UP** | Submit the generic project UX improvement. |
| 100 | `6f13c6288` Keep EditorDialog visible at zoom | **UP** | Submit separately from the upstream DataField zoom fix. |
| 101 | `b205d0618` Group unscheduled pods | **UP** | Submit the generic Resource Map feature and tests. |
| 102 | `0b63e2251` Prevent ConditionsTable truncation | **UP** | Submit the SimpleTable overflow fix. |
| 103 | `513e3ba2d` Announce no table data | **DROP** | Current upstream `de73608f2` supplies the same behavior; verify narration. |
| 104 | `e87e6d6fe` Remove hidden cell overflow | **FOLD / row 102** | Duplicate/follow-up application of the same SimpleTable change; submit once. |
| 105 | `148b45e3c` Use AKS backend app/User-Agent name | **API / IDENTITY** | Add a backend runtime app-name setting supplied by the product manifest. |
| 106 | `fa1dcf6d1` Add runCmd plugin identification | **API / CMD** | Upstream the permissioned identity contract; remove AKS/AI package branches. |
| 107 | `551275e71` Add AKS Arc cluster type | **AKS / CLUSTER** | Implement Arc as an AKS provider mode. |
| 108 | `0aa41fb22` Fix runCmd test mocks | **FOLD / row 106** | Port relevant tests to the generic broker. |
| 109 | `903360924` Expand LogsViewer workload types | **FOLD / row 30** | Include the type fix with LogsViewer. |
| 110 | `2babb4675` Suppress ESLint warnings | **FOLD** | Fix warnings in their destination PRs; do not carry a suppression commit. |
| 111 | `a87a8909f` Update translations | **FOLD / LOCALE** | Regenerate upstream strings in their PRs and keep AKS strings in the overlay. |
| 112 | `3c9d0b941` Adjust backend output verification | **CFG / IDENTITY** | Generate verification paths from product artifact metadata. |
| 113 | `fcad69534` Update verified binary name | **FOLD / row 112** | Keep only the final generated verification expectation. |
| 114 | `badc4713b` Use `execFileSync` for list-plugins | **UP** | Submit the focused whitespace/shell-safety fix to Electron `main.ts`. |
| 115 | `c7505cce7` Canonical AI Assistant identity | **CFG / PLUGINS, CMD** | Preserve the host-side ID in separate vendored-plugin policy; the vendored plugin itself is out of scope. |

## Suggested upstream batches

| Batch | Commits | Notes |
| --- | --- | --- |
| LogsViewer | `024ec74a7`, `0f537cf57`, `2f54e5cde`, `44e78118a`, `26d8e68de`, `903360924` | Feature, types, a11y, and e2e together. |
| Command/desktop correctness | `72e169328`, `ac7319372`, `db7e2db03`, `642809609`, `10c313f02`, `badc4713b` | Keep separate from AKS permissions; small PRs may review better. |
| Project extensions | `5e79994e5`, `22a5008a2` | Complete existing overview/header extension APIs. |
| Plugin support | `2ce445ee1`, `edcdb2ba4`, `dd6cf9ae4`, `adbf7f039` | Defaults, source maps/types, and static serving. |
| Kubernetes/query/table | `00320948b`, `06f1208e6`, `5f7ade8ca`, `d709d2ddf`, `013129c89`, `a6e5b073a`, `0b63e2251` | Rebase together to resolve shared Table/mock changes, then split reviewable PRs. |
| Accessibility/theme | `12b579560`, `46e6c031b`, `d9748fb0c`, `a1769847c`, `0570f3a31`, `0badba5aa`, `4b6197255`, `6f13c6288` | Product-neutral; regenerate current snapshots/translations. |

Resolve every `CHECK` during the rebase: row 10 (PATH handling), row 46
(cluster-deletion state), row 58 (retry statuses), row 75 (locale ownership),
and row 87 (project-creation UX).

The `CMD`, `CLUSTER`, `STORAGE`, `OAUTH`, `IDENTITY`, and `PROJECT` APIs need
upstream design agreement before AKS can consume a pristine distribution. The
ledger is not a request to upstream every downstream commit verbatim.
