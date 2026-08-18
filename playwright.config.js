import { defineConfig } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
const origin = `http://127.0.0.1:${port}`;

const browserProjects = [
  { name: 'chromium', use: { browserName: 'chromium' } },
  { name: 'firefox', use: { browserName: 'firefox' } },
  { name: 'webkit', use: { browserName: 'webkit' } },
];

export default defineConfig({
  testDir: './tests/navigateur',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // CI : retries anti-flaky (contention runner) ; local = 0 pour feedback net.
  retries: process.env.CI ? 2 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'line',
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
  },
  webServer: {
    command: 'node tools/serve-navigateur.mjs',
    url: `${origin}/autre-nom/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: process.env.PLAYWRIGHT_ALL ? browserProjects : browserProjects.slice(0, 1),
});
