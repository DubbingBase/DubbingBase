import { createApp, createError, defineEventHandler, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMediaWithVoiceActors: vi.fn(),
  getCharacterProfilePictures: vi.fn(),
  query: Object.fromEntries<string | string[]>([]),
  cache: vi.fn(),
}));

vi.mock("../index", () => ({ useTmdbClient: () => ({}) }));
vi.mock("../cache/http", () => ({
  setPublicCacheHeaders: (_event: unknown, profile: string) => mocks.cache(`public:${profile}`),
  setNoCacheHeaders: () => mocks.cache("no-store"),
}));
vi.mock("../services/media", () => ({
  MediaService: class {
    getMediaWithVoiceActors(...args: unknown[]) {
      return mocks.getMediaWithVoiceActors(...args);
    }
    getCharacterProfilePictures(...args: unknown[]) {
      return mocks.getCharacterProfilePictures(...args);
    }
  },
}));

let handler: typeof import("../../api/character-portraits.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", () => mocks.query);
  handler = (await import("../../api/character-portraits.get")).default;
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.query = { mediaType: "movie", mediaId: "671", lang: "fr-FR" };
  mocks.getMediaWithVoiceActors.mockResolvedValue({ media: { id: 671 } });
  mocks.getCharacterProfilePictures.mockImplementation(async () => {
    return {
      characters: [
        {
          id: 1,
          name: "Ron Weasley",
          image: "https://artworks.thetvdb.com/ron.jpg",
          tvdbPeopleId: 7,
        },
        { id: 2, name: "Harry Potter", image: "javascript:alert(1)", tvdbPeopleId: 8 },
        { id: 3, name: "", image: "https://artworks.thetvdb.com/x.jpg", tvdbPeopleId: 9 },
      ],
      tvdbId: 5671,
    };
  });
});

async function call(): Promise<{ status: number; body: unknown }> {
  const app = createApp();
  app.use("/", handler);
  const response = await toWebHandler(app)(new Request("http://localhost/"));
  return { status: response.status, body: await response.json() };
}

describe("GET /api/character-portraits", () => {
  it("returns the whole cast of one production without per-card data", async () => {
    const { body } = await call();
    expect(body).toEqual({
      tvdbId: 5671,
      characters: [
        { id: "1", name: "Ron Weasley", image: "https://artworks.thetvdb.com/ron.jpg" },
        { id: "2", name: "Harry Potter", image: null },
      ],
      degraded: false,
    });
    expect(mocks.getCharacterProfilePictures).toHaveBeenCalledTimes(1);
    expect(mocks.cache).toHaveBeenCalledWith("public:character-images");
  });

  it("loads TMDB only when the cast is not cached", async () => {
    mocks.getCharacterProfilePictures.mockResolvedValue({ characters: [], tvdbId: null });
    await call();
    expect(mocks.getMediaWithVoiceActors).not.toHaveBeenCalled();
  });

  it("uses the short negative lifetime for an empty cast", async () => {
    mocks.getCharacterProfilePictures.mockResolvedValue({ characters: [], tvdbId: null });
    const { body } = await call();
    expect(body).toMatchObject({ characters: [], degraded: false });
    expect(mocks.cache).toHaveBeenCalledWith("public:character-images-negative");
  });

  it("is never cached when a provider failed", async () => {
    mocks.getCharacterProfilePictures.mockRejectedValue(new Error("TVDB down"));
    const { body } = await call();
    expect(body).toMatchObject({ characters: [], tvdbId: null, degraded: true });
    expect(mocks.cache).toHaveBeenCalledWith("no-store");

    mocks.cache.mockClear();
    mocks.getCharacterProfilePictures.mockResolvedValue({
      characters: [],
      tvdbId: null,
      degraded: true,
    });
    await call();
    expect(mocks.cache).toHaveBeenCalledWith("no-store");
  });

  it("rejects an invalid production", async () => {
    mocks.query = { mediaType: "game", mediaId: "671" };
    expect((await call()).status).toBe(400);
    mocks.query = { mediaType: "movie", mediaId: "0" };
    expect((await call()).status).toBe(400);
  });
});
