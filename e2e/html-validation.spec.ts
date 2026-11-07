import { expect, test } from "@playwright/test";

// Server-rendered HTML is validated by Nitro's html-validate (@nuxtjs/html-validator)
// inside the dev server started by playwright.config.ts. This spec only requests a
// broad set of routes so the validator sees them; the pipeline fails the E2E job when
// the server log contains "HTML validation errors found" (see pipeline.yml).
const ROUTES = [
  "/",
  "/movies",
  "/series",
  "/voice-actors",
  "/games",
  "/podcasts",
  "/audiobooks",
  "/advertisements",
  "/toys",
  "/studios",
  "/search",
  "/search?q=Richard",
  "/about",
  "/terms",
  "/terms-api",
  "/privacy",
  "/legal",
  "/guidelines",
  "/leaderboard",
  "/discussions",
  "/login",
  "/register",
  "/movie/85",
  "/show/1396",
  "/show/1396/season/1",
  "/show/1396/season/1/episode/1",
  "/voice-actor/1",
  "/actor/3",
  "/studio/10",
  "/podcast/101",
  "/fr",
  "/fr/movies",
  "/fr/movie/85",
  "/fr/voice-actor/1",
  "/ja",
  "/es/series",
];

test.describe("server-rendered HTML", () => {
  // The dev server answers 503 while Nuxt is still compiling on a cold start.
  test.beforeAll(async ({ request }) => {
    await expect
      .poll(async () => (await request.get("/")).status(), { timeout: 120_000 })
      .toBeLessThan(500);
  });

  for (const route of ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBeLessThan(500);
    });
  }
});
