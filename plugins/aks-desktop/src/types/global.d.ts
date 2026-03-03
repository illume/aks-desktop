// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

declare module 'child_process' {
  export function spawn(command: string, args?: string[], options?: any): any;
}

/**
 * Type declaration for the Monaco editor's internal TabFocus module.
 * This is not part of Monaco's public API; see monacoTabFocus.ts for rationale.
 */
declare module 'monaco-editor/esm/vs/editor/browser/config/tabFocus' {
  export const TabFocus: {
    getTabFocusMode(): boolean;
    setTabFocusMode(tabFocusMode: boolean): void;
  };
}

declare global {
  interface Window {
    fetch: typeof fetch;
  }
}
