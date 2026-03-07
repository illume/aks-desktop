// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

// @vitest-environment jsdom
/**
 * Screen reader tests for {@link CreateAKSProjectPure} using
 * {@link https://www.guidepup.dev/docs/virtual @guidepup/virtual-screen-reader}.
 *
 * The Virtual Screen Reader processes W3C ARIA specs (ACCNAME 1.2, CORE-AAM 1.2,
 * WAI-ARIA 1.2, HTML-AAM) to compute exactly what a real screen reader would
 * announce.  It is the recommended approach for CI environments where real AT
 * (Orca / NVDA / JAWS) is not installed.
 *
 * Each scenario matches a Storybook story so stories remain the single source of
 * truth for both the visual catalogue and AT coverage.
 *
 * Verified per state:
 *  BasicsStepDefault — breadcrumb nav landmark; step buttons; aria-current; no
 *                      decorative icon images; Cancel / Next buttons
 *  LoadingOverlay    — aria-busy "busy" token; "Creating Project" progressbar;
 *                      progress text present in document
 *  ErrorOverlay      — alertdialog announced with title; role=alert live region
 *                      contains the error text; enabled Cancel button
 *  SuccessDialog     — dialog announced with title; role=status live region
 *                      contains success text; Application name textbox;
 *                      Create Application button disabled when name is empty
 *
 * Note on inert + jsdom: jsdom does not implement the HTML `inert` attribute, so
 * buttons behind the loading overlay still appear in the virtual SR tree as
 * disabled (the disabled prop is respected). Real browsers hide them from AT
 * entirely.  This limitation is documented where relevant.
 */
import '@testing-library/jest-dom/vitest';
import { virtual } from '@guidepup/virtual-screen-reader';
import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('@kinvolk/headlamp-plugin/lib', async () => {
  const i18n = (await import('i18next')).default;
  const { initReactI18next, useTranslation } = await import('react-i18next');
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: 'en',
      resources: { en: { translation: {} } },
      interpolation: { escapeValue: false },
      returnEmptyString: false,
    });
  }
  return { useTranslation };
});

vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => ({
  PageGrid: ({ children }: any) => <div>{children}</div>,
  SectionBox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@iconify/react', () => ({
  Icon: ({ icon, 'aria-hidden': ariaHidden }: any) => (
    <span data-icon={icon} aria-hidden={ariaHidden ?? 'true'} />
  ),
}));

import CreateAKSProjectPure from './CreateAKSProjectPure';
import type { CreateAKSProjectPureProps } from './CreateAKSProjectPure';
import { STEPS } from '../types';

// ── Shared base props ────────────────────────────────────────────────────────
const noOp = () => {};
const noOpAsync = async () => {};

