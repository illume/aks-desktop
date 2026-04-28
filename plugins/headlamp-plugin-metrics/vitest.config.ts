/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'jsdom',
          setupFiles: 'node_modules/@kinvolk/headlamp-plugin/config/setupTests.js',
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
});
