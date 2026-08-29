import { Page, expect } from "@playwright/test";
import {
  MOCK_VOICE_ACTOR,
  MOCK_MOVIE,
  MOCK_SHOW,
  MOCK_GAME,
  MOCK_AUDIOBOOK,
  MOCK_PODCAST,
  MOCK_ACTOR,
  MOCK_STUDIO,
  MOCK_SEARCH_RESULTS,
  MOCK_HOME_DATA,
} from "../fixtures/mock-data";

export interface MockApiOptions {
  voiceActor?: any;
  movie?: any;
  show?: any;
  game?: any;
  audiobook?: any;
  podcast?: any;
  actor?: any;
  studio?: any;
  searchResults?: any[];
}

export async function setupMockApi(page: Page, options: MockApiOptions = {}) {
  const errors: string[] = [];

  // Track uncaught page errors
  page.on("pageerror", (err) => {
    // Ignore harmless known warnings/aborts
    const message = err.message || "";
    if (
      !message.includes("ResizeObserver loop") &&
      !message.includes("posthog")
    ) {
      errors.push(message);
    }
  });

  // Intercept and route /api/** endpoints to provide deterministic, ultra-fast mock data
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    // 1. Voice Actor Detail
    if (path.startsWith("/api/voice-actor/")) {
      const vaData = options.voiceActor || MOCK_VOICE_ACTOR;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(vaData),
      });
    }

    // 2. Movie Detail
    if (path.startsWith("/api/movie/")) {
      const movieData = options.movie || MOCK_MOVIE;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(movieData),
      });
    }

    // 3. Show / Series Detail
    if (path.startsWith("/api/show/")) {
      const showData = options.show || MOCK_SHOW;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(showData),
      });
    }

    // 4. Video Game Detail
    if (path.startsWith("/api/game/")) {
      const gameData = options.game || MOCK_GAME;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(gameData),
      });
    }

    // 5. Audiobook Detail
    if (path.startsWith("/api/audiobook/")) {
      const audiobookData = options.audiobook || MOCK_AUDIOBOOK;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(audiobookData),
      });
    }

    // 6. Podcast Detail
    if (path.startsWith("/api/podcast/")) {
      const podcastData = options.podcast || MOCK_PODCAST;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(podcastData),
      });
    }

    // 7. Original Actor Detail
    if (path.startsWith("/api/actor/")) {
      const actorData = options.actor || MOCK_ACTOR;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(actorData),
      });
    }

    // 8. Studio Details
    if (path.includes("/api/get-studio-details")) {
      const studioData = options.studio || MOCK_STUDIO;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(studioData),
      });
    }

    // 9. Search API
    if (path.startsWith("/api/search")) {
      const results = options.searchResults || MOCK_SEARCH_RESULTS;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(results),
      });
    }

    // 10. Trending & Home APIs
    if (path.includes("/api/trending/movies")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HOME_DATA.trendingMovies),
      });
    }
    if (path.includes("/api/trending/shows")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HOME_DATA.trendingShows),
      });
    }
    if (path.includes("/api/trending/games")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HOME_DATA.trendingGames),
      });
    }
    if (
      path.includes("/api/trending/voice-actors") ||
      path.includes("/api/top-voice-actors") ||
      path.includes("/api/recent-voice-actors")
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HOME_DATA.topVoiceActors),
      });
    }

    // 11. Home stats
    if (path.includes("/api/home-stats")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          voice_actors: 2500,
          dubbing_projects: 8500,
          contributions: 12000,
        }),
      });
    }

    // Default passthrough or empty object
    return route.continue();
  });

  return {
    getErrors: () => errors,
    expectNoErrors: () => {
      const criticalErrors = errors.filter(
        (e) =>
          !e.includes("Cannot redefine property: imgEl") &&
          !e.includes("posthog") &&
          !e.includes("net::ERR_"),
      );
      expect(criticalErrors).toEqual([]);
    },
  };
}
