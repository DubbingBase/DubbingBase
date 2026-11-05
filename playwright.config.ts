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
    },
  ],

  webServer: [
    {
      command: "E2E_TEST=true PORT=3050 pnpm --filter=@app/website dev --port 3050",
      // A URL (not a port) so tests wait until Nuxt finishes compiling; the dev
      // server answers 503 while it builds.
      url: "http://localhost:3050/",
      // Piped so CI can fail on Nitro html-validate errors in the server log.
      stdout: "pipe",
      env: {
        E2E_TEST: "true",
        PORT: "3050",
        NUXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
        NUXT_PUBLIC_SUPABASE_KEY: "mock-publishable-key",
        SUPABASE_URL: "https://mock.supabase.co",
        SUPABASE_PUBLISHABLE_KEY: "mock-publishable-key",
        SUPABASE_SECRET_KEY: "mock-secret-key",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
