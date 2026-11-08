import { createApp, createError, defineEventHandler, toWebHandler } from "h3";
import { isRecord, readProperty } from "@app/shared-logic";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPersonWithCredits: vi.fn(),
  getMediaWithVoiceActors: vi.fn(),
  getCharacterProfilePictures: vi.fn(),
  getWikimediaCharacterImage: vi.fn(),
  query: Object.fromEntries<string>([]),
}));

vi.mock("../index", () => ({
  useTmdbClient: () => ({ getPersonWithCredits: mocks.getPersonWithCredits }),
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

let handler: typeof import("../../api/actor/[id]/character-images.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", () => mocks.query);
  vi.stubGlobal("getRouterParam", () => "10989");
  vi.stubGlobal("setHeader", () => undefined);
  vi.stubGlobal("removeResponseHeader", () => undefined);
  handler = (await import("../../api/actor/[id]/character-images.get")).default;
});
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.query = { items: "movie:671,movie:672" };
  mocks.getPersonWithCredits.mockResolvedValue({
    movie_credits: {
      cast: [
        { id: 671, character: "Ron Weasley" },
        { id: 672, character: "Ron Weasley" },
      ],
    },
    tv_credits: { cast: [] },
  });
  mocks.getMediaWithVoiceActors.mockImplementation(async (_type: string, id: number) => ({
    media: { id, external_ids: { wikidata_id: `Q${id}` } },
  }));
  mocks.getCharacterProfilePictures.mockImplementation(async (_t: string, id: number) => ({
    characters: [{ name: "Ron Weasley", image: `https://artworks.thetvdb.com/ron-${id}.jpg` }],
  }));
  mocks.getWikimediaCharacterImage.mockResolvedValue(null);
});

function readPath(body: unknown, key: string): Record<string, unknown> | null {
  const value = readProperty(body, key);
  return isRecord(value) ? value : null;
}

async function call() {
  const app = createApp();
  app.use("/", handler);
  const response = await toWebHandler(app)(new Request("http://localhost/"));
  const body: unknown = await response.json();
  return body;
}

describe("GET /api/actor/:id/character-images", () => {
  it("resolves each Ron Weasley movie from its own TVDB record", async () => {
    expect(await call()).toEqual({
      images: {
        "movie:671": { src: "https://artworks.thetvdb.com/ron-671.jpg", source: "tvdb" },
        "movie:672": { src: "https://artworks.thetvdb.com/ron-672.jpg", source: "tvdb" },
      },
    });
    expect(mocks.getWikimediaCharacterImage).not.toHaveBeenCalled();
    expect(mocks.getPersonWithCredits).toHaveBeenCalledTimes(1);
  });

  it("falls back to Wikimedia when TVDB has no match or fails, and to null last", async () => {
    mocks.getCharacterProfilePictures.mockResolvedValue({ characters: [] });
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
        "movie:671": {
          src: "https://upload.wikimedia.org/a.jpg",
          attribution: "A · CC0",
          sourceUrl: "https://c/a",
          source: "wikimedia",
        },
        "movie:672": null,
      },
    });
    expect(mocks.getWikimediaCharacterImage).toHaveBeenCalledWith(
      expect.objectContaining({ characterName: "Ron Weasley", wikidataId: "Q671" }),
    );
  });

  it("skips a source whose image failed to load", async () => {
    mocks.query = { items: "movie:671", skip: "tvdb" };
    await call();
    expect(mocks.getCharacterProfilePictures).not.toHaveBeenCalled();
    expect(mocks.getWikimediaCharacterImage).toHaveBeenCalledTimes(1);
  });

  it("returns placeholders when the actor has no credit, TMDB or all providers fail", async () => {
    mocks.query = { items: "movie:999,movie:671" };
    mocks.getCharacterProfilePictures.mockRejectedValue(new Error("TVDB down"));
    mocks.getWikimediaCharacterImage.mockRejectedValue(new Error("Wikimedia down"));
    expect(await call()).toEqual({ images: { "movie:999": null, "movie:671": null } });
    mocks.getPersonWithCredits.mockRejectedValue(new Error("TMDB down"));
    expect(await call()).toEqual({ images: { "movie:999": null, "movie:671": null } });
  });

  it("bounds, validates and deduplicates requested items", async () => {
    mocks.query = {
      items: [
        "movie:1",
        "movie:1",
        "bad:2",
        "tv:x",
        ...Array.from({ length: 30 }, (_, i) => `tv:${i + 10}`),
      ].join(","),
    };
    const body = await call();
    expect(Object.keys(readPath(body, "images") ?? {})).toHaveLength(12);
  });
});
