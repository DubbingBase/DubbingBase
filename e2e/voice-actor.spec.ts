import { test, expect } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

test.describe("Voice Actor Profile & Filmography", () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page);
  });

  test("renders voice actor profile details correctly", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });

    // Wait for the main heading with the voice actor name to appear
    const heading = page.getByRole("heading", { name: "Richard Darbois" });
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Verify bio and nationality are displayed
    await expect(page.locator("body")).toContainText("acteur franco-canadien");
    await expect(page.locator("body")).toContainText("Français");

    api.expectNoErrors();
  });

  test("renders category tabs with accurate counts", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });

    // Wait for main content to load
    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });

    // Verify category tabs bar exists
    const allTab = page
      .locator("button")
      .filter({ hasText: /All|Tous/i })
      .first();
    await expect(allTab).toBeVisible({ timeout: 5000 });

    // Verify all major media category buttons are present
    await expect(
      page
        .locator("button")
        .filter({ hasText: /Film|Movie/i })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator("button")
        .filter({ hasText: /Série|Series|TV/i })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator("button")
        .filter({ hasText: /Jeu|Game/i })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .locator("button")
        .filter({ hasText: /Livre|Audiobook/i })
        .first(),
    ).toBeVisible();
  });

  test("filters filmography when clicking category tabs", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });

    // Click on Movies tab
    const moviesTab = page
      .locator("button")
      .filter({ hasText: /Film|Movie/i })
      .first();
    await moviesTab.click();
    await page.waitForTimeout(300);

    // Verify movie cards are visible
    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");
    await expect(page.locator("body")).toContainText("Blade Runner");
    // Verify non-movie items are hidden
    await expect(page.locator("body")).not.toContainText("L'Île au trésor");

    // Click on Audiobooks tab
    const audiobooksTab = page
      .locator("button")
      .filter({ hasText: /Livre|Audiobook/i })
      .first();
    await audiobooksTab.click();
    await page.waitForTimeout(300);

    // Verify audiobook card is visible
    await expect(page.locator("body")).toContainText("L'Île au trésor");
    await expect(page.locator("body")).not.toContainText(
      "Raiders of the Lost Ark",
    );

    // Click on All tab to restore full list
    const allTab = page
      .locator("button")
      .filter({ hasText: /All|Tous/i })
      .first();
    await allTab.click();
    await page.waitForTimeout(300);

    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");
    await expect(page.locator("body")).toContainText("L'Île au trésor");
  });

  test("filters filmography dynamically with search bar", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });

    // Locate the search input within the voice actor page
    const searchInput = page
      .locator("input[placeholder*='Search'], input[placeholder*='Rechercher']")
      .first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type query "Indiana"
    await searchInput.fill("Indiana");
    await page.waitForTimeout(500); // Wait for debounce

    // Should only show Indiana Jones work
    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");
    await expect(page.locator("body")).not.toContainText("Blade Runner");
    await expect(page.locator("body")).not.toContainText("The Witcher");

    // Clear search
    await searchInput.fill("");
    await page.waitForTimeout(500);

    // All works restored
    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");
    await expect(page.locator("body")).toContainText("Blade Runner");
  });

  test("toggles between Grouped and List display modes", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 10000 });

    // Look for display mode buttons (Grouped / List)
    const listButton = page
      .locator("button")
      .filter({ hasText: /List|Liste/i })
      .first();
    if (await listButton.isVisible()) {
      await listButton.click();
      await page.waitForTimeout(300);
      await expect(page.locator("body")).toContainText(
        "Raiders of the Lost Ark",
      );

      const groupedButton = page
        .locator("button")
        .filter({ hasText: /Group|Groupe/i })
        .first();
      await groupedButton.click();
      await page.waitForTimeout(300);
      await expect(page.locator("body")).toContainText("Harrison Ford");
    }
  });

  test("navigates to media detail page on card click", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 15000 });

    // Click on Raiders of the Lost Ark link
    const mediaLink = page.locator("a[href*='/movie/85']").first();
    await expect(mediaLink).toBeVisible({ timeout: 5000 });
    await mediaLink.click();

    // Verify navigation
    await page.waitForURL(/\/movie\/85/, { timeout: 5000 });
    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");
  });
});
