import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        baseURL: "http://localhost:1420",
      },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: "website",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:3000",
      },
      testMatch: /website\.spec\.ts/,
    },
  ],

  webServer: [
    {
      command:
        "mise exec -- pnpm --filter=@app/mobile run build && mise exec -- pnpm --filter=@app/mobile run preview --port 1420 --strictPort",
      port: 1420,
      reuseExistingServer: !process.env.CI,
      timeout: 300000,
    },
    {
      command:
        "mise exec -- pnpm --filter=@app/website run build && PORT=3000 mise exec -- pnpm --filter=@app/website run preview",
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});
