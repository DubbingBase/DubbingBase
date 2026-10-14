import { test, expect, type Page } from "@playwright/test";
import { setupMockApi, waitForVueHydration } from "./helpers/mock-api";
import {
  MOCK_EPISODE,
  MOCK_MOVIE,
  MOCK_SEASON,
  MOCK_SHOW,
} from "./fixtures/mock-data";

declare global {
  interface HTMLElement {
    __vue_app__?: {
      config: {
        globalProperties: {
          $router?: { push: (path: string) => Promise<unknown> };
        };
      };
    };
  }
}

async function navigateClientSide(page: Page, path: string) {
  await page.waitForFunction(() => {
    return Boolean(
      document.getElementById("__nuxt")?.__vue_app__?.config.globalProperties
        .$router,
    );
  });
  await page.evaluate(async (nextPath) => {
    const router =
      document.getElementById("__nuxt")?.__vue_app__?.config.globalProperties
        .$router;
    if (!router)
      throw new Error("Nuxt router is not available after hydration");
    await router.push(nextPath);
  }, path);
}

async function waitForBrowserPaint(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

function getAttribute(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] || "";
}

test.describe("Media Detail Pages", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await setupMockApi(page);
  });

  test("renders Movie detail page with dubbing cast", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.goto("/movie/85", { waitUntil: "domcontentloaded" });

    // Verify title and synopsis
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Indiana Jones");
    await expect(page.locator("body")).toContainText("Richard Darbois");

    // Verify link to voice actor works
    const vaLink = page.locator("a[href*='/voice-actor/1']").first();
    await expect(vaLink).toBeVisible({ timeout: 5000 });

    api.expectNoErrors();
  });

  test("refetches movie data when browser back returns to the detail page", async ({
    page,
  }) => {
    await setupMockApi(page);
    const freshMovie = structuredClone(MOCK_MOVIE);
    freshMovie.movie.title = "Raiders of the Lost Ark (Updated)";
    let movieRequests = 0;

    await page.route("**/api/movie/85**", async (route) => {
      movieRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(freshMovie),
      });
    });

    await page.goto("/movie/85", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);
    await expect(
      page.getByRole("heading", { name: "Raiders of the Lost Ark" }),
    ).toBeVisible();

    await page.locator('a[href*="/voice-actor/1"]').first().click();
    await expect(page).toHaveURL(/\/voice-actor\/1/);
    await page.goBack();

    await expect.poll(() => movieRequests).toBe(1);
    await expect(
      page.getByRole("heading", {
        name: "Raiders of the Lost Ark (Updated)",
      }),
    ).toBeVisible();
  });

  test("renders TV Show detail page with cast and seasons", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });

    // Verify title and series cast
    await expect(
      page.getByRole("heading", { name: "Breaking Bad" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Walter White");
    await expect(page.locator("body")).toContainText("Jean-Louis Faure");

    api.expectNoErrors();
  });

  test("keeps the cast page valid while navigating between shows", async ({
    page,
  }) => {
    const showB = structuredClone(MOCK_SHOW);
    showB.serie.id = 108978;
    showB.serie.name = "Fargo";
    showB.serie.title = "Fargo";
    showB.aggregateCredits.cast = [
      {
        ...showB.aggregateCredits.cast[0],
        id: 30000,
        name: "Fargo Lead",
        character: "Fargo Character",
        roles: [{ character: "Fargo Character" }],
      },
    ];
    const showBProject = structuredClone(showB.dubbingProjects[0]);
    showBProject.id = 10897801;
    showBProject.content_id = 108978;
    showBProject.works = [
      {
        ...showBProject.works[0],
        id: 108978001,
        actor_id: 30000,
        character_name: "Fargo Character",
      },
    ];
    showB.dubbingProjects = [showBProject];

    let releaseShowB = () => {};
    const showBGate = new Promise<void>((resolve) => {
      releaseShowB = resolve;
    });
    let markShowBStarted = () => {};
    const showBStarted = new Promise<void>((resolve) => {
      markShowBStarted = resolve;
    });
    let markShowBFinished = () => {};
    const showBFinished = new Promise<void>((resolve) => {
      markShowBFinished = resolve;
    });

    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);

    await page.route("**/api/show/**", async (route) => {
      const url = new URL(route.request().url());
      const isShowB = url.pathname.endsWith("/108978");
      if (isShowB) {
        markShowBStarted();
        await showBGate;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(showB),
      });
      if (isShowB) markShowBFinished();
    });

    await navigateClientSide(page, "/show/108978?castPage=2");
    await showBStarted;
    await expect(page).toHaveURL(/\/show\/108978\?castPage=2$/);

    releaseShowB();
    await showBFinished;
    await expect(page.getByText("Fargo Lead", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Walter White");
    await expect(page).toHaveURL(/\/show\/108978\?castPage=2$/);
  });

  test("keeps locale navigation intact when its implicit default dub changes", async ({
    page,
  }) => {
    const show = structuredClone(MOCK_SHOW);
    show.serie.id = 108978;
    show.serie.name = "Default Dub Show";
    show.serie.title = "Default Dub Show";
    show.dubbingProjects[0].content_id = 108978;
    const englishProject = structuredClone(show.dubbingProjects[0]);
    englishProject.id = 10897802;
    englishProject.content_id = 108978;
    englishProject.language = "en-US";
    englishProject.works = Array.from({ length: 13 }, (_, index) => ({
      id: 1396100 + index,
      actor_id: null,
      voice_actor_id: 500 + index,
      character_name: `English default role ${index + 1}`,
      performance: "dialogues",
      voice_actor: {
        id: 500 + index,
        firstname: "English",
        lastname: `Voice Actor ${index + 1}`,
        profile_picture: null,
      },
      voice_actors: {
        id: 500 + index,
        firstname: "English",
        lastname: `Voice Actor ${index + 1}`,
        profile_picture: null,
      },
    }));
    show.dubbingProjects.push(englishProject);

    const frenchShow = structuredClone(show);
    frenchShow.serie.name = "Default Dub Show en français";
    frenchShow.serie.title = "Default Dub Show en français";

    let releaseFrenchShow = () => {};
    const frenchShowGate = new Promise<void>((resolve) => {
      releaseFrenchShow = resolve;
    });
    let markFrenchShowStarted = () => {};
    const frenchShowStarted = new Promise<void>((resolve) => {
      markFrenchShowStarted = resolve;
    });
    let markFrenchShowFinished = () => {};
    const frenchShowFinished = new Promise<void>((resolve) => {
      markFrenchShowFinished = resolve;
    });

    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);
    await page.route("**/api/show/**", async (route) => {
      const isFrench =
        route.request().headers()["accept-language"]?.startsWith("fr") ?? false;
      if (isFrench) {
        markFrenchShowStarted();
        await frenchShowGate;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isFrench ? frenchShow : show),
      });
      if (isFrench) markFrenchShowFinished();
    });

    await navigateClientSide(page, "/show/108978");
    await expect(
      page.getByRole("heading", { name: "Default Dub Show" }),
    ).toBeVisible();
    await navigateClientSide(page, "/show/108978?castPage=2");
    await expect(
      page.getByText("English default role 13", { exact: true }).first(),
    ).toBeVisible();

    await page.locator('button[aria-label="Toggle language"]').click();
    await page.getByText("Français", { exact: true }).click();
    await frenchShowStarted;

    await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
    await expect(page).toHaveURL(/\/fr\/show\/108978\?castPage=2$/);

    releaseFrenchShow();
    await frenchShowFinished;
    await expect(page).toHaveURL(/\/fr\/show\/108978\?castPage=2$/);
    await expect(
      page.getByRole("heading", { name: "Default Dub Show en français" }),
    ).toBeVisible();
    await expect(page.getByText("Jean-Louis Faure").first()).toBeVisible();
    await expect(
      page.getByText("English default role 13", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Pagination"]')).toHaveCount(0);
  });

  test("shows the first cast page for an out-of-range castPage query", async ({
    page,
  }) => {
    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });
    await waitForVueHydration(page);
    await navigateClientSide(page, "/show/1396?castPage=99");
    await expect(page).toHaveURL(/\/show\/1396\?castPage=99$/);

    await expect(page.getByText("Bryan Cranston").first()).toBeVisible();
    await expect(page.getByText("Aaron Paul").first()).toBeVisible();
    await expect(page).toHaveURL(/\/show\/1396\?castPage=99$/);
  });

  test("uses TMDB actor IDs and leaves unmatched cast works unlinked", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });

    await expect(page.locator('a[href="/actor/17419"]').first()).toBeVisible();
    const unmatchedCard = page
      .getByText("Unlinked character", { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'theme-input')][1]");
    await expect(unmatchedCard).toBeVisible();
    await expect(unmatchedCard.locator('a[href*="/actor/"]')).toHaveCount(0);
    await expect(
      page.locator('a[href*="/actor/undefined"], a[href*="/actor/17419-"]'),
    ).toHaveCount(0);
  });

  test("links movie and episode cast cards with TMDB actor IDs", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/movie/85", { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href="/actor/3"]').first()).toBeVisible();

    await page.goto("/show/1396/season/1/episode/1", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator('a[href="/actor/17419"]').first()).toBeVisible();
    await expect(
      page.locator('a[href*="/actor/undefined"], a[href*="/actor/17419-"]'),
    ).toHaveCount(0);
  });

  test("filters cast by full voice actor name on movie, show, and episode", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const routes = [
      {
        path: "/movie/85",
        voiceActor: "Richard Darbois",
        actor: "Harrison Ford",
        absentActor: "Karen Allen",
      },
      {
        path: "/show/1396",
        voiceActor: "Jean-Louis Faure",
        actor: "Bryan Cranston",
        absentActor: "Aaron Paul",
      },
      {
        path: "/show/1396/season/1/episode/1",
        voiceActor: "Jean-Louis Faure",
        actor: "Bryan Cranston",
        absentActor: "Aaron Paul",
      },
    ];

    for (const route of routes) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await waitForVueHydration(page);
      const castSection = page
        .getByRole("heading", { name: "Cast & Crew" })
        .locator("xpath=ancestor::section[1]");
      const search = castSection.locator('input[type="search"]');
      await search.fill(route.voiceActor);
      await expect(
        castSection.getByText(route.actor, { exact: true }),
      ).toBeVisible();
      await expect(
        castSection.getByText(route.absentActor, { exact: true }),
      ).toHaveCount(0);
    }
  });

  test("only exposes show JSON-LD on the show route", async ({ page }) => {
    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator('head script[type="application/ld+json"]'),
    ).toHaveCount(1);

    await page.goto("/show/1396/season/1", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator('head script[type="application/ld+json"]'),
    ).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /show\/1396\/season\/1/,
    );

    await page.goto("/show/1396/season/1/episode/1", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.locator('head script[type="application/ld+json"]'),
    ).toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /show\/1396\/season\/1\/episode\/1/,
    );
  });

  test("server-renders season and episode metadata for every supported locale", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const locales = [
      { code: "en-US", prefix: "", seasonLabel: "Season 1" },
      { code: "fr-FR", prefix: "/fr", seasonLabel: "Saison 1" },
      { code: "es-ES", prefix: "/es", seasonLabel: "Temporada 1" },
      { code: "ja-JP", prefix: "/ja", seasonLabel: "シーズン 1" },
    ];

    for (const locale of locales) {
      await page.context().clearCookies();
      await page.context().addCookies([
        {
          name: "user_lang",
          value: locale.code.slice(0, 2).toLowerCase(),
          url: "http://localhost:3050",
          sameSite: "Lax",
        },
      ]);
      const localeCookie = await page
        .context()
        .cookies("http://localhost:3050");
      expect(
        localeCookie.find((cookie) => cookie.name === "user_lang")?.value,
      ).toBe(locale.code.slice(0, 2).toLowerCase());

      for (const route of [
        {
          path: `${locale.prefix}/show/1396/season/1`,
          canonicalPath: "/show/1396/season/1?dub=139601",
          title: "Breaking Bad",
          titleParts: ["Breaking Bad", locale.seasonLabel],
        },
        {
          path: `${locale.prefix}/show/1396/season/1/episode/1`,
          canonicalPath: "/show/1396/season/1/episode/1?dub=139601",
          title: "Pilot",
          titleParts: [locale.seasonLabel, "Pilot"],
        },
      ]) {
        const response = await page.goto(route.path, {
          waitUntil: "domcontentloaded",
        });
        expect(response && new URL(response.url()).pathname).toBe(route.path);
        const html = response ? await response.text() : "";
        expect(html).not.toBe("");
        expect(html).toMatch(
          new RegExp(`<html\\b[^>]*\\blang="${locale.code}"`),
        );

        const canonicalTags =
          html.match(/<link\b(?=[^>]*\brel="canonical")[^>]*>/g) || [];
        const ogUrlTags =
          html.match(/<meta\b(?=[^>]*\bproperty="og:url")[^>]*>/g) || [];
        expect(canonicalTags).toHaveLength(1);
        expect(ogUrlTags).toHaveLength(1);
        expect(getAttribute(canonicalTags[0], "href")).toBe(
          `https://dubbingbase.com${route.canonicalPath}`,
        );
        expect(getAttribute(ogUrlTags[0], "content")).toBe(
          `https://dubbingbase.com${route.canonicalPath}`,
        );
        const alternateTags =
          html.match(
            /<link\b(?=[^>]*\brel="alternate")(?=[^>]*\bhreflang="[^"]+")[^>]*>/g,
          ) || [];
        const supportedAlternates = [
          { code: "en-US", prefix: "" },
          { code: "fr-FR", prefix: "/fr" },
          { code: "es-ES", prefix: "/es" },
          { code: "ja-JP", prefix: "/ja" },
        ];
        for (const alternate of supportedAlternates) {
          const matchingTags = alternateTags.filter(
            (tag) => getAttribute(tag, "hreflang") === alternate.code,
          );
          expect(matchingTags).toHaveLength(1);
          const alternateUrl = new URL(getAttribute(matchingTags[0], "href"));
          expect(alternateUrl.origin).toBe("https://dubbingbase.com");
          expect(alternateUrl.pathname).toBe(
            `${alternate.prefix}${route.canonicalPath.split("?")[0]}`,
          );
        }
        const titleTag = html.match(/<title>(.*?)<\/title>/s)?.[1] || "";
        for (const titlePart of route.titleParts) {
          expect(titleTag).toContain(titlePart);
        }
        expect(html).toContain(route.title);
        expect(html).not.toContain("Show 1396");
      }
    }
  });

  test("updates season locale and metadata after client-side locale navigation", async ({
    page,
  }) => {
    const frenchShow = structuredClone(MOCK_SHOW);
    frenchShow.serie.name = "Breaking Bad en français";
    frenchShow.serie.title = "Breaking Bad en français";
    let markFrenchShowRequested = () => {};
    const frenchShowRequested = new Promise<void>((resolve) => {
      markFrenchShowRequested = resolve;
    });

    await page.route("**/api/show/1396**", async (route) => {
      const acceptLanguage = route.request().headers()["accept-language"];
      const isFrench = acceptLanguage?.startsWith("fr") ?? false;
      if (isFrench) markFrenchShowRequested();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isFrench ? frenchShow : MOCK_SHOW),
      });
    });

    await page.goto("/show/1396/season/1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      return Boolean(document.getElementById("__nuxt")?.__vue_app__);
    });

    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page).toHaveTitle(/Season 1/);

    await page.locator('button[aria-label="Toggle language"]').click();
    await page.getByText("Français", { exact: true }).click();

    await frenchShowRequested;
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
    await expect(page).toHaveTitle(/Breaking Bad en français.*Saison 1/);
    await expect(page).toHaveURL(/\/fr\/show\/1396\/season\/1/);
    await expect
      .poll(() =>
        page.evaluate(() => performance.getEntriesByType("navigation").length),
      )
      .toBe(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://dubbingbase.com/show/1396/season/1?dub=139601",
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      "https://dubbingbase.com/show/1396/season/1?dub=139601",
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Saison 1/,
    );
    await expect(
      page.locator('link[rel="alternate"][hreflang="fr-FR"]'),
    ).toHaveCount(1);
  });

  test("hides stale show data while the next locale response is pending", async ({
    page,
  }) => {
    const frenchShow = structuredClone(MOCK_SHOW);
    frenchShow.serie.name = "Breaking Bad en français";
    frenchShow.serie.title = "Breaking Bad en français";
    let markFrenchShowRequested = () => {};
    const frenchShowRequested = new Promise<void>((resolve) => {
      markFrenchShowRequested = resolve;
    });
    let releaseFrenchShow = () => {};
    const frenchShowGate = new Promise<void>((resolve) => {
      releaseFrenchShow = resolve;
    });
    let markFrenchShowFinished = () => {};
    const frenchShowFinished = new Promise<void>((resolve) => {
      markFrenchShowFinished = resolve;
    });

    await page.route("**/api/show/1396**", async (route) => {
      const acceptLanguage = route.request().headers()["accept-language"];
      const isFrench = acceptLanguage?.startsWith("fr") ?? false;
      if (isFrench) {
        markFrenchShowRequested();
        await frenchShowGate;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isFrench ? frenchShow : MOCK_SHOW),
      });
      if (isFrench) markFrenchShowFinished();
    });

    await page.goto("/show/1396/season/1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      return Boolean(document.getElementById("__nuxt")?.__vue_app__);
    });
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(page).toHaveTitle(/Breaking Bad.*Season 1/);

    await page.locator('button[aria-label="Toggle language"]').click();
    await page.getByText("Français", { exact: true }).click();

    await frenchShowRequested;
    await expect(page.locator("html")).toHaveAttribute("lang", "fr-FR");
    await expect(page.locator("body")).not.toContainText("Breaking Bad");
    await expect(page).not.toHaveTitle(/Breaking Bad/);
    await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute(
      "content",
      /Breaking Bad/,
    );

    releaseFrenchShow();
    await frenchShowFinished;
    await expect(page).toHaveTitle(/Breaking Bad en français.*Saison 1/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Saison 1/,
    );
    await expect
      .poll(() =>
        page.evaluate(() => performance.getEntriesByType("navigation").length),
      )
      .toBe(1);
  });

  test("navigates show to season to episode and preserves the selected dub", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });

    const seasonLink = page.locator('a[href*="/show/1396/season/1"]').first();
    await expect(seasonLink).toHaveAttribute("href", /dub=139601/);
    await seasonLink.click();
    await expect(page).toHaveURL(/\/show\/1396\/season\/1\?dub=139601/);
    await expect(
      page.getByText("Walter White begins a new chapter."),
    ).toBeVisible();

    await page.getByRole("link", { name: /Pilot/ }).first().click();
    await expect(page).toHaveURL(
      /\/show\/1396\/season\/1\/episode\/1\?dub=139601/,
    );
    await expect(page.locator("body")).toContainText(
      "Walter White starts cooking methamphetamine.",
    );
  });

  test("loads Specials from season zero", async ({ page }) => {
    await setupMockApi(page);
    await page.goto("/show/1396/season/0");
    await expect(page.locator("body")).toContainText("Specials");
    await expect(page.getByRole("heading", { name: "Episodes" })).toBeVisible();
  });

  test("lazy-loads and asynchronously decodes season episode thumbnails", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/show/1396/season/1");

    const episodeImage = page.locator('img[alt="Episode"]').first();
    await expect(episodeImage).toHaveAttribute("loading", "lazy");
    await expect(episodeImage).toHaveAttribute("decoding", "async");
  });

  test("updates season show data across A to B to A with out-of-order responses", async ({
    page,
  }) => {
    const showA = structuredClone(MOCK_SHOW);
    const showB = structuredClone(MOCK_SHOW);
    showB.serie.id = 108978;
    showB.serie.name = "Fargo";
    showB.serie.title = "Fargo";

    const seasonA = structuredClone(MOCK_SEASON);
    seasonA.season.name = "Breaking Bad Season One";
    const seasonB = structuredClone(MOCK_SEASON);
    seasonB.season.id = 108978;
    seasonB.season.season_number = 2;
    seasonB.season.name = "Fargo Season Two";

    let releaseSeasonA = () => {};
    const seasonAGate = new Promise<void>((resolve) => {
      releaseSeasonA = resolve;
    });
    let markSeasonAStarted = () => {};
    const seasonAStarted = new Promise<void>((resolve) => {
      markSeasonAStarted = resolve;
    });
    let releaseShowB = () => {};
    const showBGate = new Promise<void>((resolve) => {
      releaseShowB = resolve;
    });
    let markShowBStarted = () => {};
    const showBStarted = new Promise<void>((resolve) => {
      markShowBStarted = resolve;
    });
    let markSeasonBFinished = () => {};
    const seasonBFinished = new Promise<void>((resolve) => {
      markSeasonBFinished = resolve;
    });
    let markSeasonAFinished = () => {};
    const seasonAFinished = new Promise<void>((resolve) => {
      markSeasonAFinished = resolve;
    });
    let releaseSeasonB = () => {};
    const seasonBGate = new Promise<void>((resolve) => {
      releaseSeasonB = resolve;
    });
    let markSeasonBStarted = () => {};
    const seasonBStarted = new Promise<void>((resolve) => {
      markSeasonBStarted = resolve;
    });
    let seasonARequests = 0;

    await page.route("**/api/show/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/108978")) {
        markShowBStarted();
        await showBGate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(showB),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(showA),
      });
    });

    await page.route("**/api/season?**", async (route) => {
      const url = new URL(route.request().url());
      const showId = url.searchParams.get("id");
      const seasonNumber = url.searchParams.get("season_number");
      const data = showId === "108978" ? seasonB : seasonA;

      if (showId === "108978") {
        markSeasonBStarted();
        await seasonBGate;
      }

      if (showId === "1396" && seasonNumber === "1" && seasonARequests === 0) {
        seasonARequests += 1;
        markSeasonAStarted();
        await seasonAGate;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(data),
      });
      if (showId === "108978") markSeasonBFinished();
      if (showId === "1396" && seasonNumber === "1" && seasonARequests === 1) {
        markSeasonAFinished();
      }
    });

    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });
    await navigateClientSide(page, "/show/1396/season/1");
    await seasonAStarted;
    await navigateClientSide(page, "/show/108978/season/2");
    await Promise.all([showBStarted, seasonBStarted]);

    await expect(page).toHaveURL(/\/show\/108978\/season\/2/);
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Breaking Bad");
    await expect(page).not.toHaveTitle(/Breaking Bad/);
    await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute(
      "content",
      /Breaking Bad/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /show\/108978\/season\/2/,
    );
    await expect(page).not.toHaveTitle(/Show 108978/);

    releaseSeasonB();
    await seasonBFinished;
    await expect(page.locator("body")).toContainText("Fargo Season Two");

    releaseShowB();
    await expect(page).toHaveTitle(/Fargo/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Fargo/,
    );

    releaseSeasonA();
    await seasonAFinished;
    await waitForBrowserPaint(page);
    await expect(page.locator("body")).toContainText("Fargo Season Two");
    await expect(page.locator("body")).not.toContainText(
      "Breaking Bad Season One",
    );

    await navigateClientSide(page, "/show/1396/season/1");
    await expect(page.locator("body")).toContainText("Breaking Bad Season One");
    await expect(page).toHaveTitle(/Breaking Bad/);
  });

  test("hides loaded season A content and metadata while season B is pending", async ({
    page,
  }) => {
    const showB = structuredClone(MOCK_SHOW);
    showB.serie.id = 108978;
    showB.serie.name = "Fargo";
    showB.serie.title = "Fargo";

    const seasonA = structuredClone(MOCK_SEASON);
    seasonA.season.name = "Breaking Bad Season One";
    seasonA.season.overview = "Breaking Bad season synopsis must disappear.";
    seasonA.dubbingProjects[0].language = "sv-SE";

    const seasonB = structuredClone(MOCK_SEASON);
    seasonB.season.id = 108978;
    seasonB.season.season_number = 2;
    seasonB.season.name = "Fargo Season Two";
    seasonB.season.overview = "Fargo season synopsis.";
    seasonB.dubbingProjects = [];

    let releaseSeasonB = () => {};
    const seasonBGate = new Promise<void>((resolve) => {
      releaseSeasonB = resolve;
    });
    let markSeasonBStarted = () => {};
    const seasonBStarted = new Promise<void>((resolve) => {
      markSeasonBStarted = resolve;
    });
    let markShowBFinished = () => {};
    const showBFinished = new Promise<void>((resolve) => {
      markShowBFinished = resolve;
    });
    let markSeasonBFinished = () => {};
    const seasonBFinished = new Promise<void>((resolve) => {
      markSeasonBFinished = resolve;
    });

    await page.route("**/api/show/**", async (route) => {
      const url = new URL(route.request().url());
      const isShowB = url.pathname.endsWith("/108978");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(isShowB ? showB : MOCK_SHOW),
      });
      if (isShowB) markShowBFinished();
    });

    await page.route("**/api/season?**", async (route) => {
      const url = new URL(route.request().url());
      const showId = url.searchParams.get("id");
      if (showId === "108978") {
        markSeasonBStarted();
        await seasonBGate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(seasonB),
        });
        markSeasonBFinished();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(seasonA),
      });
    });

    await page.goto("/show/1396", { waitUntil: "domcontentloaded" });
    await navigateClientSide(page, "/show/1396/season/1");
    await expect(page.locator("body")).toContainText("Breaking Bad Season One");
    await expect(page).toHaveTitle(/Breaking Bad.*Swedish/);
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute(
      "content",
      /Breaking Bad season synopsis must disappear\./,
    );

    await navigateClientSide(page, "/show/108978/season/2");
    await Promise.all([seasonBStarted, showBFinished]);

    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(
      "Breaking Bad Season One",
    );
    await expect(page.locator("body")).not.toContainText(
      "Breaking Bad season synopsis must disappear.",
    );
    await expect(page.locator("body")).not.toContainText("Swedish");
    await expect(page).not.toHaveTitle(/Breaking Bad|Swedish/);
    await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute(
      "content",
      /Breaking Bad|Swedish/,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).not.toHaveAttribute("content", /Breaking Bad season synopsis/);

    releaseSeasonB();
    await seasonBFinished;
    await expect(page.locator("body")).toContainText("Fargo Season Two");
    await expect(page).toHaveTitle(/Fargo/);
  });

  test("clears rendered episode metadata while the next route is loading", async ({
    page,
  }) => {
    const episodeB = structuredClone(MOCK_EPISODE);
    episodeB.episode.season_number = 2;
    episodeB.episode.episode_number = 2;
    episodeB.episode.name = "Fargo Selected Episode Two";
    episodeB.episode.overview = "A new Fargo story begins.";
    episodeB.episode.credits.cast[0].name = "Fargo Cast Actor";

    let releaseEpisodeB = () => {};
    const episodeBGate = new Promise<void>((resolve) => {
      releaseEpisodeB = resolve;
    });
    let markEpisodeBStarted = () => {};
    const episodeBStarted = new Promise<void>((resolve) => {
      markEpisodeBStarted = resolve;
    });
    await page.route("**/api/episode?**", async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("id") !== "108978") {
        await route.fallback();
        return;
      }

      markEpisodeBStarted();
      await episodeBGate;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(episodeB),
      });
    });

    await page.goto("/show/1396/season/1/episode/1", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("body")).toContainText(
      "Walter White starts cooking methamphetamine.",
    );
    await expect(page).toHaveTitle(/Pilot/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Pilot/,
    );

    await navigateClientSide(page, "/show/108978/season/2/episode/2");
    await episodeBStarted;

    await expect(page).not.toHaveTitle(/Pilot/);
    await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute(
      "content",
      /Pilot/,
    );
    await expect(page.locator("body")).not.toContainText(
      "Walter White starts cooking methamphetamine.",
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /show\/108978\/season\/2\/episode\/2/,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      /show\/108978\/season\/2\/episode\/2/,
    );

    releaseEpisodeB();
    await expect(page.locator("body")).toContainText(
      "Fargo Selected Episode Two",
    );
    await expect(page.locator("body")).toContainText("Fargo Cast Actor");
    await expect(page).toHaveTitle(/Fargo Selected Episode Two/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Fargo Selected Episode Two/,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", /A new Fargo story begins\./);
  });

  test("updates episode data across A to B to A with out-of-order responses", async ({
    page,
  }) => {
    const episodeA = structuredClone(MOCK_EPISODE);
    episodeA.episode.name = "Breaking Bad Delayed Episode One";
    const episodeB = structuredClone(MOCK_EPISODE);
    episodeB.episode.season_number = 2;
    episodeB.episode.episode_number = 2;
    episodeB.episode.name = "Fargo Selected Episode Two";
    episodeB.episode.overview = "A new Fargo story begins.";
    episodeB.episode.credits.cast[0].name = "Fargo Cast Actor";
    episodeB.episode.credits.cast[0].character = "Fargo Character";
    for (const project of episodeB.dubbingProjects) {
      for (const work of project.works || []) {
        if (work.actor_id === 17419) work.character_name = "Fargo Character";
      }
      for (const work of project.work || []) {
        if (work.actor_id === 17419) work.character_name = "Fargo Character";
      }
    }

    let releaseEpisodeA = () => {};
    const episodeAGate = new Promise<void>((resolve) => {
      releaseEpisodeA = resolve;
    });
    let markEpisodeAStarted = () => {};
    const episodeAStarted = new Promise<void>((resolve) => {
      markEpisodeAStarted = resolve;
    });
    let releaseEpisodeB = () => {};
    const episodeBGate = new Promise<void>((resolve) => {
      releaseEpisodeB = resolve;
    });
    let markEpisodeBStarted = () => {};
    const episodeBStarted = new Promise<void>((resolve) => {
      markEpisodeBStarted = resolve;
    });
    let markEpisodeAFinished = () => {};
    const episodeAFinished = new Promise<void>((resolve) => {
      markEpisodeAFinished = resolve;
    });
    let episodeARequests = 0;

    await page.route("**/api/episode?**", async (route) => {
      const url = new URL(route.request().url());
      const showId = url.searchParams.get("id");

      if (showId === "108978") {
        markEpisodeBStarted();
        await episodeBGate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(episodeB),
        });
        return;
      }

      if (episodeARequests === 0) {
        episodeARequests += 1;
        markEpisodeAStarted();
        await episodeAGate;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(episodeA),
      });
      if (episodeARequests === 1) markEpisodeAFinished();
    });

    await page.goto("/show/1396");
    await navigateClientSide(page, "/show/1396/season/1");
    await navigateClientSide(page, "/show/1396/season/1/episode/1");
    await episodeAStarted;
    await navigateClientSide(page, "/show/108978/season/2/episode/2");
    await episodeBStarted;

    await expect(page).toHaveURL(/\/show\/108978\/season\/2\/episode\/2/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /show\/108978\/season\/2\/episode\/2/,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      /show\/108978\/season\/2\/episode\/2/,
    );
    await expect(page).not.toHaveTitle(/Breaking Bad/);
    await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute(
      "content",
      /Breaking Bad/,
    );
    await expect(page.locator("body")).not.toContainText(
      "Breaking Bad Delayed Episode One",
    );
    await expect(page.locator("body")).not.toContainText("Walter White");

    releaseEpisodeB();
    await expect(page.locator("body")).toContainText(
      "Fargo Selected Episode Two",
    );
    await expect(page.locator("body")).toContainText("Fargo Cast Actor");
    await expect(page).toHaveTitle(/Fargo Selected Episode Two/);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Fargo Selected Episode Two/,
    );
    await expect(
      page.locator('meta[property="og:description"]'),
    ).toHaveAttribute("content", /A new Fargo story begins\./);
    await expect(page).not.toHaveTitle(/^Series$/);

    releaseEpisodeA();
    await episodeAFinished;
    await waitForBrowserPaint(page);
    await expect(page.locator("body")).toContainText(
      "Fargo Selected Episode Two",
    );
    await expect(page.locator("body")).not.toContainText(
      "Breaking Bad Delayed Episode One",
    );

    await navigateClientSide(page, "/show/1396/season/1/episode/1");
    await expect(page.locator("body")).toContainText(
      "Breaking Bad Delayed Episode One",
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      "content",
      /show\/1396\/season\/1\/episode\/1/,
    );
  });

  test("mounts the season skeleton while the season request is delayed", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.goto("/show/1396");
    await page.route("**/api/season?**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SEASON),
      });
    });

    await page.locator('a[href*="/show/1396/season/1"]').first().click();
    await expect(page).toHaveURL(/\/show\/1396\/season\/1/);
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(
      page.getByText("Walter White begins a new chapter."),
    ).toBeVisible();
  });

  test("shows an error for a timed out French season request", async ({
    page,
  }) => {
    await setupMockApi(page);
    await page.context().addCookies([
      {
        name: "user_lang",
        value: "fr",
        url: "http://localhost:3050",
        sameSite: "Lax",
      },
    ]);
    await page.goto("/fr/show/108978/season/1?dub=524", {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL("/fr/show/108978/season/1?dub=524");
    await expect(page.locator(".animate-pulse").first()).toBeVisible();
    await expect(
      page.getByText("Impossible de charger ce contenu pour le moment."),
    ).toBeVisible();
  });

  test("renders Video Game detail page with localized voice cast", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/game/1942", { waitUntil: "domcontentloaded" });

    // Verify game title and voice actors
    await expect(
      page.getByRole("heading", { name: "The Witcher 3: Wild Hunt" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Geralt de Riv");
    await expect(page.locator("body")).toContainText("Daniel Lobé");

    api.expectNoErrors();
  });

  test("renders Audiobook detail page with narrator information", async ({
    page,
  }) => {
    const api = await setupMockApi(page);
    await page.goto("/audiobook/401", { waitUntil: "domcontentloaded" });

    // Verify audiobook title, author, and narrator
    await expect(page.getByRole("heading", { name: "Dune" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator("body")).toContainText("Frank Herbert");
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });

  test("renders Podcast detail page with voice cast", async ({ page }) => {
    const api = await setupMockApi(page);
    await page.goto("/podcast/101", { waitUntil: "domcontentloaded" });

    // Verify podcast title and cast
    await expect(
      page.getByRole("heading", { name: /L.*Ombre du Doute/i }),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator("body")).toContainText("Richard Darbois");

    api.expectNoErrors();
  });
});
