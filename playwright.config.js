import { defineConfig } from '@playwright/test';

const e2ePort = Number(process.env.PLAYWRIGHT_PORT || 4173);
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

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
    baseURL: e2eOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'node tools/serve-e2e.mjs',
    url: `${e2eOrigin}/autre-nom/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: process.env.PLAYWRIGHT_ALL ? browserProjects : browserProjects.slice(0, 1),
});
