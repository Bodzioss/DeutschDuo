import { defineConfig, devices } from '@playwright/test';

const mobile = { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: false };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:4173', ...mobile },
  projects: [
    { name: 'chromium-375', use: { ...devices['Desktop Chrome'], ...mobile } },
    { name: 'webkit-375', use: { ...devices['Desktop Safari'], ...mobile } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 240_000,
    env: { VITE_BACKEND: 'fake' },
  },
});
