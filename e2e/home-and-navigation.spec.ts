import { test, expect } from "@playwright/test";
import { setupMockApi, waitForVueHydration } from "./helpers/mock-api";

test.describe("Home Page & Global Navigation", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupMockApi(page);
  });

  test("loads home page with trending carousels and top voice actors", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    // Verify main body is rendered
    await expect(page.locator("body")).toBeVisible();

    // Verify trending sections / voice actors
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });

  test("theme selector applies the selected theme", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    await page.context().addCookies([
      {
        name: "dubbingbase-theme",
        value: "light",
        url: "http://localhost:3050",
      },
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.locator('button[aria-label="Toggle theme"]').click();
    await page.getByRole("option", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("keeps preference controls visible and cancels a delayed selector open", async ({
    page,
  }) => {
    let releaseImport = (): void => {};
    const importGate = new Promise<void>((resolve) => {
      releaseImport = resolve;
    });
    await page.route("**/HeaderPreferenceSelects.vue*", async (route) => {
      await importGate;
      await route.continue();
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    const themeTrigger = page.locator('button[aria-label="Toggle theme"]');
    const importRequest = page.waitForRequest((request) =>
      request.url().includes("HeaderPreferenceSelects.vue"),
    );
    const importResponse = page.waitForResponse((response) =>
      response.url().includes("HeaderPreferenceSelects.vue"),
    );

    await themeTrigger.click();
    await importRequest;
    await expect(themeTrigger).toBeVisible();

    await page.keyboard.press("Escape");
    releaseImport();
    await importResponse;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );

    await expect(themeTrigger).toBeVisible();
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("keeps preference controls available when the selector import fails", async ({ page }) => {
    await page.route("**/HeaderPreferenceSelects.vue*", (route) => route.abort());

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    const themeTrigger = page.locator('button[aria-label="Toggle theme"]');
    const languageTrigger = page.locator('button[aria-label="Toggle language"]');
    const failedImport = page.waitForEvent("requestfailed", (request) =>
      request.url().includes("HeaderPreferenceSelects.vue"),
    );

    await themeTrigger.click();
    await failedImport;

    await expect(themeTrigger).toBeVisible();
    await expect(languageTrigger).toBeVisible();
  });

  test("language switcher updates application language and renders translations", async ({
    page,
  }) => {
    // Start on the root URL (English default)
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    // Verify English translations are loaded — footer should say "Movies" not "footer.movies"
    const footerMovies = page.locator("footer").locator("text=Movies").first();
    await expect(footerMovies).toBeVisible({ timeout: 5000 });
    // Also verify the raw key is NOT showing (the bug symptom)
    await expect(page.locator("footer")).not.toContainText("footer.movies");

    // Open the language switcher
    const langTrigger = page.locator("button[aria-label*='language' i]").first();
    await expect(langTrigger).toBeVisible({ timeout: 5000 });
    await langTrigger.click();

    // Switch to French — the SelectContent renders as a fixed-position overlay
    const frOption = page.getByText("Français").first();
    await Promise.all([page.waitForURL(/\/fr\/?/, { timeout: 10000 }), frOption.click()]);
    await waitForVueHydration(page);

    // Verify French translations are loaded — footer should say "Films"
    const footerFilms = page.locator("footer").locator("text=Films").first();
    await expect(footerFilms).toBeVisible({ timeout: 5000 });
    // Also verify the raw key is NOT showing (the bug symptom)
    await expect(page.locator("footer")).not.toContainText("footer.movies");
    // And that English didn't bleed through
    await expect(page.locator("footer")).not.toContainText("Movies");
  });
});
