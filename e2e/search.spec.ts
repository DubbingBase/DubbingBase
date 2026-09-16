import { test, expect } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

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

  test("opens from the homepage hero", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/");
    await page.getByTestId("home-search-trigger").click();
    await page.waitForURL(/\/search(?:\?|$)/, { timeout: 5000 });
    await expect(page.getByTestId("search-input")).toBeVisible();
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
