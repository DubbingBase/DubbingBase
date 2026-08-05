import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        baseURL: 'http://localhost:5173',
      },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: 'website',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3000',
      },
      testMatch: /website\.spec\.ts/,
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter=@app/mobile run build && pnpm --filter=@app/mobile run preview -- --port 5173 --strictPort',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
    },
    {
      command: 'pnpm --filter=@app/website run build && pnpm --filter=@app/website run preview -- -p 3000',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
