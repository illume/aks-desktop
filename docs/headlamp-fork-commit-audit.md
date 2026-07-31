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
| **Needs decision** | Product intent or upstream overlap is unclear; make the stated decision during rebase. |

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

## Upstream patches in progress

The following mailbox patches apply to upstream Headlamp commit
`506465d78ca162f65e46c57fab7b014fd771d047`:

The paired removal patches apply to the audited downstream tip
`4d00ea845c8f4faf2c7fde887f6a4bf9da2000c6`. Each patch applies directly to
its stated baseline except the project-grid zoom patch, which follows the
project-tabs zoom patch; its removal patch likewise follows the project-tabs
removal. **Do not ship a removal patch by itself:** that would temporarily
restore the old bug. During a rebase, prefer to drop the original fork commit
after selecting an upstream base that contains the matching fix. Use the
removal patch only when a normal cleanup commit is needed, and include the
upstream fix in the same branch update.

### Run `list-plugins` without a shell

- **Fork source:** `badc4713b`.
- **Upstream patch:** [app: avoid shell for `list-plugins`
  command](headlamp-upstream-patches/headlamp-upstream-list-plugins-without-shell.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-list-plugins-fix.patch).
- **AKS Desktop follow-up:** None. This changes only how Headlamp invokes its own
  server. The command and output stay the same, so AKS Desktop automatically
  receives the path-handling fix when it updates Headlamp.
- **Upstream validation:** `npm run app:tsc`; `npm run app:lint`; all 139 app
  unit tests.
- **Removal validation:** `npm run app:tsc`; `npm run app:lint`; all 141
  downstream app unit tests.

### Allow a plugin theme to set secondary contrast text

- **Fork source:** `12b579560`.
- **Upstream patch:** [frontend: support a secondary contrast theme
  color](headlamp-upstream-patches/headlamp-upstream-secondary-theme-contrast.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-theme-contrast-fix.patch).
- **AKS Desktop follow-up:** No immediate change.
  `plugins/aks-desktop/src/utils/shared/theme.ts` currently sets
  `secondary: '#ecebe9'` and relies on Headlamp's black (`#000`) fallback, which
  the patch preserves. After AKS Desktop updates its plugin software development
  kit to a release containing this field, it may set `secondaryContrastText` in
  that file if a different color is required.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  22 tests in `frontend/src/lib/themes.test.ts`.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  20 downstream tests in `frontend/src/lib/themes.test.ts`.

### Open the resource view beside the current content

- **Fork source:** `c5a969eab`.
- **Upstream patch:** [frontend: open resource view beside current
  content](headlamp-upstream-patches/headlamp-upstream-view-button-split-right.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-view-button-split-right-fix.patch).
- **AKS Desktop follow-up:** None. AKS Desktop uses Headlamp's resource view
  button, so it receives the side-by-side placement when it updates Headlamp.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  new resource-view placement regression test.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; both
  resource export tests.

### Keep Electron zoom menu items working after plugin customization

- **Fork source:** `642809609`.
- **Upstream patch:** [app: restore zoom actions for plugin-provided
  menus](headlamp-upstream-patches/headlamp-upstream-electron-zoom-menu-actions.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-electron-zoom-menu-fix.patch).
- **AKS Desktop follow-up:** None. The fix restores Headlamp's built-in zoom
  actions after plugins customize and return the menu definition.
- **Upstream validation:** `npm run app:tsc`; `npm run app:lint`; all 139 app
  unit tests.
- **Removal validation:** `npm run app:tsc`; `npm run app:lint`; all 141
  downstream app unit tests.

### Prevent local caching of shipped plugins

- **Fork source:** `adbf7f039`.
- **Upstream patch:** [backend: disable local static plugin
  caching](headlamp-upstream-patches/headlamp-upstream-static-plugin-no-cache.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-static-plugin-no-cache-fix.patch).
- **AKS Desktop follow-up:** None. Local Headlamp instances, including AKS
  Desktop development builds, automatically receive fresh shipped-plugin files.
  In-cluster caching is unchanged.
- **Upstream validation:** backend lint with Go 1.26.5; the new static-plugin
  cache-control test. This Go-only patch has no TypeScript check.
- **Removal validation:** backend lint with Go 1.26.3; all tests in the
  downstream backend command package.

### Improve warning alert contrast in dark mode

- **Fork source:** `0570f3a31`.
- **Upstream patch:** [frontend: improve warning alert contrast in dark
  mode](headlamp-upstream-patches/headlamp-upstream-dark-alert-contrast.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-dark-alert-contrast-fix.patch).
- **AKS Desktop follow-up:** None. The colors are part of Headlamp's standard
  dark theme and require no AKS theme override.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  22 tests in `frontend/src/lib/themes.test.ts`.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  20 downstream tests in `frontend/src/lib/themes.test.ts`.

### Hide empty project overview sections

- **Fork source:** `65c871c7c`.
- **Upstream patch:** [frontend: hide empty project overview
  sections](headlamp-upstream-patches/headlamp-upstream-hide-empty-project-sections.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-empty-project-section-fix.patch).
