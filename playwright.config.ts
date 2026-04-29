/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Timeout per test
  timeout: 30_000,
  // Timeout for expect assertions
  expect: { timeout: 8_000 },
  // Run tests in files in parallel
  fullyParallel: true,
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/playwright/html-report', open: 'never' }],
  ],

  use: {
    // Base URL for all tests — matches the Vite preview server
    baseURL: 'http://localhost:4000',
    // Collect traces on the first retry
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run `vite preview` before the tests start (uses pre-built dist/)
  webServer: {
    command: 'npm run preview -- --host localhost --port 4000',
    url: 'http://localhost:4000',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
