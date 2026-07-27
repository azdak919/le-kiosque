import { defineConfig } from '@playwright/test';

const browserProjects = [
  { name: 'chromium', use: { browserName: 'chromium' } },
  { name: 'firefox', use: { browserName: 'firefox' } },
  { name: 'webkit', use: { browserName: 'webkit' } },
];

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'node tools/serve-e2e.mjs',
    url: 'http://127.0.0.1:4173/autre-nom/',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: process.env.PLAYWRIGHT_ALL ? browserProjects : browserProjects.slice(0, 1),
});
