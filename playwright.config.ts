import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:4317' },
  webServer: {
    command: 'node tests/serve.mjs',
    url: 'http://127.0.0.1:4317/game.html',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1100, height: 760 } } },
  ],
});
