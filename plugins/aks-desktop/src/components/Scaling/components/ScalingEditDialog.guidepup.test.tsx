// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

// @vitest-environment jsdom
import { virtual } from '@guidepup/virtual-screen-reader';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@kinvolk/headlamp-plugin/lib', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Stub Iconify so the test focuses on dialog structure rather than icon loading.
// Forward aria-hidden so guidepup assertions reflect the real component's accessibility attributes.
vi.mock('@iconify/react', () => ({
  Icon: ({ icon, 'aria-hidden': ariaHidden }: { icon: string; 'aria-hidden'?: string | boolean }) =>
    ariaHidden ? null : <span>{icon}</span>,
}));

import type { EditValues } from '../hooks/useEditDialog';
import { ScalingEditDialog } from './ScalingEditDialog';

const defaultEditValues: EditValues = {
  minReplicas: 2,
  maxReplicas: 10,
  targetCPU: 60,
  replicas: 3,
};

const hpaInfo = {
  name: 'frontend-hpa',
  namespace: 'default',
  minReplicas: 2,
  maxReplicas: 10,
  targetCPUUtilization: 60,
  currentCPUUtilization: 45,
  currentReplicas: 3,
  desiredReplicas: 3,
};

/** Walk the virtual screen reader until "end of document", returning all spoken phrases. */
async function collectPhrases(maxSteps = 80): Promise<string[]> {
  const phrases: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const phrase = await virtual.lastSpokenPhrase();
    phrases.push(phrase);
    if (phrase === 'end of document') break;
    await virtual.next();
  }
  return phrases;
}

afterEach(async () => {
  await virtual.stop();
  cleanup();
});

describe('ScalingEditDialog guidepup screen reader', () => {
  /**
   * Tests that the HPA dialog title is announced, confirming screen reader
   * users can identify the dialog purpose.
   */
  test('announces HPA dialog title', async () => {
    render(
      <ScalingEditDialog
        open
        hpaInfo={hpaInfo}
        editValues={defaultEditValues}
        saving={false}
        onEditValuesChange={() => {}}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    // MUI Dialog renders into a portal on document.body
    await virtual.start({ container: document.body });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Edit HPA Configuration'))).toBe(true);
  });

  /**
   * Tests that the manual scaling dialog title is announced.
   */
  test('announces manual scaling dialog title', async () => {
    render(
      <ScalingEditDialog
        open
        hpaInfo={null}
        editValues={defaultEditValues}
        saving={false}
        onEditValuesChange={() => {}}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    await virtual.start({ container: document.body });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Edit Manual Scaling Configuration'))).toBe(true);
  });

  /**
   * Tests that the Cancel and Save buttons are announced, confirming
   * keyboard-only users can discover the dialog actions.
   */
  test('announces Cancel and Save buttons', async () => {
    render(
      <ScalingEditDialog
        open
        hpaInfo={hpaInfo}
        editValues={defaultEditValues}
        saving={false}
        onEditValuesChange={() => {}}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    await virtual.start({ container: document.body });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Cancel'))).toBe(true);
    expect(phrases.some(p => p.includes('Save'))).toBe(true);
  });

  /**
   * Tests that the saving state progress indicator is properly announced
   * so screen reader users know the dialog is processing.
   */
  test('announces saving state with progress bar label', async () => {
    render(
      <ScalingEditDialog
        open
        hpaInfo={hpaInfo}
        editValues={defaultEditValues}
        saving
        onEditValuesChange={() => {}}
        onClose={() => {}}
        onSave={async () => {}}
      />
    );

    await virtual.start({ container: document.body });
    const phrases = await collectPhrases();

    expect(phrases.some(p => p.includes('Saving'))).toBe(true);
  });
});
