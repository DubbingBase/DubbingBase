import { test, expect, type Page } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

const openHomepage = async (page: Page, searchPath = "/search") => {
  await page.goto(searchPath, { waitUntil: "commit" });
  await expect(page.getByTestId("search-input")).toBeVisible({
    timeout: 15000,
  });
  await page.locator("header a").first().click();
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
    await page.waitForTimeout(15000);

    await page.getByTestId("header-search-trigger").click();
    await page.waitForURL(/\/search(?:\?|$)/, { timeout: 5000 });
    await page.reload({ waitUntil: "networkidle" });

    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toBeFocused();

    await searchInput.fill("Richard");
    await expect(page).toHaveURL(/\/search\?q=Richard/, { timeout: 5000 });
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
    await homeSearchInput.press("Enter");

    await page.waitForURL(/\/search\?q=Richard$/, { timeout: 10000 });
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toHaveValue("Richard");
    await expect(searchInput).toBeFocused();
    await expect(
      page.getByRole("button", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("submits the homepage search from its button", async ({ page }) => {
    await setupMockApi(page);
    await openHomepage(page);

    await page.getByTestId("home-search-input").fill("Richard");
    await page.getByTestId("home-search-submit").click();

    await page.waitForURL(/\/search\?q=Richard$/, { timeout: 10000 });
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
    await openHomepage(page, "/fr/search");

    await page.getByTestId("home-search-input").fill("Richard");
    await page.getByTestId("home-search-submit").click();

    await page.waitForURL(/\/fr\/search\?q=Richard$/, { timeout: 10000 });
    await expect(page.getByTestId("search-input")).toHaveValue("Richard");
  });

  test("navigates from keyboard shortcuts and focuses the input", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/movie/85");
    await page.waitForTimeout(15000);
    await page.reload({ waitUntil: "networkidle" });
    await page.keyboard.press("/");
    await page.waitForURL(/\/search(?:\?|$)/, { timeout: 5000 });
    await expect(page.getByTestId("search-input")).toBeFocused();

    await page.goto("/movie/85");
    await page.keyboard.press("Control+k");
    await page.waitForURL(/\/search(?:\?|$)/, { timeout: 5000 });
    await expect(page.getByTestId("search-input")).toBeFocused();
  });

  test("navigates to a voice actor page when selecting a result", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/search?q=Richard");

    const resultItem = page.getByRole("button", {
      name: "Richard Darbois",
    });
    await expect(resultItem).toBeVisible({ timeout: 10000 });
    await resultItem.click();

    await page.waitForURL(/\/voice-actor\/1/, { timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
