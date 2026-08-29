import { test, expect } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

test.describe("Original Actor Profile & Localized Voices", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("renders Actor details and voice actors by language", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/actor/3", { waitUntil: "domcontentloaded" });

    // Verify actor name and biography
    await expect(
      page.getByRole("heading", { name: "Harrison Ford" }),
    ).toBeVisible({ timeout: 15000 });
    await expect(page.locator("body")).toContainText("Harrison Ford");

    // Verify localized voice actor is displayed
    await expect(page.locator("body")).toContainText("Richard Darbois", {
      timeout: 10000,
    });

    // Verify filmography credits section
    await expect(page.locator("body")).toContainText(
      "Raiders of the Lost Ark",
      { timeout: 10000 },
    );

    api.expectNoErrors();
  });

  test("navigates to voice actor page from actor voice card", async ({
    page,
  }) => {
    await page.goto("/actor/3", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Harrison Ford" }),
    ).toBeVisible({ timeout: 10000 });

    const vaCard = page.locator("a[href*='/voice-actor/1']").first();
    await expect(vaCard).toBeVisible({ timeout: 5000 });
    await vaCard.click();

    await page.waitForURL(/\/voice-actor\/1/, { timeout: 5000 });
    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
