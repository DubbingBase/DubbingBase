import { Page, expect } from "@playwright/test";
import {
  MOCK_VOICE_ACTOR,
  MOCK_MOVIE,
  MOCK_SHOW,
  MOCK_SEASON,
  MOCK_EPISODE,
  MOCK_GAME,
  MOCK_AUDIOBOOK,
  MOCK_PODCAST,
  MOCK_ACTOR,
  MOCK_STUDIO,
  MOCK_SEARCH_RESULTS,
  MOCK_HOME_DATA,
} from "../fixtures/mock-data";

export interface MockApiOptions {
  voiceActor?: typeof MOCK_VOICE_ACTOR;
  movie?: typeof MOCK_MOVIE;
  show?: typeof MOCK_SHOW;
  season?: typeof MOCK_SEASON;
  episode?: typeof MOCK_EPISODE;
  game?: typeof MOCK_GAME;
  audiobook?: typeof MOCK_AUDIOBOOK;
  podcast?: typeof MOCK_PODCAST;
  actor?: typeof MOCK_ACTOR;
  studio?: typeof MOCK_STUDIO;
  searchResults?: typeof MOCK_SEARCH_RESULTS;
  searchStatus?: (query: string, attempt: number) => number | undefined;
}

export async function waitForVueHydration(page: Page): Promise<void> {
  await expect(page.locator('button[aria-label="Toggle theme"]')).toBeVisible({
    timeout: 30000,
  });
}

export function mockSeasonPageResponse(season: typeof MOCK_SEASON) {
  return {
    ...season,
    dubbingProjects: season.dubbingProjects.map((project) => {
      const works = project.works || project.work || [];
      const voiceActorIds = new Set(
        works.flatMap((work) => {
          const id = work.voice_actor?.id || work.voice_actors?.id || work.voice_actor_id;
          return id ? [id] : [];
        }),
      );
      return {
        id: project.id,
        language: project.language,
        studio_data: project.studio_data || project.studios || null,
        has_voice_actor: voiceActorIds.size > 0,
        voice_actor_count: voiceActorIds.size,
        work_count: works.length,
      };
    }),
  };
}

export function mockEpisodePageResponse(episode: typeof MOCK_EPISODE) {
  const dubbingProjects = episode.dubbingProjects.map((project) => {
    const works = project.works || project.work || [];
    return {
      id: project.id,
      language: project.language,
      studio_data: project.studio_data || project.studios || null,
      workCount: works.length,
      voiceActorCount: new Set(
        works.flatMap((work) => {
          const id = work.voice_actor?.id || work.voice_actors?.id || work.voice_actor_id;
          return id ? [id] : [];
        }),
      ).size,
      works: works.map((work) => {
        const actor = work.voice_actor || work.voice_actors;
        return {
          id: work.id,
          actor_id: work.actor_id,
          character_name: work.character_name,
          note: work.note,
          voice_actor_id: actor?.id || work.voice_actor_id || null,
        };
      }),
    };
  });
  const voiceActors = new Map<
    number,
    {
      id: number;
      firstname?: string;
      lastname?: string;
      profile_picture?: string | null;
    }
  >();
  for (const project of episode.dubbingProjects) {
    for (const work of project.works || project.work || []) {
      const actor = work.voice_actor || work.voice_actors;
      if (actor?.id) voiceActors.set(actor.id, actor);
    }
  }
  const activeProject = dubbingProjects[0];
  return {
    ...episode,
    dubbingProjects: dubbingProjects.map(({ works: _works, ...project }) => project),
    voiceActors: Array.from(voiceActors.values()),
    activeProjectId: activeProject?.id ?? null,
    activeProjectWorks: activeProject?.works ?? [],
  };
}

