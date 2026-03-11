// Copyright (c) Microsoft Corporation.
// Licensed under the Apache 2.0.

/**
 * Playwright configuration for end-to-end screen reader tests.
 *
 * These tests drive a real screen reader (NVDA on Windows, VoiceOver on macOS)
 * via {@link https://www.guidepup.dev/ @guidepup/guidepup} against Storybook
 * stories served locally.
 *
 * Environment variables:
 *   SCREEN_READER   — `nvda` | `voiceover` (default: `voiceover`)
 *   STORYBOOK_URL   — base URL for Storybook (default: `http://localhost:6007`)
 *   CI              — when truthy, serves pre-built storybook-static/ on
 *                     port 6007 instead of starting the dev server
 *
 * Run:
 *   npm run test:sr                          # VoiceOver (macOS default)
 *   SCREEN_READER=nvda npm run test:sr       # NVDA (Windows)
 *   SCREEN_READER=voiceover npm run test:sr  # VoiceOver (macOS)
 */

import { defineConfig, devices } from '@playwright/test';
import { screenReaderConfig } from '@guidepup/playwright';

const STORYBOOK_PORT = 6007;
const STORYBOOK_URL =
  process.env.STORYBOOK_URL ?? `http://localhost:${STORYBOOK_PORT}`;

export default defineConfig({
  ...screenReaderConfig,
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 120_000,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: STORYBOOK_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'screen-reader',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: `npx http-server storybook-static -p ${STORYBOOK_PORT} -c-1 --silent`,
        port: STORYBOOK_PORT,
        reuseExistingServer: true,
        timeout: 30_000,
      }
    : {
        command: 'npm run storybook',
        port: STORYBOOK_PORT,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
