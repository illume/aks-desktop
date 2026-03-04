// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { injectAccessibilityStyles } from './accessibilityStyles';

const STYLE_ID = 'aks-desktop-a11y-styles';

describe('injectAccessibilityStyles', () => {
  beforeEach(() => {
    // Remove any existing injected style so each test starts clean.
    document.getElementById(STYLE_ID)?.remove();
  });

  afterEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  test('injects a <style> element into document.head', () => {
    injectAccessibilityStyles();
    const el = document.getElementById(STYLE_ID);
    expect(el).not.toBeNull();
    expect(el?.tagName.toLowerCase()).toBe('style');
  });

  test('injected style contains overflow-x: hidden rule for html', () => {
    injectAccessibilityStyles();
    const el = document.getElementById(STYLE_ID);
    expect(el?.textContent).toContain('overflow-x: hidden');
    expect(el?.textContent).toContain('html');
  });

  test('calling injectAccessibilityStyles twice does not duplicate the <style> element', () => {
    injectAccessibilityStyles();
    injectAccessibilityStyles();
    const all = document.querySelectorAll(`#${STYLE_ID}`);
    expect(all.length).toBe(1);
  });
});
