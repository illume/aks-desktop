// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * Injects global CSS to fix accessibility issues at high browser zoom levels (e.g. 200%).
 *
 * Issue: When tabbing through the Map or Network panel, the panel scrolls horizontally
 * to the right, making the left part of the panel (navigation links, tab labels) invisible.
 *
 * Fix: Prevent the viewport from scrolling horizontally when keyboard focus moves to
 * elements that are positioned outside the visible area at high zoom levels.
 */
export function injectAccessibilityStyles(): void {
  const id = 'aks-desktop-a11y-styles';
  if (document.getElementById(id)) {
    return;
  }

  const style = document.createElement('style');
  style.id = id;

  // At 200% browser zoom the effective CSS viewport width is halved (e.g. 640 px on a
  // 1280-pixel display).  Interactive elements inside the Map (React-Flow canvas) and
  // Network panels can end up beyond the right edge of the viewport.  When keyboard
  // focus moves to those elements the browser calls scrollIntoView(), which scrolls the
  // document horizontally and hides the left-hand navigation / tab labels.
  //
  // Setting overflow-x: hidden on <html> prevents the document viewport from scrolling
  // horizontally.  Internal scroll containers (resource tables, terminals, the React-Flow
  // canvas) keep their own overflow behaviour unchanged because they have their own
  // overflow-x: auto / scroll declarations.
  style.textContent = `
    /* Prevent the page from scrolling horizontally when keyboard focus (Tab) moves to
       off-screen elements inside the Map or Network panels at 200%+ browser zoom.
       All inner scroll containers (resource tables, terminals, the React-Flow canvas)
       retain their own overflow settings. */
    html {
      overflow-x: hidden;
    }
  `;

  document.head.appendChild(style);
}