- **AKS Desktop follow-up:** None. An AKS overview contribution that renders no
  content no longer leaves an empty card.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  Project Details Storybook test.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  downstream Project Details Storybook test.

### Keep the resource editor usable at high zoom

- **Fork source:** `6f13c6288`.
- **Upstream patch:** [frontend: keep EditorDialog visible at high
  zoom](headlamp-upstream-patches/headlamp-upstream-editor-dialog-zoom.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-editor-dialog-zoom-fix.patch).
- **AKS Desktop follow-up:** None. AKS resource editors use the shared Headlamp
  dialog and automatically receive its minimum height and scrolling behavior.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  three EditorDialog Storybook tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  three downstream EditorDialog Storybook tests.

### Expose the desktop platform to plugins

- **Fork source:** `db7e2db03`.
- **Upstream patch:** [app: expose the platform through the typed desktop
  API](headlamp-upstream-patches/headlamp-upstream-desktop-platform.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-desktop-platform-fix.patch).
- **AKS Desktop follow-up:** None.
  `plugins/aks-desktop/src/telemetry/appInfo.ts` already reads this value and
  retains an `unknown` fallback outside Electron. The plugin receives the
  supported host value when AKS Desktop updates Headlamp.
- **Upstream validation:** `npm run app:tsc`; `npm run frontend:tsc`;
  `npm run frontend:lint`; all 139 app unit tests.
- **Removal validation:** `npm run app:tsc`; `npm run app:lint`; all 141
  downstream app unit tests.

### Correct source-map locations for plugin code

- **Fork source:** `edcdb2ba4`.
- **Upstream patch:** [frontend: correct plugin source-map
  offsets](headlamp-upstream-patches/headlamp-upstream-plugin-source-map-offset.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-plugin-source-map-offset-fix.patch).
- **AKS Desktop follow-up:** None. Headlamp adjusts inline maps before running
  every plugin, so AKS plugin stack traces gain the corrected source locations
  without a plugin change.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  33 `runPlugin` tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  26 downstream `runPlugin` tests.

### Keep project tabs usable at high zoom

- **Fork source:** `46e6c031b`.
- **Upstream patch:** [frontend: keep project tabs usable at high
  zoom](headlamp-upstream-patches/headlamp-upstream-project-tabs-zoom.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-project-tabs-zoom-fix.patch).
- **AKS Desktop follow-up:** None. AKS project tabs use the shared Headlamp
  project layout and automatically gain scrollable tabs and minimum content
  heights.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  both Project Resources Storybook tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  both downstream Project Resources Storybook tests.

### Improve appearance-control narration

- **Fork source:** `d9748fb0c`.
- **Upstream patch:** [frontend: include field labels in appearance-control
  names](headlamp-upstream-patches/headlamp-upstream-appearance-control-narration.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-appearance-control-narration-fix.patch).
- **AKS Desktop follow-up:** None. The accessible names belong to Headlamp's
  standard cluster settings and cover AKS clusters without an override.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  15 Settings Cluster Storybook tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  15 downstream Settings Cluster Storybook tests.

### Let Resource Map labels reflow at high zoom

- **Fork source:** `0badba5aa`.
- **Upstream patch:** [frontend: let Resource Map labels reflow at high
  zoom](headlamp-upstream-patches/headlamp-upstream-resource-map-label-reflow.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-resource-map-label-reflow-fix.patch).
- **AKS Desktop follow-up:** None. AKS uses the shared Resource Map nodes, so
  long workload names remain readable after a Headlamp update.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  13 `KubeObjectNode` tests, including the new label-reflow regression.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  downstream GraphView Storybook test.

### Keep the project resource grid visible at high zoom

- **Fork source:** `4b6197255`.
- **Upstream patch:** [frontend: keep the project grid visible at high
  zoom](headlamp-upstream-patches/headlamp-upstream-project-grid-zoom.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-project-grid-zoom-fix.patch).
- **AKS Desktop follow-up:** None. AKS project resources use Headlamp's shared
  responsive grid. Apply this patch after the project-tabs zoom patch above,
  and apply its removal after the project-tabs removal.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  both Project Resources Storybook tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  both downstream Project Resources Storybook tests.

### Avoid Custom Resource Definition watches in the Resource Map story

- **Fork source:** `013129c89`.
- **Upstream patch:** [frontend: avoid Custom Resource Definition watches in
  the GraphView story](headlamp-upstream-patches/headlamp-upstream-graphview-crd-watch.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-graphview-crd-watch-fix.patch).
- **AKS Desktop follow-up:** None. This isolates Headlamp's test story from
  default cluster relations and does not change runtime Resource Map behavior.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  GraphView `BasicExample` Storybook test.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  downstream GraphView `BasicExample` Storybook test.

### Include license resources in macOS disk images

- **Fork source:** `a013f5330`.
- **Upstream patch:** [app: add generic DMG license
  support](headlamp-upstream-patches/headlamp-upstream-dmg-license.patch).
