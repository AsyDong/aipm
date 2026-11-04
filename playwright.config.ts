import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH }
          : {},
      },
    },
    {
      name: 'ipad-webkit',
      use: {
        ...devices['iPad (gen 7)'],
        launchOptions: process.env.WEBKIT_EXECUTABLE_PATH
          ? { executablePath: process.env.WEBKIT_EXECUTABLE_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command:
      'pnpm --filter @english/web dev --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
  },
});
