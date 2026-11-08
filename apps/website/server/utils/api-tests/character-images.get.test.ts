import { createApp, createError, defineEventHandler, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { isRecord, readProperty } from "@app/shared-logic";

const mocks = vi.hoisted(() => ({
  getMediaWithVoiceActors: vi.fn(),
  getCharacterProfilePictures: vi.fn(),
  getWikimediaCharacterImage: vi.fn(),
  query: Object.fromEntries<string | string[]>([]),
  cache: vi.fn(),
}));

vi.mock("../index", () => ({ useTmdbClient: () => ({}) }));
vi.mock("../cache/http", () => ({
  setPublicCacheHeaders: () => mocks.cache("public"),
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
vi.mock("../services/wikimedia-character-image", () => ({
  getWikimediaCharacterImage: mocks.getWikimediaCharacterImage,
}));

let handler: typeof import("../../api/character-images.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", () => mocks.query);
  vi.stubGlobal("setHeader", () => undefined);
  vi.stubGlobal("removeResponseHeader", () => undefined);
  handler = (await import("../../api/character-images.get")).default;
});
afterAll(() => vi.unstubAllGlobals());

const RON_1 = "movie:671:Ron Weasley";
const RON_2 = "movie:672:Ron Weasley";

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.query = { item: [RON_1, RON_2] };
  mocks.getMediaWithVoiceActors.mockImplementation(async (_type: string, id: number) => ({
    media: { id, external_ids: { wikidata_id: `Q${id}` } },
  }));
  mocks.getCharacterProfilePictures.mockImplementation(async (_t: string, id: number) => ({
    characters: [
      { id: id + 1000, name: "Ron Weasley", image: `https://artworks.thetvdb.com/ron-${id}.jpg` },
    ],
    tvdbId: id + 5000,
  }));
  mocks.getWikimediaCharacterImage.mockResolvedValue(null);
});

async function call(): Promise<unknown> {
  const app = createApp();
  app.use("/", handler);
  const response = await toWebHandler(app)(new Request("http://localhost/"));
  const body: unknown = await response.json();
  return body;
}

function imageKeys(body: unknown): string[] {
  const images = readProperty(body, "images");
  return isRecord(images) ? Object.keys(images) : [];
}

describe("GET /api/character-images", () => {
  it("resolves each Ron Weasley movie from its own TVDB record, one lookup per production", async () => {
    expect(await call()).toEqual({
      images: {
        [RON_1]: {
          src: "https://artworks.thetvdb.com/ron-671.jpg",
          source: "tvdb",
        },
        [RON_2]: {
          src: "https://artworks.thetvdb.com/ron-672.jpg",
          source: "tvdb",
        },
      },
      characterIds: { [RON_1]: "1671", [RON_2]: "1672" },
      tvdbIds: { "movie:671": 5671, "movie:672": 5672 },
    });
    expect(mocks.getWikimediaCharacterImage).not.toHaveBeenCalled();
    expect(mocks.getCharacterProfilePictures).toHaveBeenCalledTimes(2);
  });

  it("shares one production lookup between several cards of that production", async () => {
    mocks.query = { item: ["movie:671:Ron Weasley", "movie:671:Harry Potter"] };
    await call();
    expect(mocks.getMediaWithVoiceActors).toHaveBeenCalledTimes(1);
    expect(mocks.getCharacterProfilePictures).toHaveBeenCalledTimes(1);
  });

  it("falls back to Wikimedia when TVDB has no match, and to null last", async () => {
    mocks.getCharacterProfilePictures.mockResolvedValue({ characters: [], tvdbId: null });
    mocks.getWikimediaCharacterImage.mockImplementation(
      async ({ contentId }: { contentId: number }) =>
        contentId === 671
          ? {
              src: "https://upload.wikimedia.org/a.jpg",
              attribution: "A · CC0",
              sourceUrl: "https://c/a",
            }
          : null,
    );
    expect(await call()).toEqual({
      images: {
        [RON_1]: {
          src: "https://upload.wikimedia.org/a.jpg",
          attribution: "A · CC0",
          sourceUrl: "https://c/a",
          source: "wikimedia",
        },
        [RON_2]: null,
      },
      characterIds: {},
      tvdbIds: {},
    });
    expect(mocks.getWikimediaCharacterImage).toHaveBeenCalledWith(
      expect.objectContaining({ characterName: "Ron Weasley", wikidataId: "Q671" }),
    );
  });

  it("skips a source whose image failed to load", async () => {
    mocks.query = { item: [RON_1], skip: "tvdb" };
    await call();
    expect(mocks.getCharacterProfilePictures).not.toHaveBeenCalled();
    expect(mocks.getWikimediaCharacterImage).toHaveBeenCalledTimes(1);
  });

  it("returns placeholders when all providers fail", async () => {
    mocks.getCharacterProfilePictures.mockRejectedValue(new Error("TVDB down"));
    mocks.getWikimediaCharacterImage.mockRejectedValue(new Error("Wikimedia down"));
    expect(await call()).toEqual({
      images: { [RON_1]: null, [RON_2]: null },
      characterIds: {},
      tvdbIds: {},
    });
    mocks.getMediaWithVoiceActors.mockRejectedValue(new Error("TMDB down"));
    expect(await call()).toEqual({
      images: { [RON_1]: null, [RON_2]: null },
      characterIds: {},
      tvdbIds: {},
    });
  });

  it("keeps a TVDB role without image linkable and still falls back to Wikimedia", async () => {
    mocks.query = { item: [RON_1] };
    mocks.getCharacterProfilePictures.mockResolvedValue({
      characters: [{ id: 7, name: "Ron Weasley", image: null }],
      tvdbId: 1,
    });
    expect(await call()).toMatchObject({
      images: { [RON_1]: null },
      characterIds: { [RON_1]: "7" },
    });
    expect(mocks.getWikimediaCharacterImage).toHaveBeenCalledTimes(1);
  });

  it("is publicly cacheable only when no provider failed", async () => {
    await call();
    expect(mocks.cache).toHaveBeenLastCalledWith("public");
    mocks.getCharacterProfilePictures.mockRejectedValue(new Error("TVDB down"));
    await call();
    expect(mocks.cache).toHaveBeenLastCalledWith("no-store");
  });

  it("bounds, validates and deduplicates requested items", async () => {
    mocks.query = {
      item: [
        "movie:1:A",
        "movie:1:A",
        "bad:2:A",
        "tv:x:A",
        "movie:3",
        ...Array.from({ length: 40 }, (_, index) => `tv:${index + 10}:Role`),
      ],
    };
    const keys = imageKeys(await call());
    expect(keys).toHaveLength(24);
    expect(keys).not.toContain("bad:2:A");
  });
});
