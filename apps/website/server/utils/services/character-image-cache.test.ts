import { createApp, defineEventHandler, toWebHandler } from "h3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCloudflareKv, useCache } from "../index";
import { TMDBClient } from "../api/tmdb";
import { SimpleCache } from "../cache";
import { MediaService } from "./media";
import { getWikimediaCharacterImage } from "./wikimedia-character-image";

const values = new Map<string, unknown>();
let now = 0;
const expirations = new Map<string, number>();
const writes: Array<{ key: string; ttl: number }> = [];
const kv = {
  get: vi.fn(async (key: string) =>
    (expirations.get(key) ?? Infinity) <= now ? null : (values.get(key) ?? null),
  ),
  put: vi.fn(async (key: string, value: string, options: { expirationTtl: number }) => {
    const parsed: unknown = JSON.parse(value);
    values.set(key, parsed);
    expirations.set(key, now + options.expirationTtl);
    writes.push({ key, ttl: options.expirationTtl });
  }),
};
const event = { context: { cloudflare: { env: { CACHE_KV: kv } } } };
const media = { title: "Fixture", external_ids: { wikidata_id: "Q42" } };
const portrait = { id: 77, name: "Role", image: "https://artworks.thetvdb.com/role.jpg" };
let wikidataStatus = 200;
let tvdbStatus = 200;
let searchData: unknown[] = [];
let characters: unknown[] = [];
let malformed = false;
const requests: URL[] = [];

