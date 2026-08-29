import { test, expect } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

test.describe("Global Search & Quick Search Modal", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));
    await setupMockApi(page);
  });

  test("opens search modal and searches for media and voice actors", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/movie/85");
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible({ timeout: 15000 });

    // Wait until SearchModal is mounted
    await page.waitForFunction(
      () => typeof (window as any).__openSearchModal === "function",
      { timeout: 15000 },
    );
    await page.evaluate(() => (window as any).__openSearchModal());

    const modalInput = page.locator("[data-testid='search-modal-input']");
    await expect(modalInput).toBeVisible({ timeout: 10000 });

    // Type search query
    await modalInput.fill("Richard");
    await page.waitForTimeout(600);

    // Verify search results display voice actor
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });

  test("navigates to voice actor page when selecting a search result", async ({
    page,
  }) => {
    await page.goto("/movie/85");
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible({ timeout: 15000 });

    // Wait until SearchModal is mounted
    await page.waitForFunction(
      () => typeof (window as any).__openSearchModal === "function",
      { timeout: 15000 },
    );
    await page.evaluate(() => (window as any).__openSearchModal());

    const modalInput = page.locator("[data-testid='search-modal-input']");
    await expect(modalInput).toBeVisible({ timeout: 10000 });

    await modalInput.fill("Richard");
    await page.waitForTimeout(600);

    const resultItem = page
      .locator("button")
      .filter({ hasText: "Richard Darbois" })
      .first();
    await expect(resultItem).toBeVisible({ timeout: 5000 });
    await resultItem.click();

    await page.waitForURL(/\/voice-actor\/1/, { timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
