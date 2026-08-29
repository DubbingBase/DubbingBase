import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "website",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3050",
      },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        baseURL: "http://localhost:1420",
      },
      testMatch: /mobile\.spec\.ts/,
    },
  ],

  webServer: [
    {
      command:
        "E2E_TEST=true PORT=3050 pnpm --filter=@app/website dev --port 3050",
      port: 3050,
      env: {
        E2E_TEST: "true",
        PORT: "3050",
        NUXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
        NUXT_PUBLIC_SUPABASE_KEY: "mock-anon-key",
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_KEY: "mock-anon-key",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