beforeEach(() => {
  values.clear();
  expirations.clear();
  now = 0;
  writes.length = 0;
  requests.length = 0;
  vi.clearAllMocks();
  wikidataStatus = 200;
  tvdbStatus = 200;
  searchData = [];
  characters = [];
  malformed = false;
  vi.stubGlobal("useEvent", () => event);
  vi.stubGlobal("useRuntimeConfig", () => ({ tvdbApiKey: "fixture", tmdbApiKey: "fixture" }));
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      requests.push(url);
      const wikidata = url.hostname === "www.wikidata.org";
      const status = wikidata ? wikidataStatus : tvdbStatus;
      const body = malformed
        ? { error: { code: "maxlag" } }
        : wikidata
          ? url.searchParams.get("action") === "wbgetclaims"
            ? { claims: {} }
            : { entities: { Q42: { claims: {} } } }
          : url.pathname.endsWith("/login")
            ? { data: { token: "fixture-token" } }
            : url.pathname.endsWith("/search")
              ? { data: searchData }
              : { data: { characters } };
      return new Response(JSON.stringify(body), { status });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function service(language = "en-US") {
  return new MediaService(new TMDBClient(), language);
}
function count(host: string, path?: string): number {
  return requests.filter((url) => url.hostname === host && (!path || url.pathname === path)).length;
}

describe("character image persistent cache and failures", () => {
  it("resolves the Worker event binding and reuses a persisted value across service instances", async () => {
    expect(getCloudflareKv(event)).toBe(kv);
    expect(useCache(event)).toBeInstanceOf(SimpleCache);
    await service().getCharacterProfilePictures("movie", 1, async () => media);
    await service().getCharacterProfilePictures("movie", 1, async () => media);
    // Ten equivalent requests used to repeat both mapping and search ten times.
    for (let i = 0; i < 8; i++)
      await service().getCharacterProfilePictures("movie", 1, async () => media);
    expect(count("www.wikidata.org")).toBe(1);
    expect(count("api4.thetvdb.com", "/v4/search")).toBe(1);
    expect(requests.find((url) => url.pathname === "/v4/search")?.searchParams.get("type")).toBe(
      "movie",
    );
    expect(writes.filter(({ key }) => key.includes("characters-extended"))).toEqual([
      expect.objectContaining({ ttl: 86400 }),
    ]);
    expect([...values.values()]).toContainEqual({ characters: [], tvdbId: null });
  });

  it("serves ten warm TVDB image requests without metadata loads during a TMDB outage", async () => {
    characters = [portrait];
    await service().getCharacterProfilePictures("movie", 30, async () => ({
      external_ids: { tvdb_id: 123 },
    }));
    const metadata = vi
      .spyOn(MediaService.prototype, "getMediaWithVoiceActors")
      .mockRejectedValue(new Error("TMDB unavailable"));
    vi.stubGlobal("defineEventHandler", defineEventHandler);
    vi.stubGlobal("getQuery", () => ({ item: "movie:30:Role" }));
    const handler = (await import("../../api/character-images.get")).default;
    const app = createApp();
    app.use("/", handler);
    for (let index = 0; index < 10; index++) {
      const response = await toWebHandler(app)(new Request("http://localhost/"));
      const body: unknown = await response.json();
      expect(body).toMatchObject({
        images: { "movie:30:Role": { source: "tvdb", src: portrait.image } },
      });
    }
    expect(metadata).not.toHaveBeenCalled();
  });

  it("does not persist a failed metadata load and recovers on the next request", async () => {
    characters = [portrait];
    const loader = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error("TMDB unavailable"))
      .mockResolvedValue({ external_ids: { tvdb_id: 123 } });
    expect(await service().getCharacterProfilePictures("movie", 31, loader)).toMatchObject({
      degraded: true,
    });
    expect(writes).toHaveLength(0);
    expect(await service().getCharacterProfilePictures("movie", 31, loader)).toMatchObject({
      tvdbId: 123,
      characters: [expect.objectContaining(portrait)],
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("refreshes a verified negative after its 24-hour lifetime", async () => {
    await service().getCharacterProfilePictures("movie", 10, async () => media);
    now = 86399;
    await service().getCharacterProfilePictures("movie", 10, async () => media);
    expect(count("www.wikidata.org")).toBe(1);
    now = 86401;
    await service().getCharacterProfilePictures("movie", 10, async () => media);
    expect(count("www.wikidata.org")).toBe(2);
  });

  it("separates media type and locale and coalesces simultaneous lookups", async () => {
    await Promise.all(
      Array.from({ length: 4 }, () =>
        service().getCharacterProfilePictures("movie", 2, async () => media),
      ),
    );
    await service("fr-FR").getCharacterProfilePictures("movie", 2, async () => media);
    await service().getCharacterProfilePictures("tv", 2, async () => media);
    expect(count("www.wikidata.org")).toBe(3);
    expect(count("api4.thetvdb.com", "/v4/search")).toBe(3);
    expect(writes.filter(({ key }) => key.includes("characters-extended"))).toHaveLength(3);
    expect(
      requests
        .filter((url) => url.pathname === "/v4/search")
        .map((url) => url.searchParams.get("type")),
    ).toEqual(["movie", "movie", "series"]);
  });

  it.each([false, true])(
    "persists verified empty records for a day and portraits for 30 days (portrait=%s)",
    async (hasPortrait) => {
      characters = hasPortrait ? [portrait] : [];
      const tmdb = { external_ids: { tvdb_id: 123 } };
      const result = await service().getCharacterProfilePictures("movie", 3, async () => tmdb);
      expect(result.tvdbId).toBe(123);
      expect(result.characters).toHaveLength(hasPortrait ? 1 : 0);
      await service().getCharacterProfilePictures("movie", 3, async () => tmdb);
      expect(count("api4.thetvdb.com", "/v4/movies/123/extended")).toBe(1);
      expect(writes.find(({ key }) => key.includes("characters-extended"))?.ttl).toBe(
        hasPortrait ? 2_592_000 : 86400,
      );
    },
  );

  it("keeps successful TVDB portraits past seven days and refreshes after thirty", async () => {
    characters = [portrait];
    const loader = vi.fn(async () => ({ external_ids: { tvdb_id: 123 } }));
    await service().getCharacterProfilePictures("movie", 32, loader);
    now = 29 * 86400;
    await service().getCharacterProfilePictures("movie", 32, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(count("api4.thetvdb.com", "/v4/movies/123/extended")).toBe(1);
    now = 31 * 86400;
    await service().getCharacterProfilePictures("movie", 32, loader);
    expect(loader).toHaveBeenCalledTimes(2);
    expect(count("api4.thetvdb.com", "/v4/movies/123/extended")).toBe(2);
  });

  it("resolves and caches documented string TVDB search IDs", async () => {
    searchData = [{ id: "movie-123", tvdb_id: "123", type: "movie", name: "Fixture" }];
    characters = [portrait];
    expect(
      await service().getCharacterProfilePictures("movie", 11, async () => media),
    ).toMatchObject({
      tvdbId: 123,
      characters: [expect.objectContaining(portrait)],
    });
    await service().getCharacterProfilePictures("movie", 11, async () => media);
    expect(count("www.wikidata.org")).toBe(1);
    expect(count("api4.thetvdb.com", "/v4/search")).toBe(1);
    expect(writes.find(({ key }) => key.includes("characters-extended"))?.ttl).toBe(2_592_000);
  });

  it("recognizes series search results with documented string IDs", async () => {
    searchData = [{ id: "123", tvdb_id: "123", type: "series", name: "Fixture" }];
    characters = [portrait];
    expect(await service().getCharacterProfilePictures("tv", 12, async () => media)).toMatchObject({
      tvdbId: 123,
      characters: [expect.objectContaining(portrait)],
    });
  });

  it("returns TVDB fallback after Wikidata 429 without persisting a degraded mapping", async () => {
    wikidataStatus = 429;
    searchData = [{ id: "movie-123", tvdb_id: "123", type: "movie", name: "Fixture" }];
    characters = [portrait];
    const result = await service().getCharacterProfilePictures("movie", 4, async () => media);
    expect(result).toMatchObject({
      tvdbId: 123,
      degraded: true,
      characters: [expect.objectContaining(portrait)],
    });
    await service().getCharacterProfilePictures("movie", 4, async () => media);
    expect(count("www.wikidata.org")).toBe(2);
    expect(writes.some(({ key }) => key.includes("characters-extended"))).toBe(false);
  });

  it.each(["wikidata", "tvdb", "malformed", "timeout"])(
    "does not persist %s failures as negatives",
    async (failure) => {
      if (failure === "wikidata") wikidataStatus = 429;
      if (failure === "tvdb") tvdbStatus = 503;
      if (failure === "malformed") malformed = true;
      if (failure === "timeout")
        vi.stubGlobal(
          "fetch",
          vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")),
        );
      for (let i = 0; i < 2; i++) {
        expect(
          await service().getCharacterProfilePictures("movie", 5, async () => media),
        ).toMatchObject({
          characters: [],
          degraded: true,
        });
      }
      expect(writes.some(({ key }) => key.includes("characters-extended"))).toBe(false);
      if (failure !== "timeout") expect(count("www.wikidata.org")).toBe(2);
    },
  );

  it("reuses a verified Wikimedia miss and separates production/locale", async () => {
    const input = {
      contentType: "movie",
      contentId: 6,
      wikidataId: "Q42",
      characterName: "Role",
      language: "en-US",
    } satisfies Parameters<typeof getWikimediaCharacterImage>[0];
    for (let i = 0; i < 10; i++) expect(await getWikimediaCharacterImage(input)).toBeNull();
    expect(count("www.wikidata.org")).toBe(1);
    expect(writes[0]?.ttl).toBe(86400);
    await getWikimediaCharacterImage({ ...input, contentType: "tv" });
    await getWikimediaCharacterImage({ ...input, language: "fr-FR" });
    expect(count("www.wikidata.org")).toBe(3);
  });

  it("measures a cold 24-role batch for a work without characters", async () => {
    for (let index = 0; index < 24; index++) {
      await getWikimediaCharacterImage({
        contentType: "movie",
        contentId: 20,
        wikidataId: "Q42",
        characterName: `Role ${index}`,
        language: "en-US",
      });
    }
    expect(count("www.wikidata.org")).toBe(1);
    // One final-image read and one shared-roster read per cold role; only one
    // extra roster write for the whole production, in addition to final misses.
    expect(kv.get).toHaveBeenCalledTimes(48);
    expect(writes).toHaveLength(25);
  });

  it("measures a cold 24-role batch for a work with only generic characters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requests.push(url);
        const body =
          url.searchParams.get("ids") === "Q42"
            ? {
                entities: {
                  Q42: { claims: { P674: [{ mainsnak: { datavalue: { value: { id: "Q1" } } } }] } },
                },
              }
            : {
                entities: {
                  Q1: {
                    labels: { en: { value: "Role" } },
                    claims: {
                      P1441: ["Q42", "Q99"].map((id) => ({
                        mainsnak: { datavalue: { value: { id } } },
                      })),
                      P18: [{ mainsnak: { datavalue: { value: "Role.jpg" } } }],
                    },
                  },
                },
              };
        return new Response(JSON.stringify(body));
      }),
    );
    for (let index = 0; index < 24; index++) {
      await getWikimediaCharacterImage({
        contentType: "movie",
        contentId: 21,
        wikidataId: "Q42",
        characterName: `Role ${index}`,
        language: "en-US",
      });
    }
    expect(count("www.wikidata.org")).toBe(2);
  });

  it("shares candidates concurrently, retains licensed image selection, and retries Commons failures", async () => {
    let commonsFails = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        requests.push(url);
        if (url.hostname === "commons.wikimedia.org") {
          return new Response(
            JSON.stringify({
              query: {
                pages: {
                  "1": {
                    imageinfo: [
                      {
                        thumburl: "https://upload.wikimedia.org/role.jpg",
                        descriptionurl: "https://commons.wikimedia.org/wiki/File:Role.jpg",
                        extmetadata: {
                          LicenseShortName: { value: "CC BY 4.0" },
                          Artist: { value: "Artist" },
                        },
                      },
                    ],
                  },
                },
              },
            }),
            { status: commonsFails ? 503 : 200 },
          );
        }
        const body =
          url.searchParams.get("ids") === "Q42"
            ? {
                entities: {
                  Q42: { claims: { P674: [{ mainsnak: { datavalue: { value: { id: "Q1" } } } }] } },
                },
              }
            : {
                entities: {
                  Q1: {
                    labels: { en: { value: "Role" } },
                    claims: {
                      P1441: [{ mainsnak: { datavalue: { value: { id: "Q42" } } } }],
                      P18: [{ mainsnak: { datavalue: { value: "Role.jpg" } } }],
                    },
                  },
                },
              };
        return new Response(JSON.stringify(body));
      }),
    );
    const input = {
      contentType: "movie",
      contentId: 22,
      wikidataId: "Q42",
      characterName: "Role",
      language: "en-US",
    } satisfies Parameters<typeof getWikimediaCharacterImage>[0];
    const results = await Promise.allSettled([
      getWikimediaCharacterImage(input),
      getWikimediaCharacterImage({ ...input, characterName: "Other role" }),
    ]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "fulfilled"]);
    expect(count("www.wikidata.org")).toBe(2);
    // Valid candidate metadata can be reused; the failed image itself is not cached.
    commonsFails = false;
    expect(await getWikimediaCharacterImage(input)).toMatchObject({
      src: "https://upload.wikimedia.org/role.jpg",
    });
    expect(count("www.wikidata.org")).toBe(2);
    expect(count("commons.wikimedia.org")).toBe(2);
    expect(writes.filter(({ key }) => key.includes("production-character-candidates"))).toEqual([
      expect.objectContaining({ ttl: 2_592_000 }),
    ]);
    expect(
      writes.filter(
        ({ key }) => key.includes("production-character-image") && key.includes(":wikimedia:"),
      ),
    ).toContainEqual(expect.objectContaining({ ttl: 2_592_000 }));
  });

  it("expires the shared negative roster and separates Wikidata identities", async () => {
    const input = {
      contentType: "movie",
      contentId: 23,
      wikidataId: "Q42",
      characterName: "Role",
      language: "en-US",
    } satisfies Parameters<typeof getWikimediaCharacterImage>[0];
    await getWikimediaCharacterImage(input);
    now = 86399;
    await getWikimediaCharacterImage({ ...input, characterName: "Another role" });
    expect(count("www.wikidata.org")).toBe(1);
    now = 86401;
    await getWikimediaCharacterImage({ ...input, characterName: "New role" });
    expect(count("www.wikidata.org")).toBe(2);
    await expect(
      getWikimediaCharacterImage({ ...input, wikidataId: "Q99", characterName: "Changed work" }),
    ).rejects.toThrow("Invalid Wikidata work response");
    expect(count("www.wikidata.org")).toBe(3);
    expect(
      writes.filter(({ key }) => key.includes("production-character-candidates")),
    ).toHaveLength(2);
  });

  it.each([429, 503])("keeps Wikimedia %s failures retryable and uncached", async (status) => {
    wikidataStatus = status;
    const input = {
      contentType: "movie",
      contentId: 7,
      wikidataId: "Q42",
      characterName: "Role",
      language: "en-US",
    } satisfies Parameters<typeof getWikimediaCharacterImage>[0];
    await expect(getWikimediaCharacterImage(input)).rejects.toThrow();
    await expect(getWikimediaCharacterImage(input)).rejects.toThrow();
    expect(count("www.wikidata.org")).toBe(2);
    expect(writes).toHaveLength(0);
  });
});
