import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../index", () => ({
  useCache: () => ({
    getOrFetch: (_n: unknown, _k: string, fetcher: () => Promise<unknown>) => fetcher(),
  }),
}));
vi.mock("../with-timeout", () => ({ withTimeout: <T>(promise: Promise<T>) => promise }));

const { getWikimediaCharacterImage } = await import("./wikimedia-character-image");

const FILM = "Q102235";
const entity = (label: string, presentIn: string[], file: string | null) => ({
  labels: { en: { value: label } },
  claims: {
    P1441: presentIn.map((id) => ({ mainsnak: { datavalue: { value: { id } } } })),
    ...(file ? { P18: [{ mainsnak: { datavalue: { value: file } } }] } : {}),
  },
});
const commons = (license: string, extra: Record<string, unknown> = {}) => ({
  query: {
    pages: {
      "1": {
        imageinfo: [
          {
            thumburl: "https://upload.wikimedia.org/thumb/ron.jpg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Ron.jpg",
            extmetadata: {
              LicenseShortName: { value: license },
              Artist: { value: '<a href="x">Jane Photographer</a>' },
              ...extra,
            },
          },
        ],
      },
    },
  },
});

function mockWikimedia(character: unknown, license = "CC BY-SA 4.0", extra = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = url.includes("commons.wikimedia.org")
        ? commons(license, extra)
        : url.includes(`ids=${FILM}`)
          ? {
              entities: {
                [FILM]: {
                  claims: { P674: [{ mainsnak: { datavalue: { value: { id: "Q1" } } } }] },
                },
              },
            }
          : { entities: { Q1: character } };
      return { ok: true, json: async () => body };
    }),
  );
}

const input = {
  contentType: "movie" as const,
  contentId: 671,
  wikidataId: FILM,
  characterName: "Ron Weasley",
  language: "en-US",
};

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));
afterEach(() => vi.unstubAllGlobals());

describe("getWikimediaCharacterImage", () => {
  it("accepts a production-scoped character with a free, attributed file", async () => {
    mockWikimedia(entity("Ron Weasley", [FILM], "Ron.jpg"));
    await expect(getWikimediaCharacterImage(input)).resolves.toEqual({
      src: "https://upload.wikimedia.org/thumb/ron.jpg",
      attribution: "Jane Photographer · CC BY-SA 4.0",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Ron.jpg",
    });
  });

  it("rejects a generic character that appears in several productions", async () => {
    mockWikimedia(entity("Ron Weasley", [FILM, "Q999"], "Ron.jpg"));
    await expect(getWikimediaCharacterImage(input)).resolves.toBeNull();
  });

  it("rejects a different character name", async () => {
    mockWikimedia(entity("Harry Potter", [FILM], "Harry.jpg"));
    await expect(getWikimediaCharacterImage(input)).resolves.toBeNull();
  });

  it("rejects rights-unclear or non-free files", async () => {
    mockWikimedia(entity("Ron Weasley", [FILM], "Ron.jpg"), "All rights reserved");
    await expect(getWikimediaCharacterImage(input)).resolves.toBeNull();
    mockWikimedia(entity("Ron Weasley", [FILM], "Ron.jpg"), "CC BY 4.0", {
      NonFree: { value: "true" },
    });
    await expect(getWikimediaCharacterImage(input)).resolves.toBeNull();
  });

  it("returns null on provider outage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    await expect(getWikimediaCharacterImage(input)).resolves.toBeNull();
  });
});

describe("license filter", () => {
  it.each(["CC BY-NC 4.0", "CC BY-ND 4.0", "CC BY-NC-SA 4.0"])("rejects %s", async (license) => {
    mockWikimedia(entity("Ron Weasley", [FILM], "Ron.jpg"), license);
    await expect(getWikimediaCharacterImage(input)).resolves.toBeNull();
  });
});