const BASE_PROPS: CreateAKSProjectPureProps = {
  activeStep: 0,
  steps: STEPS,
  handleNext: noOp,
  handleBack: noOp,
  handleStepClick: noOp,
  handleSubmit: noOpAsync,
  onBack: noOp,
  isCreating: false,
  creationProgress: '',
  creationError: null,
  showSuccessDialog: false,
  applicationName: '',
  setApplicationName: noOp as any,
  cliSuggestions: [],
  validation: { isValid: true },
  azureResourcesLoading: false,
  onNavigateToProject: noOp,
  stepContent: <div>Step content</div>,
  projectName: 'my-project',
  onDismissError: noOp,
  onCancelSuccess: noOp,
  stepContentRef: React.createRef<HTMLDivElement>(),
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Mount a story and start the virtual screen reader on document.body.
 *  MUI Dialogs render into a portal at document.body, so we use document.body
 *  rather than the render() container to include all portal content. */
async function mountAndStart(overrides: Partial<CreateAKSProjectPureProps> = {}) {
  const props = { ...BASE_PROPS, ...overrides };
  render(
    <MemoryRouter>
      <CreateAKSProjectPure {...props} />
    </MemoryRouter>
  );
  // Use document.body so MUI portal content (dialogs) is included
  await virtual.start({ container: document.body });
}

/** Collect all spoken phrases until "end of document" or maxSteps. */
async function collectPhrases(maxSteps = 300): Promise<string[]> {
  const log: string[] = [];
  for (let i = 0; i < maxSteps; i++) {
    const phrase = await virtual.lastSpokenPhrase();
    log.push(phrase);
    if (phrase === 'end of document') break;
    await virtual.next();
  }
  return log;
}

afterEach(async () => {
  await virtual.stop();
  cleanup();
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Screen reader — BasicsStepDefault (breadcrumb navigation)', () => {
  it('announces the breadcrumb as a navigation landmark labelled "Wizard steps"', async () => {
    await mountAndStart();
    const phrases = await collectPhrases();
    // role="navigation" aria-label="Wizard steps" → SR: "navigation, Wizard steps"
    expect(phrases).toContain('navigation, Wizard steps');
  });

  it('announces the active breadcrumb step with aria-current="step"', async () => {
    await mountAndStart();
    const phrases = await collectPhrases();
    // aria-current="step" on the active step → SR appends "current step"
    expect(phrases).toContain('button, Basics, current step');
  });

  it('announces all 5 breadcrumb step buttons', async () => {
    await mountAndStart();
    const phrases = await collectPhrases();
    expect(phrases).toContain('button, Basics, current step');
    expect(phrases).toContain('button, Networking Policies');
    expect(phrases).toContain('button, Compute Quota');
    expect(phrases).toContain('button, Access');
    expect(phrases).toContain('button, Review');
  });

  it('does NOT announce decorative step-number icons as images', async () => {
    await mountAndStart();
    const phrases = await collectPhrases();
    // Icons have aria-hidden="true" → must not appear in the spoken log
    const hasIconAnnouncement = phrases.some(p =>
      /mdi:numeric|numeric-\d-circle/i.test(p)
    );
    expect(hasIconAnnouncement).toBe(false);
  });

  it('announces the Cancel button', async () => {
    await mountAndStart();
    const phrases = await collectPhrases();
    expect(phrases).toContain('button, Cancel');
  });

  it('announces the Next button as enabled', async () => {
    await mountAndStart();
    const phrases = await collectPhrases();
    expect(phrases).toContain('button, Next');
    // Must NOT be announced as disabled
    expect(phrases).not.toContain('button, Next, disabled');
  });
});

describe('Screen reader — LoadingOverlay (aria-busy + progressbar)', () => {
  it('announces the card as busy via aria-busy', async () => {
    await mountAndStart({ isCreating: true, creationProgress: 'Creating namespace...' });
    const phrases = await collectPhrases();
    // aria-busy="true" on the Card → SR announces "busy" as it enters the region
    expect(phrases).toContain('busy');
  });

  it('announces the "Creating Project" progressbar', async () => {
    await mountAndStart({ isCreating: true, creationProgress: 'Creating namespace...' });
    const phrases = await collectPhrases();
    // CircularProgress role="progressbar" aria-label="Creating Project"
    expect(phrases).toContain('progressbar, Creating Project, max value 100, min value 0');
  });

  it('announces the progress status text in the document', async () => {
    await mountAndStart({ isCreating: true, creationProgress: 'Creating namespace...' });
    const phrases = await collectPhrases();
    // aria-live="polite" paragraph — text is present and traversable
    expect(phrases.some(p => /creating namespace/i.test(p))).toBe(true);
  });
});

describe('Screen reader — ErrorOverlay (alertdialog + role=alert)', () => {
  const ERROR_MSG = 'Namespace creation failed: quota exceeded';

  it('announces the error alertdialog with its title', async () => {
    await mountAndStart({ creationError: ERROR_MSG });
    const phrases = await collectPhrases();
    // role="alertdialog" aria-labelledby="...title" aria-describedby="...desc"
    // SR announces: "alertdialog, <label>, <description>"
    expect(phrases.some(p => /alertdialog/i.test(p) && /project creation failed/i.test(p))).toBe(true);
  });

  it('announces the error dialog description alongside its title', async () => {
    await mountAndStart({ creationError: ERROR_MSG });
    const phrases = await collectPhrases();
    // aria-describedby wires the error text as the dialog description
    const dialogPhrase = phrases.find(p => /alertdialog/i.test(p));
    expect(dialogPhrase).toMatch(/quota exceeded|namespace creation failed/i);
  });

  it('announces the error text via the role=alert assertive live region', async () => {
    await mountAndStart({ creationError: ERROR_MSG });
    const phrases = await collectPhrases();
    // role="alert" → SR announces "alert" then the text content
    // This fires even after autoFocus has moved to the Cancel button
    expect(phrases).toContain('alert');
    expect(phrases.some(p => /quota exceeded|namespace creation failed/i.test(p))).toBe(true);
  });

  it('announces the "alert" open and close tokens', async () => {
    await mountAndStart({ creationError: ERROR_MSG });
    const phrases = await collectPhrases();
    expect(phrases).toContain('alert');
    expect(phrases).toContain('end of alert');
  });

  it('announces the Cancel button as enabled', async () => {
    await mountAndStart({ creationError: ERROR_MSG });
    const phrases = await collectPhrases();
    expect(phrases).toContain('button, Cancel');
    expect(phrases).not.toContain('button, Cancel, disabled');
  });
});

describe('Screen reader — SuccessDialog (dialog + role=status)', () => {
  it('announces the success dialog with its title', async () => {
    await mountAndStart({ showSuccessDialog: true });
    const phrases = await collectPhrases();
    // role="dialog" aria-labelledby → SR announces "dialog, <title>"
    expect(phrases.some(p => /dialog/i.test(p) && /project created successfully/i.test(p))).toBe(true);
  });

  it('announces the success description alongside the dialog title', async () => {
    await mountAndStart({ showSuccessDialog: true, projectName: 'my-project' });
    const phrases = await collectPhrases();
    // aria-describedby wires success text as dialog description
    const dialogPhrase = phrases.find(p => /^dialog,/i.test(p));
    expect(dialogPhrase).toMatch(/has been created|ready to use/i);
  });

  it('announces the success message via the role=status polite live region', async () => {
    await mountAndStart({ showSuccessDialog: true, projectName: 'my-project' });
    const phrases = await collectPhrases();
    // role="status" → SR announces "status" then the text content
    expect(phrases).toContain('status');
    expect(phrases.some(p => /has been created|ready to use/i.test(p))).toBe(true);
  });

  it('announces the "status" open and close tokens', async () => {
    await mountAndStart({ showSuccessDialog: true });
    const phrases = await collectPhrases();
    expect(phrases).toContain('status');
    expect(phrases).toContain('end of status');
  });

  it('announces the Application name textbox', async () => {
    await mountAndStart({ showSuccessDialog: true });
    const phrases = await collectPhrases();
    // MUI TextField label="Application name" → "textbox, Application name, ..."
    expect(phrases.some(p => /textbox/i.test(p) && /application name/i.test(p))).toBe(true);
  });

  it('announces Create Application button as disabled when app name is empty', async () => {
    await mountAndStart({ showSuccessDialog: true, applicationName: '' });
    const phrases = await collectPhrases();
    expect(phrases).toContain('button, Create Application, disabled');
  });

  it('announces Create Application button as enabled when app name is provided', async () => {
    await mountAndStart({ showSuccessDialog: true, applicationName: 'my-app' });
    const phrases = await collectPhrases();
    expect(phrases).toContain('button, Create Application');
    expect(phrases).not.toContain('button, Create Application, disabled');
  });
});