- **Downstream removal:** [drop the duplicated fork
  support](headlamp-upstream-patches/headlamp-downstream-remove-dmg-license-fix.patch).
- **AKS Desktop follow-up:** Keep the AKS license content in product assembly.
  The dependency only enables electron-builder's generic macOS license support.
- **Upstream validation:** `npm run app:tsc`; `npm run app:lint`; all 139 app
  unit tests.
- **Removal validation:** `npm run app:tsc`; `npm run app:lint`; all 141
  downstream app unit tests.

### Honor Table toolbar and row-selection options

- **Fork source:** `5f7ade8ca`.
- **Upstream patch:** [frontend: honor Table toolbar and selection
  props](headlamp-upstream-patches/headlamp-upstream-table-props.patch).
- **Downstream removal:** [drop the duplicated fork
  fixes](headlamp-upstream-patches/headlamp-downstream-remove-table-props-fix.patch).
- **AKS Desktop follow-up:** None. AKS plugin tables can use the existing public
  options without a product-specific wrapper.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  14 Table Storybook tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  14 downstream Table Storybook tests.

### Keep SimpleTable content visible when columns resize

- **Fork sources:** `0b63e2251` and its duplicate `e87e6d6fe`.
- **Upstream patch:** [frontend: remove cell overflow that truncates
  ConditionsTable](headlamp-upstream-patches/headlamp-upstream-simpletable-overflow.patch).
- **Downstream removal:** [drop the folded fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-simpletable-overflow-fix.patch).
- **AKS Desktop follow-up:** None. AKS details pages use the shared table and
  automatically retain visible condition text when columns resize.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  11 SimpleTable Storybook tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  11 downstream SimpleTable Storybook tests.

### Label the pod debug image field for screen readers

- **Fork source:** `a1769847c`.
- **Upstream patch:** [frontend: label the pod debug image
  field](headlamp-upstream-patches/headlamp-upstream-debug-image-narration.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-debug-image-narration-fix.patch).
- **AKS Desktop follow-up:** None. The shared cluster setting supplies the
  translated visible and accessible label for AKS clusters.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  locale consistency; all 17 PodDebugSettings and SettingsCluster Storybook
  tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  locale consistency; all 17 downstream settings Storybook tests.

### Group unscheduled pods in Resource Map node view

- **Fork source:** `b205d0618`.
- **Upstream patch:** [frontend: group unscheduled pods in Resource
  Map](headlamp-upstream-patches/headlamp-upstream-unscheduled-pod-grouping.patch).
- **Downstream removal:** [drop the duplicated fork
  feature](headlamp-upstream-patches/headlamp-downstream-remove-unscheduled-pod-grouping-fix.patch).
- **AKS Desktop follow-up:** None. Pending AKS pods remain visible under a
  product-neutral `Unscheduled` group.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  12 `graphGrouping` tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  nine downstream `graphGrouping` tests.

### Skip Unix shell lookup on Windows

- **Fork source:** `ac7319372`.
- **Upstream patch:** [app: skip Unix shell lookup on
  Windows](headlamp-upstream-patches/headlamp-upstream-windows-shell-lookup.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-windows-shell-lookup-fix.patch).
- **AKS Desktop follow-up:** None. On Windows, Headlamp uses the current process
  environment and no longer probes Unix shell paths before returning it.
- **Upstream validation:** `npm run app:tsc`; `npm run app:lint`; all 139 app
  unit tests.
- **Removal validation:** `npm run app:tsc`; `npm run app:lint`; all 141
  downstream app unit tests.

### Ignore tooltip portals in landmark accessibility checks

- **Fork source:** `5e3c5e26c`.
- **Upstream patch:** [end-to-end tests: exclude tooltips from landmark
  checks](headlamp-upstream-patches/headlamp-upstream-tooltip-landmark-check.patch).
- **Downstream removal:** [drop the duplicated fork test
  fix](headlamp-upstream-patches/headlamp-downstream-remove-tooltip-landmark-check-fix.patch).
