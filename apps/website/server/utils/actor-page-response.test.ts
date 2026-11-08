import {
  createApp,
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParam,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyCachePolicy, applyDefaultCachePolicy } from "./cache/response-policy";
import {
  getCloudflareCacheControl,
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
} from "./cache/http";

const mocks = vi.hoisted(() => ({
  getPersonWithCredits: vi.fn(),
  fetchMediaSummary: vi.fn(),
  getWorkByActor: vi.fn(),
  getActorPageWorkByActor: vi.fn(),
}));

vi.mock("./index", () => ({ useTmdbClient: () => mocks }));
vi.mock("./db/queries", () => ({
  getWorkByActor: mocks.getWorkByActor,
  getActorPageWorkByActor: mocks.getActorPageWorkByActor,
}));

let handler: typeof import("../api/actor/[id].get").default;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getRouterParam", getRouterParam);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { supabase: { cookiePrefix: "sb-test-auth-token" } },
  }));
  handler = (await import("../api/actor/[id].get")).default;
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPersonWithCredits.mockResolvedValue({
    id: 31,
    name: "Actor",
    biography: "Biography",
    birthday: "1970-01-01",
    deathday: null,
    place_of_birth: "City",
    profile_path: "/actor.png",
    known_for_department: "Acting",
    external_ids: { imdb_id: "provider-id" },
    movie_credits: {
      cast: [
        {
          id: 10,
          title: "Movie",
          character: "Lead",
          poster_path: "/movie.png",
          release_date: "2020-01-01",
          overview: "Unused synopsis",
        },
        {
          id: 11,
          title: "Other movie",
          character: "Other role",
          poster_path: null,
          release_date: "2021-01-01",
        },
      ],
      crew: [{ id: 90, job: "Producer" }],
    },
    tv_credits: {
      cast: [
        {
          id: 20,
          name: "Show",
          character: "Guest",
          poster_path: "/show.png",
          first_air_date: "2022-01-01",
        },
      ],
      crew: [],
    },
  });
  const actorWorkRows = [
    {
      id: 1,
      performance: "Lead",
      suggestions: "Editorial metadata",
      dubbing_projects: {
        id: 100,
        content_id: 10,
        content_type: "movie",
        language: "fr-FR",
      },
      voice_actors: {
        id: 5,
        firstname: "Voice",
        lastname: "One",
        profile_picture: "https://example.com/voice.png",
        bio: "Unused bio",
      },
    },
    {
      id: 2,
      performance: "Guest",
      suggestions: "Other metadata",
      dubbing_projects: {
        id: 101,
        content_id: 20,
        content_type: "tv",
        language: "es-ES",
      },
      voice_actors: null,
    },
  ];
  mocks.getWorkByActor.mockResolvedValue(actorWorkRows);
  mocks.getActorPageWorkByActor.mockResolvedValue(actorWorkRows);
  mocks.fetchMediaSummary.mockImplementation(async (id: number) => ({
    id,
    title: `Media ${id}`,
    original_title: `Original ${id}`,
    poster_path: null,
    release_date: "2020-01-01",
    overview: "Media overview",
  }));
});

async function request(
  projection?: string,
  filmographyPage?: number,
  options: { lang?: string; cachePolicy?: boolean; headers?: Record<string, string> } = {},
) {
  const app = createApp(
    options.cachePolicy
      ? {
          onRequest: applyDefaultCachePolicy,
          onBeforeResponse: (event) =>
            applyCachePolicy(event, { isDev: false, supabaseCookiePrefix: "sb-test-auth-token" }),
        }
      : {},
  );
  const query = new URLSearchParams();
  if (projection) query.set("projection", projection);
  if (options.lang) query.set("lang", options.lang);
  if (filmographyPage !== undefined) query.set("filmographyPage", String(filmographyPage));
  app.use(
    defineEventHandler((event) => {
      event.context.params = { id: "31" };
      return handler(event);
    }),
  );
  return await toWebHandler(app)(
    new Request(`http://localhost/api/actor/31${query.size ? `?${query}` : ""}`, {
      headers: options.headers,
    }),
  );
}

