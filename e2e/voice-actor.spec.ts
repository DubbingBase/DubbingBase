import { test, expect, type Page } from "@playwright/test";
import { setupMockApi, waitForVueHydration } from "./helpers/mock-api";

test.describe("Voice Actor Profile & Filmography", () => {
  const getFilmography = (page: Page) =>
    page
      .getByRole("heading", { name: /Filmography|Filmographie/i })
      .locator("xpath=ancestor::section[1]");

  const waitForCollectionRequest = (
    page: Page,
    parameter: "category" | "query",
    value: string,
  ) =>
    page.waitForRequest((request) => {
      const url = new URL(request.url());
      return (
        url.pathname === "/api/detail-collections" &&
        url.searchParams.get(parameter) === value
      );
    });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupMockApi(page);
  });

  test("renders voice actor profile details correctly", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    // Wait for the main heading with the voice actor name to appear
    const heading = page.getByRole("heading", { name: "Richard Darbois" });
    await expect(heading).toBeVisible({ timeout: 20000 });

    // Verify bio and nationality are displayed
    await expect(page.locator("body")).toContainText("acteur franco-canadien");
    await expect(page.locator("body")).toContainText("Français");

    api.expectNoErrors();
  });

  test("renders category tabs with accurate counts", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    // Wait for main content to load
    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 20000 });

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
    await waitForVueHydration(page);

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 20000 });

    const filmography = getFilmography(page);
    // Click on Movies tab
    const moviesTab = filmography.getByRole("button", {
      name: /Film|Movie/i,
    });
    await Promise.all([
      waitForCollectionRequest(page, "category", "movie"),
      moviesTab.click(),
    ]);
    await expect(moviesTab).toHaveClass(/theme-selected/);

    await expect(filmography.locator("a[href*='/movie/85']")).toBeVisible();
    await expect(filmography.locator("a[href*='/movie/78']")).toBeVisible();
    await expect(filmography.locator("a[href*='/audiobook/401']")).toHaveCount(
      0,
    );

    // Click on Audiobooks tab
    const audiobooksTab = filmography.getByRole("button", {
      name: /Livre|Audiobook/i,
    });
    await Promise.all([
      waitForCollectionRequest(page, "category", "audiobook"),
      audiobooksTab.click(),
    ]);
    await expect(audiobooksTab).toHaveClass(/theme-selected/);

    await expect(
      filmography.locator("a[href*='/audiobook/401']"),
    ).toBeVisible();
    await expect(filmography.locator("a[href*='/movie/85']")).toHaveCount(0);

    // Click on All tab to restore full list
    const allTab = filmography.getByRole("button", { name: /All|Tous/i });
    await Promise.all([
      waitForCollectionRequest(page, "category", "all"),
      allTab.click(),
    ]);
    await expect(allTab).toHaveClass(/theme-selected/);

    await expect(filmography.locator("a[href*='/movie/85']")).toBeVisible();
    await expect(
      filmography.locator("a[href*='/audiobook/401']"),
    ).toBeVisible();
  });

  test("filters filmography dynamically with search bar", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 20000 });

    const filmography = getFilmography(page);
    // Locate the search input within the voice actor page
    const searchInput = filmography.locator("input[type='search']");
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type query "Indiana"
    await Promise.all([
      waitForCollectionRequest(page, "query", "Indiana"),
      searchInput.fill("Indiana"),
    ]);

    await expect(filmography.locator("a[href*='/movie/85']")).toBeVisible();
    await expect(filmography.locator("a[href*='/movie/78']")).toHaveCount(0);
    await expect(filmography.locator("a[href*='/game/301']")).toHaveCount(0);

    // Clear search
    await searchInput.fill("");

    await expect(filmography.locator("a[href*='/movie/85']")).toBeVisible();
    await expect(filmography.locator("a[href*='/movie/78']")).toBeVisible();
  });

  test("toggles between Grouped and List display modes", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 20000 });

    // Look for display mode buttons (Grouped / List)
    const listButton = page
      .locator("button")
      .filter({ hasText: /List|Liste/i })
      .first();
    if (await listButton.isVisible()) {
      await listButton.click();
      await expect(page.locator("a[href*='/movie/85']")).toBeVisible();

      const groupedButton = page
        .locator("button")
        .filter({ hasText: /Group|Groupe/i })
        .first();
      await groupedButton.click();
      await expect(page.locator("body")).toContainText("Harrison Ford");
    }
  });

  test("navigates to media detail page on card click", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 15000 });

    // Click on Raiders of the Lost Ark link
    const mediaLink = page.locator("a[href*='/movie/85']").first();
    await expect(mediaLink).toBeVisible({ timeout: 5000 });
    await Promise.all([
      page.waitForURL(/\/movie\/85/, { timeout: 5000 }),
      mediaLink.click(),
    ]);
    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");
  });
});
