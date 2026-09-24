import { test, expect, type Page } from "@playwright/test";
import { setupMockApi, waitForVueHydration } from "./helpers/mock-api";

test.describe("Voice Actor Profile & Filmography", () => {
  const getFilmography = (page: Page) =>
    page
      .getByRole("heading", { name: /Filmography|Filmographie/i })
      .locator("xpath=ancestor::section[1]");

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupMockApi(page);
  });

  test("renders voice actor profile details correctly", async ({ page }) => {
    const api = await setupMockApi(page);
    const hydrationMessages: string[] = [];
    page.on("console", (message) => {
      if (
        (message.type() === "warning" || message.type() === "error") &&
        message.text().includes("Hydration")
      ) {
        hydrationMessages.push(message.text());
      }
    });

    const response = await page.goto("/voice-actor/1", {
      waitUntil: "domcontentloaded",
    });
    const serverRenderedMarkup = (await response?.text())?.replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/g,
      "",
    );
    await waitForVueHydration(page);

    expect(serverRenderedMarkup).toContain("Richard Darbois");
    expect(serverRenderedMarkup).toContain("Raiders of the Lost Ark");

    // Wait for the main heading with the voice actor name to appear
    const heading = page.getByRole("heading", { name: "Richard Darbois" });
    await expect(heading).toBeVisible({ timeout: 20000 });

    // Verify bio and nationality are displayed
    await expect(page.locator("body")).toContainText("acteur franco-canadien");
    await expect(page.locator("body")).toContainText("Français");

    expect(hydrationMessages).toEqual([]);
    api.expectNoErrors();
  });

  test("renders category tabs with accurate counts", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    // Wait for main content to load
    await expect(page.getByRole("heading", { name: "Richard Darbois" })).toBeVisible({
      timeout: 20000,
    });

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

    await expect(page.getByRole("heading", { name: "Richard Darbois" })).toBeVisible({
      timeout: 20000,
    });

    const filmography = getFilmography(page);
    // Click on Movies tab
    const moviesTab = filmography.getByRole("button", {
      name: /Film|Movie/i,
    });
    await moviesTab.click();
    await expect(moviesTab).toHaveClass(/theme-selected/);

    await expect(filmography.locator("a[href*='/movie/85']")).toBeVisible();
    await expect(filmography.locator("a[href*='/movie/78']")).toBeVisible();
    await expect(filmography.locator("a[href*='/audiobook/401']")).toHaveCount(0);

    // Click on Audiobooks tab
    const audiobooksTab = filmography.getByRole("button", {
      name: /Livre|Audiobook/i,
    });
    await audiobooksTab.click();
    await expect(audiobooksTab).toHaveClass(/theme-selected/);

    await expect(filmography.locator("a[href*='/audiobook/401']")).toBeVisible();
    await expect(filmography.locator("a[href*='/movie/85']")).toHaveCount(0);

    // Click on All tab to restore full list
    const allTab = filmography.getByRole("button", { name: /All|Tous/i });
    await allTab.click();
    await expect(allTab).toHaveClass(/theme-selected/);

    await expect(filmography.locator("a[href*='/movie/85']")).toBeVisible();
    await expect(filmography.locator("a[href*='/audiobook/401']")).toBeVisible();
  });

  test("filters filmography dynamically with search bar", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    await expect(page.getByRole("heading", { name: "Richard Darbois" })).toBeVisible({
      timeout: 20000,
    });

    const filmography = getFilmography(page);
    // Locate the search input within the voice actor page
    const searchInput = filmography.locator("input[type='search']");
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Type query "Indiana"
    await searchInput.fill("Indiana");

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

    await expect(page.getByRole("heading", { name: "Richard Darbois" })).toBeVisible({
      timeout: 20000,
    });

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

  test("groups the existing filmography without fetching a collection", async ({ page }) => {
    const api = await setupMockApi(page);
    const collectionRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/detail-collections") {
        collectionRequests.push(url.search);
      }
    });

    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);
    await expect(page.getByRole("heading", { name: "Richard Darbois" })).toBeVisible({
      timeout: 20000,
    });

    const filmography = getFilmography(page);
    const harrisonGroup = filmography
      .getByTestId("voice-actor-group")
      .filter({ hasText: "Harrison Ford" });
    await expect(harrisonGroup).toHaveCount(1);
    await expect(harrisonGroup.locator("p")).toContainText("2");
    await expect(harrisonGroup.locator("a[href*='/movie/']")).toHaveCount(2);
    await expect(harrisonGroup.locator("a[href*='/actor/3']")).toHaveCount(1);

    const listButton = filmography
      .locator("button")
      .filter({ hasText: /List|Liste/i })
      .first();
    await listButton.click();
    await expect(filmography.getByTestId("voice-actor-group")).toHaveCount(0);
    await expect(filmography.locator("a[href*='/movie/85']")).toBeVisible();

    const groupedButton = filmography
      .locator("button")
      .filter({ hasText: /Group|Groupe/i })
      .first();
    await groupedButton.click();
    await expect(harrisonGroup).toHaveCount(1);
    expect(collectionRequests).toEqual([]);
    api.expectNoErrors();
  });

  test("keeps unresolved actors anonymous and non-navigable", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.unroute("**/api/**");
    const hydrationMessages: string[] = [];
    page.on("console", (message) => {
      if (
        (message.type() === "warning" || message.type() === "error") &&
        message.text().includes("Hydration")
      ) {
        hydrationMessages.push(message.text());
      }
    });

    const response = await page.goto("/voice-actor/999", {
      waitUntil: "domcontentloaded",
    });
    const serverRenderedMarkup = (await response?.text())?.replace(
      /<script\b[^>]*>[\s\S]*?<\/script>/g,
      "",
    );
    await waitForVueHydration(page);

    const filmography = getFilmography(page);
    const groups = filmography.getByTestId("voice-actor-group");
    const harrisonGroup = groups.filter({ hasText: "Harrison Ford" });
    expect(serverRenderedMarkup).toContain("Film 2012");
    await expect(harrisonGroup).toHaveCount(1);
    await expect(harrisonGroup.locator("p")).toContainText("15");
    await expect(harrisonGroup.locator("a[href*='/movie/']")).toHaveCount(15);
    await expect(harrisonGroup.locator("a[href*='/actor/3']")).toHaveCount(1);
    await expect(groups).toHaveCount(12);

    const harrisonWorkLinks = harrisonGroup.locator("a[href*='/movie/']");
    await expect(harrisonWorkLinks.first()).toHaveAttribute("href", /\/movie\/2012$/);
    await expect(harrisonWorkLinks.last()).toHaveAttribute("href", /\/movie\/85$/);

    const sortSelect = filmography.locator("select");
    await sortSelect.selectOption("oldest");
    await expect(harrisonWorkLinks.first()).toHaveAttribute("href", /\/movie\/85$/);
    await sortSelect.selectOption("newest");
    await expect(harrisonWorkLinks.first()).toHaveAttribute("href", /\/movie\/2012$/);

    await filmography.locator("nav button").last().click();
    await expect(page).toHaveURL(/worksPage=2/);
    await expect(groups).toHaveCount(7);
    await expect(harrisonGroup).toHaveCount(0);

    const unknownGroup = groups.filter({
      hasText: /Unknown Actor|Acteur inconnu|Actor desconocido|不明な俳優/,
    });
    await expect(unknownGroup).toHaveCount(1);
    await expect(unknownGroup).not.toContainText("Unverified Person");
    await expect(unknownGroup.locator("a[href*='/actor/']")).toHaveCount(0);
    await expect(unknownGroup.locator("div.sticky img")).toHaveCount(0);

    const listButton = filmography
      .locator("button")
      .filter({ hasText: /List|Liste/i })
      .first();
    await listButton.click();
    await expect(page).not.toHaveURL(/worksPage=2/);
    await expect(groups).toHaveCount(0);
    await expect(filmography.locator(".grid").last().locator(":scope > div")).toHaveCount(12);

    const unknownActorRow = filmography
      .locator(".grid")
      .last()
      .locator(":scope > div")
      .filter({ hasText: "Unverified Voice Credit" });
    await expect(unknownActorRow).toHaveCount(1);
    const originalActorColumn = unknownActorRow
      .locator(":scope > div")
      .locator(":scope > div")
      .nth(1);
    await expect(originalActorColumn).toContainText(
      /Unknown Actor|Acteur inconnu|Actor desconocido|不明な俳優/,
    );
    await expect(unknownActorRow.locator("a[href*='/actor/0']")).toHaveCount(0);
    await expect(unknownActorRow.locator("a[href*='/actor/']")).toHaveCount(0);
    await expect(originalActorColumn.locator("img")).toHaveCount(0);

    const groupedButton = filmography
      .locator("button")
      .filter({ hasText: /Group|Groupe/i })
      .first();
    await filmography.locator("nav button").last().click();
    await expect(page).toHaveURL(/worksPage=2/);
    await expect(filmography.locator(".grid").last().locator(":scope > div")).toHaveCount(12);
    await groupedButton.click();
    await expect(page).not.toHaveURL(/worksPage=2/);
    await expect(groups).toHaveCount(12);
    await expect(harrisonGroup).toHaveCount(1);
    expect(hydrationMessages).toEqual([]);
    api.expectNoErrors();
  });

  test("navigates to media detail page on card click", async ({ page }) => {
    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    await expect(page.getByRole("heading", { name: "Richard Darbois" })).toBeVisible({
      timeout: 15000,
    });

    // Click on Raiders of the Lost Ark link
    const mediaLink = page.locator("a[href*='/movie/85']").first();
    await expect(mediaLink).toBeVisible({ timeout: 5000 });
    await Promise.all([page.waitForURL(/\/movie\/85/, { timeout: 5000 }), mediaLink.click()]);
    await expect(page.locator("body")).toContainText("Raiders of the Lost Ark");
  });
});
