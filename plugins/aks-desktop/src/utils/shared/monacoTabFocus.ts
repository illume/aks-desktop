// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

import { TabFocus } from 'monaco-editor/esm/vs/editor/browser/config/tabFocus';

/**
 * Enables Monaco's Tab Focus Mode so that pressing Tab inside a Monaco editor
 * moves browser focus to the next element instead of inserting a tab character.
 *
 * **Why this is necessary**: The `tabFocusMode` property in `IEditorOptions`
 * appears to control this behaviour, but it is completely overridden at runtime.
 * Monaco's `codeEditorWidget` sets the actual `tabMovesFocus` context key from
 * the global `TabFocus` singleton (codeEditorWidget.js:1528), not from the
 * editor option. `editorConfiguration.js:87` confirms that `env.tabFocusMode`
 * is always `TabFocus.getTabFocusMode()`.  There is no public API to set this
 * singleton, so we import the internal module directly.
 *
 * The singleton is shared by all Monaco editors on the page.
 * `setTabFocusMode` is idempotent — safe to call multiple times.
 */
export function enableMonacoTabFocusMode(): void {
  TabFocus.setTabFocusMode(true);
}
