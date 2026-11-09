import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  toWebHandler,
  type EventHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  tmdbSearch: vi.fn(async (): Promise<{ results: Array<Record<string, unknown>> }> => ({
    results: [],
  })),
  igdbSearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  openLibrarySearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  podcastSearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  advertisementSearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  toySearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  voiceActorSearchFails: false,
  voiceActors: new Array<Record<string, unknown>>(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../../utils", () => ({
  useTmdbClient: () => ({ searchMulti: mocks.tmdbSearch }),
  useIgdbClient: () => ({ searchGames: mocks.igdbSearch }),
  useOpenLibraryClient: () => ({ searchBooks: mocks.openLibrarySearch }),
  usePodcastClient: () => ({ searchPodcasts: mocks.podcastSearch }),
  useAdvertisementClient: () => ({ searchAdvertisements: mocks.advertisementSearch }),
  useToyClient: () => ({ searchToys: mocks.toySearch }),
}));

vi.mock("../../utils/db/client", () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }));
vi.mock("../../utils/api/igdb", () => ({ buildIgdbImageUrl: (id: string) => id }));
vi.mock("../../utils/urls/tmdb", () => ({ processMedia: (item: unknown) => item }));
vi.mock("../../utils/urls/supabase", () => ({ buildSupabaseImageUrl: (path: string) => path }));

let handler: EventHandler;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../../api/search/index.get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tmdbSearch.mockResolvedValue({ results: [] });
  mocks.igdbSearch.mockResolvedValue([]);
  mocks.openLibrarySearch.mockResolvedValue([]);
  mocks.podcastSearch.mockResolvedValue([]);
  mocks.advertisementSearch.mockResolvedValue([]);
  mocks.toySearch.mockResolvedValue([]);
  mocks.voiceActorSearchFails = false;
  mocks.voiceActors = [];

  const voiceActorQuery = {
    select: vi.fn(),
    textSearch: vi.fn(),
    or: vi.fn(),
    limit: vi.fn(async () => ({
      data: mocks.voiceActors,
      error: mocks.voiceActorSearchFails ? { message: "database unavailable" } : null,
    })),
  };
  voiceActorQuery.select.mockReturnValue(voiceActorQuery);
  voiceActorQuery.textSearch.mockReturnValue(voiceActorQuery);
  voiceActorQuery.or.mockReturnValue(voiceActorQuery);
  mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => voiceActorQuery) });
});

afterAll(() => vi.unstubAllGlobals());

async function request(path: string): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(new Request(`http://localhost${path}`));
}