export async function setupMockApi(page: Page, options: MockApiOptions = {}) {
  const errors: string[] = [];
  let searchRequestCount = 0;

  // Track uncaught page errors
  page.on("pageerror", (err) => {
    // Ignore harmless known warnings/aborts
    const message = err.message || "";
    if (!message.includes("ResizeObserver loop") && !message.includes("posthog")) {
      errors.push(message);
    }
  });

  // Intercept and route /api/** endpoints to provide deterministic, ultra-fast mock data
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    const pageVoiceActor = (data: typeof MOCK_VOICE_ACTOR) => ({
      ...data,
      workCount: data.voiceActor.work.length,
      voiceActor: { ...data.voiceActor, work: [] },
      enhancedWorks: data.enhancedWorks.map(({ media, ...work }) => ({
        ...work,
        media_id: media.id,
        media_type: media.media_type || "movie",
      })),
      medias: data.enhancedWorks.map(({ media }) => ({
        ...media,
        media_type: media.media_type || "movie",
      })),
    });

    const pageProjects = (projects: typeof MOCK_MOVIE.dubbingProjects) => {
      const voiceActors = new Map<
        number,
        NonNullable<(typeof projects)[number]["works"][number]["voice_actor"]>
      >();
      const dubbingProjects = projects.map((project) => ({
        id: project.id,
        language: project.language,
        studio_data: project.studio_data || project.studios || null,
        works: (project.works || []).map((work) => {
          const actor = work.voice_actor;
          if (actor?.id) voiceActors.set(actor.id, actor);
          return {
            id: work.id,
            actor_id: work.actor_id,
            character_name: work.character_name,
            note: work.note,
            voice_actor_id: actor?.id ?? work.voice_actor_id ?? null,
          };
        }),
      }));
      return { dubbingProjects, voiceActors: Array.from(voiceActors.values()) };
    };
    const mediaSummaries = (
      projects: Array<{
        id: number;
        language: string;
        studio_data?: {
          id: number;
          name: string;
          logo_url?: string | null;
        } | null;
        studios?: { id: number; name: string; logo_url?: string | null } | null;
        works: Array<{ voice_actor?: { id: number } | null }>;
      }>,
    ) =>
      projects.map((project) => ({
        id: project.id,
        language: project.language,
        studio_data: project.studio_data || project.studios || null,
        has_voice_actor: project.works.some((work) => Boolean(work.voice_actor?.id)),
        voice_actor_count: new Set(
          project.works.flatMap((work) => (work.voice_actor?.id ? [work.voice_actor.id] : [])),
        ).size,
        work_count: project.works.length,
        crew: [],
      }));
    const mediaCastResponse = (
      works: Array<{
        id: number;
        voice_actor_id?: number;
        character_name?: string;
        performance?: string;
        note?: string;
        voice_actor?: {
          id?: number;
          firstname?: string;
          lastname?: string;
          profile_picture?: string | null;
        };
      }>,
    ) => {
      const data = works.map((work) => ({
        work_id: work.id,
        voice_actor_id: work.voice_actor?.id || work.voice_actor_id,
        firstname: work.voice_actor?.firstname || "",
        lastname: work.voice_actor?.lastname || "",
        character_name: work.character_name || "",
        performance: work.performance || "",
        note: work.note || "",
        profile_picture: work.voice_actor?.profile_picture || null,
      }));
      const query = (url.searchParams.get("query") || "").toLowerCase();
      const filtered = query
        ? data.filter((item) =>
            `${item.firstname} ${item.lastname} ${item.character_name} ${item.performance}`
              .toLowerCase()
              .includes(query),
          )
        : data;
      const pageSize = Math.min(Number(url.searchParams.get("pageSize")) || 12, 48);
      const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
      const page = Math.min(Number(url.searchParams.get("page")) || 1, totalPages);
      return {
        data: filtered.slice((page - 1) * pageSize, page * pageSize),
        pagination: { page, pageSize, totalItems: filtered.length, totalPages },
      };
    };

    // 1. Voice Actor Detail
    if (path.startsWith("/api/voice-actor/")) {
      const vaData = options.voiceActor || MOCK_VOICE_ACTOR;
      const response =
        url.searchParams.get("projection") === "page" ? pageVoiceActor(vaData) : vaData;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    }

    // 2. Movie Detail
    if (path.startsWith("/api/movie/")) {
      const movieData = options.movie || MOCK_MOVIE;
      const response =
        url.searchParams.get("projection") === "media-page"
          ? { ...movieData, ...pageProjects(movieData.dubbingProjects) }
          : movieData;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    }

    // 3. Show / Series Detail
    if (path.startsWith("/api/show/")) {
      const showData = options.show || MOCK_SHOW;
      const response =
        url.searchParams.get("projection") === "media-page"
          ? { ...showData, ...pageProjects(showData.dubbingProjects) }
          : showData;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    }

    if (path === "/api/season") {
      const seasonData = options.season || MOCK_SEASON;
      const projects = mediaSummaries(MOCK_SHOW.dubbingProjects);
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          url.searchParams.get("projection") === "media-page"
            ? { ...seasonData, dubbingProjects: projects }
            : seasonData,
        ),
      });
    }

    if (path === "/api/episode") {
      const episodeData = options.episode || MOCK_EPISODE;
      const pageData = pageProjects(MOCK_SHOW.dubbingProjects);
      const active = pageData.dubbingProjects[0];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          url.searchParams.get("projection") === "episode-page"
            ? {
                ...episodeData,
                dubbingProjects: active
                  ? [
                      {
                        id: active.id,
                        language: active.language,
                        studio_data: active.studio_data,
                        workCount: active.works.length,
                        voiceActorCount: pageData.voiceActors.length,
                      },
                    ]
                  : [],
                voiceActors: pageData.voiceActors,
                activeProjectId: active?.id ?? null,
                activeProjectWorks: active?.works ?? [],
              }
            : episodeData,
        ),
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
      const response =
        url.searchParams.get("projection") === "media-summary"
          ? {
              ...audiobookData,
              dubbingProjects: mediaSummaries(audiobookData.dubbingProjects),
            }
          : audiobookData;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    }

    // 6. Podcast Detail
    if (path.startsWith("/api/podcast/")) {
      const podcastData = options.podcast || MOCK_PODCAST;
      const response =
        url.searchParams.get("projection") === "media-summary"
          ? {
              ...podcastData,
              dubbingProjects: mediaSummaries(podcastData.dubbingProjects),
            }
          : podcastData;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(response),
      });
    }

    if (path === "/api/detail-collections" && url.searchParams.get("collection") === "media-cast") {
      const type = url.searchParams.get("type");
      const projectId = Number(url.searchParams.get("projectId"));
      const projects =
        type === "audiobook"
          ? (options.audiobook || MOCK_AUDIOBOOK).dubbingProjects
          : type === "podcast"
            ? (options.podcast || MOCK_PODCAST).dubbingProjects
            : [];
      const project = projects.find((item: { id: number }) => item.id === projectId) || projects[0];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mediaCastResponse(project?.works || [])),
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
      const status = options.searchStatus?.(
        url.searchParams.get("query") || "",
        searchRequestCount++,
      );
      if (status && status !== 200) {
        return route.fulfill({ status, contentType: "application/json", body: "{}" });
      }
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

    if (path.includes("/api/top-contributors")) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
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
