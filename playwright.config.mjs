import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
  ],
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    bypassCSP: false,
    trace: 'off',
  },
  projects: [
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
      },
    },
    {
      name: 'msedge',
      use: {
        channel: 'msedge',
      },
    },
  ],
});