- **AKS Desktop follow-up:** None. The shared accessibility helper accepts an
  explicit exclusion, and only the pods page excludes Material UI tooltip
  portals that render outside landmark regions.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  direct lint and formatting checks for the changed end-to-end files; Playwright
  discovered all four pod scenarios. Running those scenarios requires a live
  Kubernetes test cluster.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`;
  direct lint and formatting checks for the changed end-to-end file; Playwright
  discovered both downstream pod scenarios.

### List allowed namespaces without cluster-wide access

- **Fork source:** `06f1208e6`.
- **Upstream patch:** [frontend: fetch allowed namespaces
  individually](headlamp-upstream-patches/headlamp-upstream-allowed-namespace-list.patch).
- **Downstream removal:** [drop the duplicated fork
  fix](headlamp-upstream-patches/headlamp-downstream-remove-allowed-namespace-list-fix.patch).
- **AKS Desktop follow-up:** None. Restricted AKS users automatically receive a
  synthesized namespace list without requiring permission to list or watch all
  namespaces.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  32 `useKubeObjectList` tests, including the new individual-fetch and
  watch-suppression regression.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; all
  19 downstream `useKubeObjectList` tests.

### Allow bundled plugins to be disabled by default

- **Fork source:** `2ce445ee1`.
- **Upstream patch:** [app: support default-disabled bundled
  plugins](headlamp-upstream-patches/headlamp-upstream-default-disabled-plugins.patch).
- **Downstream removal:** [drop the duplicated fork
  support](headlamp-upstream-patches/headlamp-downstream-remove-default-disabled-plugins-fix.patch).
- **AKS Desktop follow-up:** Set `enabledByDefault: false` on the relevant entry
  in the external AKS plugin-bundle manifest and preserve that field when
  generating Headlamp's build manifest. Existing user choices continue to take
  precedence after first discovery.
- **Upstream validation:** `npm run frontend:tsc`; `npm run app:tsc`;
  `npm run frontend:lint`; all six `updateSettingsPackages` tests.
- **Removal validation:** `npm run frontend:tsc`; `npm run app:tsc`;
  `npm run frontend:lint`; all four downstream `updateSettingsPackages` tests.

### Support conditional project overview sections

- **Fork source:** `5e79994e5`.
- **Upstream patch:** [frontend: support conditional project overview
  sections](headlamp-upstream-patches/headlamp-upstream-conditional-project-overview-sections.patch).
- **Downstream removal:** [drop the duplicated fork
  extension](headlamp-upstream-patches/headlamp-downstream-remove-conditional-project-overview-sections-fix.patch).
- **AKS Desktop follow-up:** None. AKS project overview contributions may use
  the product-neutral optional `isEnabled` predicate after Headlamp is updated.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  Project Details Storybook test.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  downstream Project Details Storybook test.

### Let project header actions select a tab

- **Fork source:** `22a5008a2`.
- **Upstream patch:** [frontend: pass tab selection to project header
  actions](headlamp-upstream-patches/headlamp-upstream-project-header-action-navigation.patch).
- **Downstream removal:** [drop the duplicated fork
  extension](headlamp-upstream-patches/headlamp-downstream-remove-project-header-action-navigation-fix.patch).
- **AKS Desktop follow-up:** None. Project header actions receive an optional
  product-neutral callback and can navigate to a registered project tab.
- **Upstream validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  Project Details Storybook test.
- **Removal validation:** `npm run frontend:tsc`; `npm run frontend:lint`; the
  downstream Project Details Storybook test.

Each check was run immediately after its patch commit. The upstream theme,
resource-view, table, narration, Resource Map, namespace, plugin, and
static-serving patches add or update focused regression coverage. Submit the
upstream patches as separate pull requests; they do not contain AKS-specific
behavior. For each future patch, record both the downstream removal and the
corresponding AKS Desktop configuration or plugin migration. When no product
change is needed, state why the upstream behavior is transparent or
backward-compatible.

## Important look-alikes

These comparisons prevent over-aggressive deletion based on similar subjects:

| Downstream | Upstream look-alike | Result |
| --- | --- | --- |
| `c4b0bb453` artifact name | `d76976282` package naming | Current upstream again uses `${productName}`; retain as product identity configuration. |
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

## LogsViewer reassessment

The downstream `LogsViewer` chain can be removed if AKS Desktop adopts
Headlamp `v0.44.0`'s Activity-based workload-log experience. It is not
patch-identical or a drop-in API replacement, but its product-neutral
functionality now has a maintained alternative:

- upstream `LogsButton` aggregates a workload's pods and supports Deployment,
  ReplicaSet, DaemonSet, StatefulSet, and Job;
- the activity can select one pod or all pods, select a container, choose line
  count, show previous logs, follow and reconnect, show timestamps, filter by
  severity, search, clear, and download;
- upstream exports `LogsButton`, `launchWorkloadLogs`, and
  `LOGGABLE_WORKLOAD_KINDS` through the plugin library; and
- the underlying `LogViewer` has no-dialog rendering, current theme support,
  accessible action labels, and search-listener cleanup.

The relevant upstream work is present in `v0.44.0`, including the
[workload log API and cross-bundle support](https://github.com/kubernetes-sigs/headlamp/commit/019103c40b0a37f18db0c20b8340ccaa10678d16),
[multi-pod rendering fix](https://github.com/kubernetes-sigs/headlamp/commit/aec7c6a4d8fe012cbf4fbab81024c8fac1c53264),
[severity filtering](https://github.com/kubernetes-sigs/headlamp/commit/c5b06decf1833def7289252c732eb8de719c2f8e),
[Job support](https://github.com/kubernetes-sigs/headlamp/commit/efe6526d744c587ddf8bd7bec87a7df1050cb180),
and [DaemonSet integration](https://github.com/kubernetes-sigs/headlamp/commit/6e57d6155f4cfcee7a300d6757ac863129f1a658).

AKS Desktop's `LogsTab` currently imports the downstream plural
`LogsViewer` and renders it inline. Before dropping the fork commits, migrate
that tab to the exported upstream `LogsButton` or `launchWorkloadLogs` activity
and add a behavior test. This changes the presentation from an inline viewer to
Headlamp's full Activity. If inline rendering remains a product requirement,
request a supported upstream content/customization API instead of retaining a
second core log implementation. The AI Assistant's response-log dialog is a
different feature and is not part of this downstream chain. Therefore the six
commits cannot simply be dropped while leaving the plugin unchanged: first
confirm the Activity UX is acceptable, then migrate and remove them.

## Commit ledger

| # | Commit | Decision / replacement area | What to do |
| ---: | --- | --- | --- |
| 1 | `863957d9d` Add kubectl to valid commands | **Upstream extension / Command execution** | Declare the AKS plugin's `kubectl` scope; remove the global hard-coded allowlist entry. |
| 2 | `af6132f55` Rebrand package name | **AKS configuration / Product identity** | Set product package name in the product manifest. |
| 3 | `35c871acd` Replace icons | **AKS configuration / Product identity** | Supply the AKS icon set during assembly. |
| 4 | `c4b0bb453` Use package name in artifact names | **AKS configuration / Product identity** | Let the desktop kit accept an artifact-name template. |
| 5 | `c25c2099b` Remove Linux `executableName` | **AKS configuration / Product identity** | Derive or override the executable name in product builder configuration. |
| 6 | `43dc0e88f` Cache shell environment | **Remove / Command execution** | Upstream `63b629102` and `47c426634` provide newer login-shell caching; run command tests after rebase. |
| 7 | `b6b1c330a` AKS plugin command support | **Fold / Command execution** | Fold into row 106; replace plugin-name branches with broker capabilities. |
| 8 | `920dd7a8b` Frontend kubectl integration | **Fold / Command execution** | Fold into row 106; consume the supported browser command API from the plugin. |
| 9 | `290767161` Update `productName` | **Fold / Product identity** | Fold into row 2 and set `displayName`. |
| 10 | `b2e6b1d94` Include PATH to avoid `ENOENT` | **Needs decision / Command execution** | Re-test on upstream shell-environment work; otherwise keep as a broker test/fix, not AKS branding. |
| 11 | `82365514d` Default AKS command consent | **Upstream extension / Command execution** | Use declared, reviewable command scopes; do not silently bypass consent in core. |
| 12 | `44422b2e1` Fix az/kubectl consent | **Fold into row 11** | Preserve final behavior in command-broker tests. |
| 13 | `dd207f955` Add kubelogin | **Upstream extension / Command execution, external tools** | Declare the pinned tool and only its required command scopes. |
| 14 | `bb74bc751` Bundle Azure CLI | **AKS configuration / External tools** | Assemble the pinned platform artifact outside Headlamp. |
| 15 | `915036dc1` Move Azure CLI folder | **Fold / External tools** | Make the final path a product-manifest resource mapping. |
| 16 | `c09a33860` Allow registration script | **Remove / Cluster registration** | The script was removed by row 19; do not expose it through the broker. |
| 17 | `c79db3039` Remove kubelogin permission | **Fold into row 13** | Keep only the final least-privilege scope set. |
| 18 | `3d7ddb3a6` Update branded snapshot | **Fold / Product identity** | Regenerate product tests from the external branding config. |
| 19 | `1d1f03e58` Programmatic AKS registration | **Upstream extension + AKS plugin / Cluster registration** | Upstream a provider contract; move the implementation to the AKS provider. |
| 20 | `72e169328` Windows quoting fix | **Remove / Command execution** | Upstream `v0.44.0` already passes the executable directly to `spawn` with `shell: false`; drop this duplicate after command tests. |
| 21 | `ac7319372` Avoid shell except on Windows | **Upstream fix / Command execution** | Use the [ready Windows environment patch](headlamp-upstream-patches/headlamp-upstream-windows-shell-lookup.patch). |
| 22 | `d125e6505` Azure CLI path through env | **Upstream extension / Command execution, external tools** | Resolve a declared tool ID to a verified path instead of a mutable AKS-only env variable. |
| 23 | `69e20c5dd` Exclude catalog plugins | **AKS configuration / Plugin bundle** | List product-disabled built-ins in the AKS manifest. |
| 24 | `65e207537` Remove Artifact Hub proxy config | **AKS configuration / Plugin bundle** | Put plugin source/proxy policy in the AKS manifest. |
| 25 | `33f4cfb35` Change empty cluster message | **AKS configuration / Public frontend configuration** | Supply an AKS public message/empty-state contribution. |
| 26 | `24889f999` Update package name and author | **Fold / Product identity** | Fold into row 2. |
| 27 | `5eb5cd53e` Build with AKS version | **AKS configuration / Product identity** | Read the product version from the AKS release source. |
| 28 | `d68693b04` Show AKS version in About | **Upstream extension / Public frontend configuration** | Expose runtime product information/About contributions. |
| 29 | `067bf68f3` Show AKS version in top bar | **Fold / Public frontend configuration** | Consume the same product-information interface as row 28. |
| 30 | `024ec74a7` New LogsViewer | **Needs decision / Remove** | If the Activity user experience is accepted, migrate `LogsTab` and drop this; otherwise upstream an inline content interface. |
| 31 | `7725d00f3` Verify bundled tools | **AKS configuration / External tools** | Keep verification in the AKS assembly pipeline and validate every target. |
| 32 | `ed960d0a3` Add external tools to macOS | **AKS configuration / External tools** | Use per-platform resource mappings. |
| 33 | `9a3ccb390` Remove unscoped external resource | **Fold / External tools** | Keep only the final platform-scoped mapping. |
| 34 | `a013f5330` Add DMG license | **Upstream fix** | Use the [ready generic electron-builder patch](headlamp-upstream-patches/headlamp-upstream-dmg-license.patch). |
| 35 | `5e79994e5` Conditional project overview sections | **Upstream fix / Project extensions** | Use the [ready conditional-section patch](headlamp-upstream-patches/headlamp-upstream-conditional-project-overview-sections.patch). |
| 36 | `e0f08105d` Suppress az confirmation | **Fold into row 11** | Represent any product-approved scope in policy; do not hard-code AKS bypasses. |
| 37 | `d484bcd0f` Disable release notes | **AKS configuration / Public frontend configuration** | Set the public `releaseNotes` product flag. |
| 38 | `0f537cf57` Add LogsViewer index | **Fold into row 30** | It becomes unnecessary only after the row 30 plugin migration. |
| 39 | `6e70e0740` Add cached icons | **Fold / Product identity** | Generate/copy all required icon variants during assembly. |
| 40 | `a1d884296` Fix app builds in CI | **AKS configuration / Product identity** | Move root-version and builder-path assumptions to the product build kit. |
| 41 | `f45b3b90c` Fix package for macOS build | **Fold / Product identity** | Fold the final settings into product builder configuration. |
| 42 | `12b579560` Add `secondaryContrastText` | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-secondary-theme-contrast.patch). |
| 43 | `645f38d2e` Build arm64 only | **AKS configuration / Product identity** | Declare targets; confirm whether the temporary x64 exclusion is still wanted. |
| 44 | `c01009765` Update icons | **Fold into row 3** | Keep only the current AKS icon set. |
| 45 | `ceea7720d` Update Azure logo | **AKS configuration / Product identity, public frontend configuration** | Supply product logo assets without editing Headlamp source. |
| 46 | `bd39620b1` Reload after cluster deletion | **Needs decision / Upstream fix** | Reproduce the stale state, then upstream a targeted reset or justify the full reload. |
| 47 | `2ce445ee1` Default-disabled plugins | **Upstream fix / Plugin bundle** | Use the [ready plugin-default patch](headlamp-upstream-patches/headlamp-upstream-default-disabled-plugins.patch); select disabled plugins in AKS configuration. |
| 48 | `a2be5742f` Add disabled Kaito plugin | **AKS configuration / Plugin bundle** | Declare Kaito and its disabled default in the AKS manifest. |
| 49 | `7a830d425` Add Microsoft headers | **Fold** | Keep notices only on AKS-owned files after extraction; do not patch upstream files. |
| 50 | `5fae2b773` Separate managed projects by cluster | **Upstream extension + AKS plugin / Project extensions** | Add a generic project identity/key hook; implement AKS policy in the plugin. |
| 51 | `4d854f759` Add Legal tab | **Upstream extension / Product identity** | Support product legal files/About sections in the desktop kit. |
| 52 | `40364e142` Update 404 page | **AKS configuration / Public frontend configuration** | Supply branded graphic/text through public product configuration. |
| 53 | `e697c0aaf` Override macOS version | **Fold / Product identity** | Use the single product version source from row 27. |
| 54 | `578cd9cb6` Azure-RBAC-only kubelogin auth | **AKS plugin / Cluster registration** | Keep Azure auth selection in the AKS provider. |
| 55 | `fcf1a7759` Replace error page | **AKS configuration / Public frontend configuration** | Supply branded error content/assets. |
| 56 | `5504295b8` Comment default consent | **Fold into row 11** | Document the generic policy instead of retaining a code-only commit. |
| 57 | `c5a969eab` Open ViewButton activity on right | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-view-button-split-right.patch). |
| 58 | `00320948b` Stop retries for sub-500 responses | **Needs decision / Upstream fix** | Decide whether 408/429 should retry, then submit only the agreed generic policy with status tests. |
| 59 | `06f1208e6` Handle allowed namespaces in list queries | **Upstream fix** | Use the [ready namespace-query patch](headlamp-upstream-patches/headlamp-upstream-allowed-namespace-list.patch). |
| 60 | `edcdb2ba4` Correct plugin source-map offset | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-plugin-source-map-offset.patch). |
| 61 | `a73b4302a` Move `getAllowedNamespaces` | **Fold into row 59** | Move only if needed by the final namespace design; the export already exists upstream. |
| 62 | `c9ec6c99c` Update branded error snapshots | **Fold into row 55** | Regenerate product-level tests. |
| 63 | `41d003eca` Import managed-namespace project | **AKS plugin / Cluster registration, project extensions** | Keep managed-namespace semantics in the AKS provider/plugin. |
| 64 | `cdee9d62b` Include kubelogin script conditionally | **Fold into row 54** | Resolve the declared tool only for clusters that need it. |
| 65 | `5f7ade8ca` Honor Table selection/top-bar props | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-table-props.patch). |
| 66 | `db7e2db03` Expose desktop platform | **Upstream fix** | Use the [ready typed patch](headlamp-upstream-patches/headlamp-upstream-desktop-platform.patch). |
| 67 | `5944280a5` Override Linux product name | **Fold / Product identity** | Fold into product builder configuration. |
| 68 | `d709d2ddf` Add base Kubernetes MSW handlers | **Upstream fix** | Rebase handlers onto the shared API base and submit with stories. |
| 69 | `013129c89` Fix GraphView CRD watch story | **Upstream fix** | Use the [ready rebased story patch](headlamp-upstream-patches/headlamp-upstream-graphview-crd-watch.patch). |
| 70 | `dd6cf9ae4` Fix docs TypeScript errors | **Remove** | The current upstream documentation build passes, and plugin locale metadata now has the dedicated `PluginPackageInfo` type. |
| 71 | `5e3c5e26c` Fix tooltip landmark check | **Upstream fix** | Use the [ready end-to-end accessibility patch](headlamp-upstream-patches/headlamp-upstream-tooltip-landmark-check.patch). |
| 72 | `2f54e5cde` Fix log-search e2e test | **Fold into row 30** | Replace it with upstream workload-log and `LogViewer` coverage after migration. |
| 73 | `53917bfee` Use AKS HTML title | **AKS configuration / Public frontend configuration** | Populate the public title/product name during assembly or startup. |
| 74 | `642809609` Fix Electron zoom menu | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-electron-zoom-menu-actions.patch). |
| 75 | `ee162d9af` Expand locales | **Needs decision / Translations** | Upstream only still-missing generic locales; keep AKS strings in a supported overlay. |
| 76 | `3b01fe701` Ignore generated resources | **Fold / Product identity** | Ignore outputs in the AKS assembly workspace, not upstream source. |
| 77 | `195494e46` Announce EmptyContent | **Remove** | The final fork and upstream `EmptyContent.tsx` are identical; table live regions now cover the retained behavior. |
| 78 | `076a7feda` Add Electron secure storage | **Upstream extension / Secure storage** | Upstream a product-neutral, plugin-namespaced service and tests. |
| 79 | `e528e6a05` Add GitHub OAuth flow | **Upstream extension / OAuth sign-in** | Generalize provider registration; keep GitHub policy in the AKS plugin. |
| 80 | `da5a560ed` Move OAuth tests to Vitest | **Fold into row 79** | Include tests with the generalized provider. |
| 81 | `a20c30755` Stabilize EmptyContent timing | **Remove** | Its effect is absent from the final fork; there is no remaining patch to upstream. |
| 82 | `0fa88cf56` Respect `KUBECONFIG` when writing | **AKS plugin / Cluster registration** | Keep in the AKS provider; require the generic provider contract to pass the target path. |
| 83 | `b8f52f6f4` Remove Azure credential format | **AKS plugin / Cluster registration** | Keep this Azure/kubelogin policy in the AKS provider. |
| 84 | `a6e5b073a` Accessible Table column selector | **Upstream fix** | Submit the keyboard/menu implementation; persistence work does not replace it. |
| 85 | `adbf7f039` Disable cache for static plugins | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-static-plugin-no-cache.patch). |
| 86 | `46e6c031b` Make project tabs usable at zoom | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-project-tabs-zoom.patch). |
| 87 | `2fd768195` Update project creation menu | **Needs decision / Project extensions** | If generic user experience, upstream it; if AKS workflow, implement through a project creation contribution. |
| 88 | `c28257a3b` Fix original-name narration | **Remove** | Current upstream `f7c5f76f0` contains the complete fix; verify screen-reader behavior. |
| 89 | `44e78118a` Fix severity narration | **Needs decision / row 30** | Verify upstream's severity selector narration; submit a focused fix if the gap remains. |
| 90 | `26d8e68de` Label log search buttons | **Remove after row 30** | Upstream actions have translated accessible descriptions; verify them after migration. |
| 91 | `22a5008a2` Pass `setSelectedTab` to header actions | **Upstream fix / Project extensions** | Use the [ready project-header navigation patch](headlamp-upstream-patches/headlamp-upstream-project-header-action-navigation.patch). |
| 92 | `10c313f02` Fix command/plugin IPC listener leaks | **Upstream fix / Command execution** | Rebase on the new preload listener registry; retain command cleanup/error exits not upstream. |
| 93 | `d9748fb0c` Improve appearance-control narration | **Upstream fix** | Use the [ready follow-up patch](headlamp-upstream-patches/headlamp-upstream-appearance-control-narration.patch) after upstream `7c6a4ecf5`. |
| 94 | `a1769847c` Narrate debug image setting | **Upstream fix** | Use the [ready accessibility patch](headlamp-upstream-patches/headlamp-upstream-debug-image-narration.patch). |
| 95 | `0570f3a31` Style Material UI Alert in dark mode | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-dark-alert-contrast.patch). |
| 96 | `86a4ce067` Derive deep-link scheme | **AKS configuration / Product identity, OAuth sign-in** | Read the protocol from the product manifest; do not hard-code AKS. |
| 97 | `0badba5aa` Reflow map labels at zoom | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-resource-map-label-reflow.patch). |
| 98 | `4b6197255` Keep resource grid visible at zoom | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-project-grid-zoom.patch) after row 86. |
| 99 | `65c871c7c` Hide empty project details card | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-hide-empty-project-sections.patch). |
| 100 | `6f13c6288` Keep EditorDialog visible at zoom | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-editor-dialog-zoom.patch); keep it separate from the upstream DataField zoom fix. |
| 101 | `b205d0618` Group unscheduled pods | **Upstream fix** | Use the [ready Resource Map patch](headlamp-upstream-patches/headlamp-upstream-unscheduled-pod-grouping.patch). |
| 102 | `0b63e2251` Prevent ConditionsTable truncation | **Upstream fix** | Use the [ready SimpleTable patch](headlamp-upstream-patches/headlamp-upstream-simpletable-overflow.patch). |
| 103 | `513e3ba2d` Announce no table data | **Remove** | Current upstream `de73608f2` supplies the same behavior; verify narration. |
| 104 | `e87e6d6fe` Remove hidden cell overflow | **Fold into row 102** | Duplicate/follow-up application of the same SimpleTable change; submit once. |
| 105 | `148b45e3c` Use AKS backend app/User-Agent name | **Upstream extension / Product identity** | Add a backend runtime app-name setting supplied by the product manifest. |
| 106 | `fa1dcf6d1` Add runCmd plugin identification | **Upstream extension / Command execution** | Upstream the permissioned identity contract; remove AKS/AI package branches. |
| 107 | `551275e71` Add AKS Arc cluster type | **AKS plugin / Cluster registration** | Implement Arc as an AKS provider mode. |
| 108 | `0aa41fb22` Fix runCmd test mocks | **Fold into row 106** | Port relevant tests to the generic broker. |
| 109 | `903360924` Expand LogsViewer workload types | **Fold into row 30** | Upstream covers these types, so this becomes unnecessary after the row 30 migration. |
| 110 | `2babb4675` Suppress ESLint warnings | **Fold** | Fix warnings in their destination pull requests; do not carry a suppression commit. |
| 111 | `a87a8909f` Update translations | **Fold / Translations** | Regenerate upstream strings in their pull requests and keep AKS strings in the overlay. |
| 112 | `3c9d0b941` Adjust backend output verification | **AKS configuration / Product identity** | Generate verification paths from product artifact metadata. |
| 113 | `fcad69534` Update verified binary name | **Fold into row 112** | Keep only the final generated verification expectation. |
| 114 | `badc4713b` Use `execFileSync` for list-plugins | **Upstream fix** | Use the [ready patch](headlamp-upstream-patches/headlamp-upstream-list-plugins-without-shell.patch). |
| 115 | `c7505cce7` Canonical AI Assistant identity | **AKS configuration / Plugin bundle, command execution** | Preserve the host-side ID in separate vendored-plugin policy; the vendored plugin itself is out of scope. |

## Suggested upstream batches

| Batch | Commits | Notes |
| --- | --- | --- |
| Command/desktop correctness | `ac7319372`, `db7e2db03`, `642809609`, `10c313f02`, `badc4713b` | Keep separate from AKS permissions; small pull requests may review better. Row 20 is already supplied upstream. |
| Project extensions | `5e79994e5`, `22a5008a2` | Complete existing overview/header extension APIs. |
| Plugin support | `2ce445ee1`, `edcdb2ba4`, `dd6cf9ae4`, `adbf7f039` | Defaults, source maps/types, and static serving. |
| Kubernetes/query/table | `00320948b`, `06f1208e6`, `5f7ade8ca`, `d709d2ddf`, `013129c89`, `a6e5b073a`, `0b63e2251` | Rebase together to resolve shared Table/mock changes, then split reviewable PRs. |
| Accessibility/theme | `12b579560`, `46e6c031b`, `d9748fb0c`, `a1769847c`, `0570f3a31`, `0badba5aa`, `4b6197255`, `6f13c6288` | Product-neutral; regenerate current snapshots/translations. |

Resolve every **Needs decision** entry during the rebase: row 10 (PATH handling), row 46
(cluster-deletion state), row 58 (retry statuses), row 75 (locale ownership),
row 87 (project-creation user experience), row 30 (inline versus Activity logs), and row 89
(severity narration).

Command execution, cluster registration, secure storage, OAuth sign-in,
product identity, and project extension interfaces need upstream design
agreement before AKS can consume a pristine distribution. The ledger is not a
request to upstream every downstream commit verbatim.
