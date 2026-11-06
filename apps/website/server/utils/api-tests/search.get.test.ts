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
});
