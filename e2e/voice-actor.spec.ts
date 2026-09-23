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
    const hydrationMessages: string[] = [];
    page.on("console", (message) => {
      if (
        (message.type() === "warning" || message.type() === "error") &&
        message.text().includes("Hydration")
      ) {
        hydrationMessages.push(message.text());
      }
    });

    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

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

  test("keeps complete original actor groups together across pages", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    const createWork = (id: number, actorId: number, actorName: string) => ({
      work: {
        id,
        actor_id: actorId,
        performance: null,
        dubbing_projects: {
          content_id: id,
          content_type: "movie",
          studios: null,
        },
      },
      media: {
        id,
        title: `Film ${id}`,
        name: `Film ${id}`,
        poster_path: null,
      },
      data: {
        character: `Character ${id}`,
        actor: { id: actorId, name: actorName, profile_picture: null },
      },
      sortDate: "2020-01-01",
    });
    const harrisonWorks = Array.from({ length: 13 }, (_, index) =>
      createWork(8001 + index, 17419, "Harrison Ford"),
    );
    const otherGroups = Array.from({ length: 11 }, (_, index) => {
      const actorId = 200 + index;
      const actorWorks = [createWork(8100 + index, actorId, `Actor ${index}`)];
      return {
        key: `actor:${actorId}`,
        actorId,
        actor: {
          id: actorId,
          name: `Actor ${index}`,
          profile_picture: null,
        },
        works: actorWorks,
        worksCount: actorWorks.length,
      };
    });
    const unknownWork = createWork(8999, 0, "");
    const groups = [
      {
        key: "actor:17419",
        actorId: 17419,
        actor: {
          id: 17419,
          name: "Harrison Ford",
          profile_picture: null,
        },
        works: harrisonWorks,
        worksCount: harrisonWorks.length,
      },
      ...otherGroups,
      {
        key: "actor:unknown",
        actorId: null,
        actor: { id: null, name: null, profile_picture: null },
        works: [unknownWork],
        worksCount: 1,
      },
    ];

    await page.route("**/api/detail-collections**", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname !== "/api/detail-collections" ||
        url.searchParams.get("collection") !== "voice-actor-works"
      ) {
        return route.fallback();
      }

      const pageNumber = Number(url.searchParams.get("page") || 1);
      const pageSize = Number(url.searchParams.get("pageSize") || 12);
      const isGrouped = url.searchParams.get("view") === "grouped";
      const responseItems = isGrouped
        ? groups.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
        : [
            ...harrisonWorks,
            ...otherGroups.flatMap((group) => group.works),
          ].slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
      const totalItems = isGrouped
        ? groups.length
        : harrisonWorks.length + otherGroups.length;

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: responseItems,
          pagination: {
            page: pageNumber,
            pageSize,
            totalItems,
            totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
          },
        }),
      });
    });

    await page.goto("/voice-actor/1", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);
    await expect(
      page.getByRole("heading", { name: "Richard Darbois" }),
    ).toBeVisible({ timeout: 20000 });

    const filmography = getFilmography(page);
    const listButton = filmography
      .locator("button")
      .filter({ hasText: /List|Liste/i })
      .first();
    await Promise.all([
      page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
          url.pathname === "/api/detail-collections" &&
          url.searchParams.get("view") === "list"
        );
      }),
      listButton.click(),
    ]);
    await expect(filmography.locator("a[href*='/movie/8001']")).toBeVisible();

    const groupedButton = filmography
      .locator("button")
      .filter({ hasText: /Group|Groupe/i })
      .first();
    await Promise.all([
      page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
          url.pathname === "/api/detail-collections" &&
          url.searchParams.get("view") === "grouped" &&
          url.searchParams.get("page") === "1"
        );
      }),
      groupedButton.click(),
    ]);

    const harrisonGroup = filmography
      .getByTestId("voice-actor-group")
      .filter({ hasText: "Harrison Ford" });
    await expect(harrisonGroup).toHaveCount(1);
    await expect(harrisonGroup.locator("p")).toContainText("13");
    await expect(harrisonGroup.locator("a[href*='/movie/']")).toHaveCount(13);
    await expect(harrisonGroup.locator("a[href*='/actor/17419']")).toHaveCount(
      1,
    );
    await expect(filmography.getByTestId("voice-actor-group")).toHaveCount(12);

    const nextPageButton = filmography.locator("nav button").last();
    await Promise.all([
      page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
          url.pathname === "/api/detail-collections" &&
          url.searchParams.get("view") === "grouped" &&
          url.searchParams.get("page") === "2"
        );
      }),
      nextPageButton.click(),
    ]);
    const unknownGroup = filmography.getByTestId("voice-actor-group");
    await expect(unknownGroup).toHaveCount(1);
    await expect(unknownGroup).toContainText(
      /Unknown Actor|Acteur inconnu|Actor desconocido|不明な俳優/,
    );
    await expect(unknownGroup.locator("a[href*='/actor/0']")).toHaveCount(0);

    const resetListButton = filmography
      .locator("button")
      .filter({ hasText: /List|Liste/i })
      .first();
    await Promise.all([
      page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
          url.pathname === "/api/detail-collections" &&
          url.searchParams.get("view") === "list" &&
          url.searchParams.get("page") === "1"
        );
      }),
      resetListButton.click(),
    ]);
    await expect(filmography.locator("a[href*='/movie/8001']")).toBeVisible();
    await expect(filmography.getByTestId("voice-actor-group")).toHaveCount(0);
    api.expectNoErrors();
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
