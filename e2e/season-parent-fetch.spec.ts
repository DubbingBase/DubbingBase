import { expect, test, type Page } from "@playwright/test";
import { MOCK_EPISODE, MOCK_SEASON } from "./fixtures/mock-data";
import { setupMockApi, waitForVueHydration } from "./helpers/mock-api";

declare global {
  interface HTMLElement {
    __vue_app__?: {
      config: {
        globalProperties: {
          $router?: { push: (path: string) => Promise<unknown> };
        };
      };
    };
  }
}

async function navigateClientSide(page: Page, path: string) {
  await page.waitForFunction(() =>
    Boolean(document.getElementById("__nuxt")?.__vue_app__?.config.globalProperties.$router),
  );
  await page.evaluate(async (nextPath) => {
    const router = document.getElementById("__nuxt")?.__vue_app__?.config.globalProperties.$router;
    if (!router) throw new Error("Nuxt router is not available after hydration");
    await router.push(nextPath);
  }, path);
}

test("skips hidden season data on episode routes and loads it when returning", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const api = await setupMockApi(page);
  const seasonRequests: Array<{ id: string | null; season: string | null; locale: string }> = [];
  let episodeRequests = 0;

  await page.route("**/api/season?**", async (route) => {
    const url = new URL(route.request().url());
    const id = url.searchParams.get("id");
    const season = url.searchParams.get("season_number");
    const locale = route.request().headers()["accept-language"] || "";
    seasonRequests.push({ id, season, locale });

    const response = structuredClone(MOCK_SEASON);
    response.season.overview = `Season data ${id}/${season}/${locale}`;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  await page.route("**/api/episode?**", async (route) => {
    episodeRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_EPISODE),
    });
  });

  await request.delete("/api/e2e/media-requests");

  const response = await page.goto("/show/1396/season/1/episode/1", {
    waitUntil: "domcontentloaded",
  });
  if (!response) throw new Error("Episode navigation returned no response");
  const html = await response.text();
  expect(html).toContain(MOCK_EPISODE.episode.overview);
  expect(html).not.toContain(MOCK_SEASON.season.overview);
  await waitForVueHydration(page);
  expect(seasonRequests).toHaveLength(0);
  const episodeSsrRequests = await request.get("/api/e2e/media-requests");
  expect(await episodeSsrRequests.text()).toBe(JSON.stringify(["/api/episode"]));

  await navigateClientSide(page, "/show/1396/season/1");
  await expect.poll(() => seasonRequests.length).toBe(1);
  const firstSeasonRequest = seasonRequests[0];
  if (!firstSeasonRequest) throw new Error("Season request was not recorded");
  await expect(page.getByText(`Season data 1396/1/${firstSeasonRequest.locale}`)).toBeVisible();

  const initialEpisodeRequests = episodeRequests;
  await navigateClientSide(page, "/show/1396/season/1/episode/1");
  await expect.poll(() => episodeRequests).toBeGreaterThan(initialEpisodeRequests);
  const firstEpisodeRequests = episodeRequests;
  await navigateClientSide(page, "/fr/show/108978/season/2/episode/2");
  await expect.poll(() => episodeRequests).toBeGreaterThan(firstEpisodeRequests);
  expect(seasonRequests).toHaveLength(1);

  await navigateClientSide(page, "/fr/show/108978/season/2");
  await expect.poll(() => seasonRequests.length).toBe(2);
  const frenchSeasonRequest = seasonRequests[1];
  if (!frenchSeasonRequest) throw new Error("French season request was not recorded");
  expect(frenchSeasonRequest).toEqual({ id: "108978", season: "2", locale: "fr" });
  await expect(page.getByText(`Season data 108978/2/${frenchSeasonRequest.locale}`)).toBeVisible();

  const seasonResponse = await page.goto("/show/1396/season/1", {
    waitUntil: "domcontentloaded",
  });
  if (!seasonResponse) throw new Error("Season navigation returned no response");
  expect(await seasonResponse.text()).toContain(MOCK_SEASON.season.overview);
  const seasonSsrRequests = await request.get("/api/e2e/media-requests");
  expect(await seasonSsrRequests.text()).toBe(JSON.stringify(["/api/episode", "/api/season"]));
  api.expectNoErrors();
});