describe("actor page API projection", () => {
  it("caches successful public page projections by explicit language and pagination query", async () => {
    const response = await request("actor-page", 2, {
      lang: "fr-FR",
      cachePolicy: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(getPublicCacheControl("detail-json"));
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      getCloudflareCacheControl("detail-json"),
    );
    expect(mocks.getPersonWithCredits).toHaveBeenCalledWith(31, "fr-FR");
  });

  it("keeps each explicit locale in the response query", async () => {
    await request("actor-page", 1, { lang: "fr-FR", cachePolicy: true });
    await request("actor-page", 1, { lang: "en-US", cachePolicy: true });

    expect(mocks.getPersonWithCredits).toHaveBeenNthCalledWith(1, 31, "fr-FR");
    expect(mocks.getPersonWithCredits).toHaveBeenNthCalledWith(2, 31, "en-US");
  });

  it("does not cache authorized page projections", async () => {
    const response = await request("actor-page", undefined, {
      lang: "fr-FR",
      cachePolicy: true,
      headers: { authorization: "Bearer user-token" },
    });

    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
  });

  it.each([[undefined], ["unsupported"]])(
    "does not cache page projections without a canonical query language (%s)",
    async (lang) => {
      const response = await request("actor-page", undefined, { lang, cachePolicy: true });

      expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
      expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
    },
  );

  it("does not cache an invalid pagination query", async () => {
    const app = createApp({
      onRequest: applyDefaultCachePolicy,
      onBeforeResponse: (event) =>
        applyCachePolicy(event, { isDev: false, supabaseCookiePrefix: "sb-test-auth-token" }),
    });
    app.use(
      defineEventHandler((event) => {
        event.context.params = { id: "31" };
        return handler(event);
      }),
    );
    const response = await toWebHandler(app)(
      new Request(
        "http://localhost/api/actor/31?projection=actor-page&lang=fr-FR&filmographyPage=nope",
      ),
    );

    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
  });

  it("does not cache a structurally incomplete provider response", async () => {
    mocks.getPersonWithCredits.mockResolvedValueOnce({ id: 31, name: "Actor" });

    const response = await request("actor-page", undefined, {
      lang: "fr-FR",
      cachePolicy: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
  });

  it("does not cache when the voice-role query falls back after a database error", async () => {
    mocks.getActorPageWorkByActor.mockRejectedValueOnce(new Error("Database unavailable"));

    const response = await request("actor-page", undefined, {
      lang: "fr-FR",
      cachePolicy: true,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
  });

  it("distinguishes a missing actor from a failed TMDB request", async () => {
    mocks.getPersonWithCredits.mockRejectedValueOnce(new Error("TMDB API error: 404"));
    const missing = await request("actor-page", undefined, {
      lang: "fr-FR",
      cachePolicy: true,
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);

    mocks.getPersonWithCredits.mockRejectedValueOnce(new Error("TMDB API error: 503"));
    const failed = await request("actor-page", undefined, {
      lang: "fr-FR",
      cachePolicy: true,
    });
    expect(failed.status).toBe(502);
    expect(failed.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
  });

  it("preserves the full default API including provider credits and editorial metadata", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      actor: {
        external_ids: { imdb_id: "provider-id" },
        movie_credits: { crew: [{ id: 90 }] },
        credits: { cast: [{ overview: "Unused synopsis" }, {}, {}] },
        voice_roles: [
          {
            suggestions: "Editorial metadata",
            voice_actors: [{ bio: "Unused bio" }],
          },
          {},
        ],
      },
    });
    expect(mocks.getWorkByActor).toHaveBeenCalledOnce();
    expect(mocks.getActorPageWorkByActor).not.toHaveBeenCalled();
  });

  it("preserves complete display, search and language data while omitting duplicate and unused fields", async () => {
    const response = await request("actor-page");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      actor: {
        id: 31,
        name: "Actor",
        biography: "Biography",
        birthday: "1970-01-01",
        deathday: null,
        place_of_birth: "City",
        profile_path: "https://image.tmdb.org/t/p/w500/actor.png",
        backdrop_path: null,
        known_for_department: "Acting",
        credits: {
          cast: [
            {
              id: 10,
              title: "Movie",
              character: "Lead",
              poster_path: "https://image.tmdb.org/t/p/w500/movie.png",
              release_date: "2020-01-01",
              media_type: "movie",
            },
            {
              id: 11,
              title: "Other movie",
              character: "Other role",
              poster_path: null,
              release_date: "2021-01-01",
              media_type: "movie",
            },
            {
              id: 20,
              name: "Show",
              character: "Guest",
              poster_path: "https://image.tmdb.org/t/p/w500/show.png",
              first_air_date: "2022-01-01",
              media_type: "tv",
            },
          ],
        },
        voice_roles: expectedRoles(),
      },
    });
    expect(mocks.getActorPageWorkByActor).toHaveBeenCalledOnce();
    expect(mocks.getWorkByActor).not.toHaveBeenCalled();
  });

  it("counts valid credits and returns only the requested global movie-then-TV page", async () => {
    mocks.getPersonWithCredits.mockResolvedValue({
      id: 31,
      name: "Actor",
      movie_credits: {
        cast: [
          ...Array.from({ length: 13 }, (_, index) => ({
            id: 100 + index,
            title: `Movie ${index + 1}`,
            poster_path: null,
          })),
          { id: 999, title: "Invalid movie", poster_path: 42 },
        ],
      },
      tv_credits: {
        cast: [
          { id: 200, name: "Show one", poster_path: null },
          { id: 201, name: "Show two", poster_path: null },
          { id: 998, name: "Invalid show", profile_path: false },
        ],
      },
    });

    const response = await request("actor-page", 2);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      filmographyCount: 15,
      actor: {
        credits: {
          cast: [
            { id: 112, title: "Movie 13", media_type: "movie" },
            { id: 200, name: "Show one", media_type: "tv" },
            { id: 201, name: "Show two", media_type: "tv" },
          ],
        },
      },
    });

    const outOfRangeResponse = await request("actor-page", 3);
    expect(outOfRangeResponse.status).toBe(200);
    expect(await outOfRangeResponse.json()).toMatchObject({
      filmographyCount: 15,
      actor: { credits: { cast: [] } },
    });
  });

  it("preserves nullable role fields and role ordering in page responses", async () => {
    mocks.getActorPageWorkByActor.mockResolvedValueOnce([
      {
        id: 9,
        performance: null,
        dubbing_projects: null,
        voice_actors: {
          id: 6,
          firstname: "Voice",
          lastname: "Two",
          profile_picture: null,
          bio: "Omitted biography",
        },
        suggestions: "Omitted editorial metadata",
      },
      {
        id: 10,
        performance: "Lead",
        dubbing_projects: { language: "fr-FR", content_id: 10, id: 100 },
        voice_actors: null,
      },
    ]);

    const response = await request("actor-page");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.actor.voice_roles).toEqual([
      {
        id: 9,
        performance: null,
        dubbing_projects: null,
        voice_actors: [{ id: 6, firstname: "Voice", lastname: "Two", profile_picture: null }],
      },
      {
        id: 10,
        performance: "Lead",
        dubbing_projects: { language: "fr-FR", content_id: 10 },
        voice_actors: [],
      },
    ]);
  });

  it("retains the full response for unrecognized projections", async () => {
    const response = await request("other");
    expect(await response.json()).toHaveProperty("actor.movie_credits.crew.0.id", 90);
  });

  it("joins page roles by content id without returning media summaries", async () => {
    mocks.getPersonWithCredits.mockResolvedValueOnce({
      id: 31,
      name: "Actor",
      movie_credits: {
        cast: [
          {
            id: 10,
            title: "Movie",
            original_title: "Original movie",
            release_date: "2020-01-01",
            overview: "Movie synopsis",
            poster_path: "/movie.png",
          },
          {
            id: 20,
            title: "Different movie",
            original_title: "Different movie",
            release_date: "2021-01-01",
            overview: "Other synopsis",
            poster_path: null,
          },
        ],
      },
      tv_credits: {
        cast: [
          {
            id: 20,
            name: "Show",
            original_name: "Original show",
            first_air_date: "2022-01-01",
            overview: "Show synopsis",
            poster_path: "/show.png",
          },
        ],
      },
    });
    const response = await request("actor-page");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      actor: {
        voice_roles: [
          {
            id: 1,
            dubbing_projects: { content_id: 10 },
          },
          {
            id: 2,
            dubbing_projects: { content_id: 20 },
          },
        ],
      },
    });
    expect(mocks.fetchMediaSummary).not.toHaveBeenCalled();
    expect(mocks.getPersonWithCredits).toHaveBeenCalledTimes(1);
  });

  it("retains all role ids without fetching unused media summaries", async () => {
    mocks.getPersonWithCredits.mockResolvedValueOnce({
      id: 31,
      name: "Actor",
      movie_credits: {
        cast: [
          {
            id: 10,
            title: "Movie",
            original_title: "Original movie",
            release_date: "2020-01-01",
            overview: "Movie synopsis",
            poster_path: null,
          },
        ],
      },
      tv_credits: { cast: [{ id: 20, name: "Incomplete show" }] },
    });
    mocks.getActorPageWorkByActor.mockResolvedValueOnce([
      {
        id: 1,
        performance: "Lead",
        dubbing_projects: {
          content_id: 10,
          content_type: "movie",
          language: "fr-FR",
        },
        voice_actors: null,
      },
      {
        id: 2,
        performance: "Guest",
        dubbing_projects: {
          content_id: 20,
          content_type: "tv",
          language: "fr-FR",
        },
        voice_actors: null,
      },
      {
        id: 3,
        performance: "Other voice",
        dubbing_projects: {
          content_id: 20,
          content_type: "tv",
          language: "es-ES",
        },
        voice_actors: null,
      },
      {
        id: 4,
        performance: "Missing title",
        dubbing_projects: {
          content_id: 30,
          content_type: "movie",
          language: "fr-FR",
        },
        voice_actors: null,
      },
    ]);
    const response = await request("actor-page");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      actor: {
        voice_roles: [
          { id: 1, dubbing_projects: { content_id: 10 } },
          { id: 2, dubbing_projects: { content_id: 20 } },
          { id: 3, dubbing_projects: { content_id: 20 } },
          { id: 4, dubbing_projects: { content_id: 30 } },
        ],
      },
    });
    expect(mocks.fetchMediaSummary).not.toHaveBeenCalled();
  });
});

function expectedRoles() {
  return [
    {
      id: 1,
      performance: "Lead",
      dubbing_projects: { language: "fr-FR", content_id: 10 },
      voice_actors: [
        {
          id: 5,
          firstname: "Voice",
          lastname: "One",
          profile_picture: "https://example.com/voice.png",
        },
      ],
    },
    {
      id: 2,
      performance: "Guest",
      dubbing_projects: { language: "es-ES", content_id: 20 },
      voice_actors: [],
    },
  ];
}
