import { test, expect } from "@playwright/test";
import { setupMockApi } from "./helpers/mock-api";

test.describe("Home Page & Global Navigation", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupMockApi(page);
  });

  test("loads home page with trending carousels and top voice actors", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Verify main body is rendered
    await expect(page.locator("body")).toBeVisible();

    // Verify trending sections / voice actors
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });

  test("theme toggle switches theme classes", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Locate theme toggle button (moon / sun icon button)
    const themeButton = page
      .locator(
        "button[aria-label*='theme' i], button[aria-label*='mode' i], button:has(svg.lucide-sun), button:has(svg.lucide-moon)",
      )
      .first();
    if (await themeButton.isVisible()) {
      const htmlEl = page.locator("html");
      const initialClass = await htmlEl.getAttribute("class");

      await themeButton.click();
      await page.waitForTimeout(300);

      const newClass = await htmlEl.getAttribute("class");
      // The class or color-scheme should toggle
      expect(newClass).not.toBe(initialClass);
    }
  });

  test("language switcher updates application language and renders translations", async ({
    page,
  }) => {
    // Start on the root URL (English default)
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    // Verify English translations are loaded — footer should say "Movies" not "footer.movies"
    const footerMovies = page.locator("footer").locator("text=Movies").first();
    await expect(footerMovies).toBeVisible({ timeout: 5000 });
    // Also verify the raw key is NOT showing (the bug symptom)
    await expect(page.locator("footer")).not.toContainText("footer.movies");

    // Open the language switcher
    const langTrigger = page
      .locator("button[aria-label*='language' i]")
      .first();
    await expect(langTrigger).toBeVisible({ timeout: 5000 });
    await langTrigger.click();
    await page.waitForTimeout(500);

    // Switch to French — the SelectContent renders as a fixed-position overlay
    const frOption = page.getByText("Français").first();
    await frOption.click();
    await page.waitForURL(/\/fr\//, { timeout: 10000 });

    // Verify French translations are loaded — footer should say "Films"
    const footerFilms = page.locator("footer").locator("text=Films").first();
    await expect(footerFilms).toBeVisible({ timeout: 5000 });
    // Also verify the raw key is NOT showing (the bug symptom)
    await expect(page.locator("footer")).not.toContainText("footer.movies");
    // And that English didn't bleed through
    await expect(page.locator("footer")).not.toContainText("Movies");
  });
});
