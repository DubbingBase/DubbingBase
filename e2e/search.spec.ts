import { test, expect, type Page } from "@playwright/test";
import { setupMockApi, waitForVueHydration } from "./helpers/mock-api";

const openHomepage = async (page: Page, searchPath = "/search") => {
  await page.goto(searchPath, { waitUntil: "commit" });
  await waitForVueHydration(page);
  await expect(page.getByTestId("search-input")).toBeVisible({
    timeout: 15000,
  });
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/" || url.pathname === "/fr"),
    page.locator("header a").first().click(),
  ]);
  await waitForVueHydration(page);
  await expect(page.getByTestId("home-search-input")).toBeVisible({
    timeout: 15000,
  });
};

test.describe("Global Search Page", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120000);
  });

  test("opens from the header and searches for mixed results", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/movie/85");
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible({ timeout: 15000 });

    await waitForVueHydration(page);
    await Promise.all([
      page.waitForURL(/\/search(?:\?|$)/, { timeout: 5000 }),
      page.getByTestId("header-search-trigger").click(),
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    const searchUrl = page.waitForURL(/\/search\?q=Richard/, {
      timeout: 5000,
    });
    await searchInput.fill("Richard");
    await searchUrl;
    await expect(
      page.getByRole("button", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 5000 });

    api.expectNoErrors();
  });

  test("submits the homepage search on Enter and shows results", async ({
    page,
  }) => {
    await setupMockApi(page);
    await openHomepage(page);

    const homeSearchInput = page.getByTestId("home-search-input");
    await homeSearchInput.fill("  Richard  ");
    const submitButton = page.getByTestId("home-search-submit");
    await expect(submitButton).toBeEnabled();
    await Promise.all([
      page.waitForURL(/\/search\?q=Richard$/, { timeout: 10000 }),
      homeSearchInput.press("Enter"),
    ]);

    await waitForVueHydration(page);
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toHaveValue("Richard");
    await expect(
      page.getByRole("button", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("submits the homepage search from its button", async ({ page }) => {
    await setupMockApi(page);
    await openHomepage(page);

    await page.getByTestId("home-search-input").fill("Richard");
    const submitButton = page.getByTestId("home-search-submit");
    await expect(submitButton).toBeEnabled();
    await Promise.all([
      page.waitForURL(/\/search\?q=Richard$/, { timeout: 10000 }),
      submitButton.click(),
    ]);
    await waitForVueHydration(page);
    await expect(page.getByTestId("search-input")).toHaveValue("Richard");
  });

  test("keeps invalid homepage queries on the homepage", async ({ page }) => {
    await setupMockApi(page);
    await openHomepage(page);
    const homepageUrl = page.url();

    const homeSearchInput = page.getByTestId("home-search-input");
    const submitButton = page.getByTestId("home-search-submit");

    await expect(submitButton).toBeDisabled();
    await homeSearchInput.fill("A");
    await expect(submitButton).toBeDisabled();
    await homeSearchInput.press("Enter");
    await expect(page).toHaveURL(homepageUrl);

    await homeSearchInput.fill("   ");
    await expect(submitButton).toBeDisabled();
    await homeSearchInput.press("Enter");
    await expect(page).toHaveURL(homepageUrl);
  });

  test("preserves the selected locale when submitting homepage search", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.context().addCookies([
      {
        name: "user_lang",
        value: "fr",
        url: "http://localhost:3050",
      },
    ]);
    await openHomepage(page, "/fr/search");

    await page.getByTestId("home-search-input").fill("Richard");
    const submitButton = page.getByTestId("home-search-submit");
    await expect(submitButton).toBeEnabled();
    await Promise.all([
      page.waitForURL(/\/fr\/search\?q=Richard$/, { timeout: 10000 }),
      submitButton.click(),
    ]);
    await waitForVueHydration(page);
    await expect(page.getByTestId("search-input")).toHaveValue("Richard");
  });

  test("navigates from keyboard shortcuts and focuses the input", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/movie/85");
    await waitForVueHydration(page);
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible({ timeout: 15000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible({ timeout: 15000 });
    await Promise.all([
      page.waitForURL(/\/search(?:\?|$)/, { timeout: 5000 }),
      page.keyboard.press("/"),
    ]);
    await waitForVueHydration(page);
    await expect(page.getByTestId("search-input")).toBeFocused();

    await page.goto("/movie/85");
    await waitForVueHydration(page);
    await Promise.all([
      page.waitForURL(/\/search(?:\?|$)/, { timeout: 5000 }),
      page.keyboard.press("Control+k"),
    ]);
    await waitForVueHydration(page);
    await expect(page.getByTestId("search-input")).toBeFocused();
  });

  test("does not select stale results while a new search is loading", async ({
    page,
  }) => {
    await setupMockApi(page);

    const previousResults = [
      {
        id: 1,
        firstname: "Richard",
        lastname: "Darbois",
        voice_actor_name: "Richard Darbois",
        media_type: "voice_actor",
      },
      {
        id: 85,
        title: "Raiders of the Lost Ark",
        media_type: "movie",
      },
    ];
    let releasePendingSearch: () => void = () => {};
    const pendingSearch = new Promise<void>((resolve) => {
      releasePendingSearch = resolve;
    });

    await page.route("**/api/search**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("query") !== "Al") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(previousResults),
        });
      }

      await pendingSearch;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: 501,
            title: "Alpine",
            media_type: "movie",
          },
        ]),
      });
    });

    await page.goto("/search?q=Richard");
    await waitForVueHydration(page);
    await expect(
      page.getByRole("button", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });

    const searchInput = page.getByTestId("search-input");
    const newSearchRequest = page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/search" && url.searchParams.get("query") === "Al"
      );
    });

    await searchInput.fill("Al");
    try {
      await newSearchRequest;
      await expect(page.getByRole("status")).toContainText("Searching");
      await searchInput.press("ArrowDown");
      await searchInput.press("Enter");
      await expect(page).toHaveURL(/\/search\?q=Al$/);
    } finally {
      releasePendingSearch();
    }

    await expect(page.getByRole("button", { name: "Alpine" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("navigates to a voice actor page when selecting a result", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/search?q=Richard");
    await waitForVueHydration(page);

    const resultItem = page.getByRole("button", {
      name: "Richard Darbois",
    });
    await expect(resultItem).toBeVisible({ timeout: 10000 });
    await Promise.all([
      page.waitForURL(/\/voice-actor\/1/, { timeout: 5000 }),
      resultItem.click(),
    ]);
    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
