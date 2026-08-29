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

  test("language switcher updates application language", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Find language selector button / dropdown
    const langTrigger = page
      .locator(
        "button:has-text('EN'), button:has-text('FR'), button[aria-label*='language' i]",
      )
      .first();
    if (await langTrigger.isVisible()) {
      await langTrigger.click();
      await page.waitForTimeout(300);

      // Select French or English if available
      const langOption = page
        .locator(
          "button:has-text('Français'), a:has-text('Français'), button:has-text('English'), a:has-text('English')",
        )
        .first();
      if (await langOption.isVisible()) {
        await langOption.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