describe("global search response", () => {
  it("forwards the trimmed query and locale, then keeps TMDB's own order", async () => {
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1
        ? {
            results: [
              { id: 30, media_type: "person", name: "C#", popularity: 100_000 },
              { id: 12, media_type: "person", name: "C++", popularity: 1 },
              { id: 11, media_type: "person", name: "C++", popularity: 0 },
            ],
          }
        : { results: [] },
    );

    const response = await request("/?query=%20C%2B%2B%20&locale=fr");
    const results: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.tmdbSearch).toHaveBeenCalledWith("C++", 1, "fr-FR");
    expect(mocks.tmdbSearch).toHaveBeenCalledWith("C++", 2, "fr-FR");
    expect(results).toEqual([
      expect.objectContaining({ id: 30 }),
      expect.objectContaining({ id: 12 }),
      expect.objectContaining({ id: 11 }),
    ]);
  });

  it("preserves the full default shape and the search-page projection", async () => {
    mocks.tmdbSearch.mockResolvedValue({
      results: [
        {
          id: 8,
          media_type: "person",
          name: "Amélie",
          profile_path: "/amelie.jpg",
          provider_private_field: "kept for existing callers",
        },
      ],
    });

    const full = await request("/?query=Amelie");
    const projected = await request("/?query=Amelie&projection=search-page");

    expect(await full.json()).toEqual([
      expect.objectContaining({ provider_private_field: "kept for existing callers" }),
    ]);
    expect(await projected.json()).toEqual([
      expect.objectContaining({
        id: 8,
        media_type: "person",
        name: "Amélie",
        profile_path: "/amelie.jpg",
      }),
    ]);
  });

  it("keeps partial results available and reports total provider failure", async () => {
    mocks.tmdbSearch.mockRejectedValue(new Error("TMDB unavailable"));

    const partial = await request("/?query=Example");

    expect(partial.status).toBe(200);

    mocks.igdbSearch.mockRejectedValue(new Error("IGDB unavailable"));
    mocks.openLibrarySearch.mockRejectedValue(new Error("OpenLibrary unavailable"));
    mocks.podcastSearch.mockRejectedValue(new Error("Podcast provider unavailable"));
    mocks.advertisementSearch.mockRejectedValue(new Error("Advertisement provider unavailable"));
    mocks.toySearch.mockRejectedValue(new Error("Toy provider unavailable"));
    mocks.voiceActorSearchFails = true;

    const totalFailure = await request("/?query=Example");

    expect(totalFailure.status).toBe(503);
  });

  // Recorded 2026-11-08: search/multi returns movie 406994 first for "Watch Out".
  const tmdbWatchOut = () => ({
    results: [
      {
        id: 406994,
        media_type: "movie",
        title: "Better Watch Out",
        release_date: "2017-10-06",
        popularity: 3.0034,
        vote_count: 1725,
      },
      {
        id: 109693,
        media_type: "tv",
        name: "Watch Out Boss",
        first_air_date: "2018-01-01",
        popularity: 1.8628,
      },
      {
        id: 322957,
        media_type: "movie",
        title: "Watch Out",
        release_date: "1953-01-01",
        popularity: 0.3954,
      },
    ],
  });
  const book = (id: number, title: string) => ({
    id,
    title,
    name: title,
    release_date: "2024-01-01",
  });

  it("ranks the provider's first hit first even when its title is an alias", async () => {
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1 ? tmdbWatchOut() : { results: [] },
    );
    mocks.openLibrarySearch.mockResolvedValue([book(1, "Watch Out"), book(2, "Watch Out Again")]);

    const results: Array<Record<string, unknown>> = await (
      await request("/?query=Watch%20Out")
    ).json();

    // Interleaved by position and weight: movie/tv #0-#2 vs books #0-#1 at weight 0.4.
    expect(results.map(({ media_type, id }) => `${media_type}:${id}`)).toEqual([
      "movie:406994",
      "tv:109693",
      "movie:322957",
      "audiobook:1",
      "audiobook:2",
    ]);
  });

  it("makes no extra provider calls and never returns the internal position", async () => {
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1 ? tmdbWatchOut() : { results: [] },
    );

    for (const path of ["/?query=Watch%20Out", "/?query=Watch%20Out&projection=search-page"]) {
      const results: Array<Record<string, unknown>> = await (await request(path)).json();
      expect(results.every((entry) => !("provider_rank" in entry))).toBe(true);
      expect(results.every((entry) => typeof entry.score === "number")).toBe(true);
    }
    expect(mocks.tmdbSearch).toHaveBeenCalledTimes(4);
  });

  it("weights media types: voice actors, then movies and shows, games, people, books", async () => {
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1
        ? {
            results: [
              { id: 1, media_type: "movie", title: "Example" },
              { id: 2, media_type: "person", name: "Example" },
            ],
          }
        : { results: [] },
    );
    mocks.igdbSearch.mockResolvedValue([{ id: 5, name: "Example" }]);
    mocks.openLibrarySearch.mockResolvedValue([book(7, "Example")]);
    mocks.voiceActors = [
      { id: 9, firstname: "Example", lastname: "Actor", voice_actor_name: "Example Actor" },
    ];

    const results: Array<Record<string, unknown>> = await (await request("/?query=Example")).json();

    expect(results.map(({ media_type, id }) => `${media_type}:${id}`)).toEqual([
      "voice_actor:9",
      "movie:1",
      "video_game:5",
      "person:2",
      "audiobook:7",
    ]);
  });

  it("keeps the best TMDB position when the same movie is returned on both pages", async () => {
    const hit = { id: 406994, media_type: "movie", title: "Better Watch Out" };
    const other = { id: 2, media_type: "movie", title: "Other" };
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1 ? { results: [{ ...other }, { ...hit }] } : { results: [{ ...hit }] },
    );

    const results: Array<Record<string, unknown>> = await (
      await request("/?query=Watch%20Out")
    ).json();

    expect(results.map(({ id }) => id)).toEqual([2, 406994]);
    expect(results[1]?.score).toBeCloseTo(1 / 6);
  });

  it("still ranks other providers when TMDB fails", async () => {
    mocks.tmdbSearch.mockRejectedValue(new Error("TMDB unavailable"));
    mocks.openLibrarySearch.mockResolvedValue([book(7, "Better Watch Out"), book(8, "Another")]);

    const response = await request("/?query=Better%20Watch%20Out");
    const results: Array<Record<string, unknown>> = await response.json();

    expect(response.status).toBe(200);
    expect(results.map(({ id }) => id)).toEqual([7, 8]);
  });
});
