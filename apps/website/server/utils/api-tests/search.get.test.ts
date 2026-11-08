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
  tmdbAlternativeTitles: vi.fn(async (): Promise<string[]> => []),
  tmdbSearch: vi.fn(async (): Promise<{ results: Array<Record<string, unknown>> }> => ({
    results: [],
  })),
  igdbSearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  openLibrarySearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  podcastSearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  advertisementSearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  toySearch: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
  voiceActorSearchFails: false,
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../../utils", () => ({
  useTmdbClient: () => ({
    searchMulti: mocks.tmdbSearch,
    getAlternativeTitles: mocks.tmdbAlternativeTitles,
  }),
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
  mocks.tmdbAlternativeTitles.mockResolvedValue([]);
  mocks.igdbSearch.mockResolvedValue([]);
  mocks.openLibrarySearch.mockResolvedValue([]);
  mocks.podcastSearch.mockResolvedValue([]);
  mocks.advertisementSearch.mockResolvedValue([]);
  mocks.toySearch.mockResolvedValue([]);
  mocks.voiceActorSearchFails = false;

  const voiceActorQuery = {
    select: vi.fn(),
    textSearch: vi.fn(),
    or: vi.fn(),
    limit: vi.fn(async () => ({
      data: [],
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
  it("forwards the trimmed query and active locale, then ranks all exact matches first", async () => {
    mocks.tmdbSearch.mockImplementation(async () => ({
      results: [
        { id: 30, media_type: "person", name: "C#", popularity: 100_000 },
        { id: 12, media_type: "person", name: "C++", popularity: 1 },
        { id: 11, media_type: "person", name: "C++", popularity: 0 },
      ],
    }));

    const response = await request("/?query=%20C%2B%2B%20&locale=fr");
    const results: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.tmdbSearch).toHaveBeenCalledWith("C++", 1, "fr-FR");
    expect(mocks.tmdbSearch).toHaveBeenCalledWith("C++", 2, "fr-FR");
    expect(results).toEqual([
      expect.objectContaining({ id: 12, name: "C++" }),
      expect.objectContaining({ id: 11, name: "C++" }),
      expect.objectContaining({ id: 30, name: "C#" }),
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

  // Recorded 2026-11-08: search/multi returns movie 406994 first for both queries.
  const tmdbWatchOut = () => ({
    results: [
      {
        id: 406994,
        media_type: "movie",
        title: "Better Watch Out",
        release_date: "2017-10-06",
        popularity: 3.0034,
        vote_average: 6.5,
        vote_count: 1725,
      },
      {
        id: 1079890,
        media_type: "movie",
        title: "Watch Out",
        release_date: "2023-01-01",
        popularity: 0.0329,
        vote_count: 0,
      },
      {
        id: 74864,
        media_type: "movie",
        title: "Watch Out",
        release_date: "2008-01-01",
        popularity: 0.2418,
        vote_count: 6,
      },
      {
        id: 324234,
        media_type: "movie",
        title: "You Better Watch Out!",
        release_date: "2013-01-01",
        popularity: 0.7385,
        vote_count: 1,
      },
    ],
  });

  it("surfaces a movie through its TMDB alias alongside other exact titles", async () => {
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1 ? tmdbWatchOut() : { results: [] },
    );
    mocks.tmdbAlternativeTitles.mockImplementation(async (_type: string, id: number) =>
      id === 406994 ? ["Safe Neighborhood", "Watch Out"] : [],
    );

    const response = await request("/?query=Watch%20Out&locale=en");
    const results: Array<Record<string, unknown>> = await response.json();

    expect(results.slice(0, 3).map(({ id }) => id)).toEqual([406994, 1079890, 74864]);
    expect(results.every((item) => !("alternative_titles" in item))).toBe(true);
    // Bounded: only non-exact movie/TV candidates, never the exact-title records.
    expect(mocks.tmdbAlternativeTitles.mock.calls.map(([, id]) => id).sort()).toEqual([
      324234, 406994,
    ]);
  });

  it("still ranks results when alias lookups fail or time out", async () => {
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1 ? tmdbWatchOut() : { results: [] },
    );
    mocks.tmdbAlternativeTitles.mockRejectedValue(new Error("TMDB unavailable"));

    const response = await request("/?query=Watch%20Out");
    const results: Array<Record<string, unknown>> = await response.json();

    expect(response.status).toBe(200);
    expect(results.map(({ id }) => id).slice(0, 2)).toEqual([1079890, 74864]);
    expect(results.map(({ id }) => id)).toContain(406994);
  });

  it("ranks Better Watch Out above exact-title books from 2024 and 2023", async () => {
    mocks.tmdbSearch.mockImplementation(async (_q: string, page: number) =>
      page === 1 ? tmdbWatchOut() : { results: [] },
    );
    mocks.openLibrarySearch.mockResolvedValue([
      {
        id: 42453480,
        title: "Better Watch Out",
        name: "Better Watch Out",
        release_date: "2024-01-01",
      },
      {
        id: 36848566,
        title: "Better Watch Out",
        name: "Better Watch Out",
        release_date: "2023-01-01",
      },
    ]);

    const response = await request("/?query=Better%20Watch%20Out");
    const results: Array<Record<string, unknown>> = await response.json();

    expect(results.slice(0, 3).map(({ media_type, id }) => `${media_type}:${id}`)).toEqual([
      "movie:406994",
      "audiobook:42453480",
      "audiobook:36848566",
    ]);
    expect(results[0]?.score).toBeGreaterThan(Number(results[1]?.score) + 8);
  });
});
