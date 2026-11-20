import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { TMDBClient } from "./tmdb";

afterEach(() => vi.unstubAllGlobals());

describe("TMDB metadata fetches", () => {
  it("fetches metadata directly without reading or writing KV", async () => {
    const get = vi.fn(async () => null);
    const put = vi.fn(async () => undefined);
    const getOrFetch = vi.spyOn(SimpleCache.prototype, "getOrFetch");
    const urls: URL[] = [];
    vi.stubGlobal("CACHE_KV", { get, put });
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(new URL(String(input)));
        return new Response(JSON.stringify({ id: 1, results: [], cast: [] }));
      }),
    );

    const client = new TMDBClient();
    await client.getMediaWithCredits("movie", 1);
    await client.getMediaWithCredits("tv", 2);
    await client.getMediaDetails("tv", 7);
    await client.getSeasonWithCredits(2, 3);
    await client.getEpisodeWithCredits(2, 3, 4);
    await client.fetchMediaDetails(3, "movie");
    await client.fetchMediaSummary(3, "tv");
    await client.fetchMediaCredits("tv", 4);
    await client.getPersonWithCredits(5);
    await client.getCollection(6);
    await client.getTrending("movie", "day");

    expect(urls.map((url) => url.pathname)).toEqual([
      "/3/movie/1",
      "/3/tv/2",
      "/3/tv/7",
      "/3/tv/2/season/3",
      "/3/tv/2/season/3/episode/4",
      "/3/movie/3",
      "/3/tv/3",
      "/3/tv/4/aggregate_credits",
      "/3/person/5",
      "/3/collection/6",
      "/3/trending/movie/day",
    ]);
    expect(urls[5]?.searchParams.get("append_to_response")).toBe("credits,external_ids");
    expect(urls[4]?.searchParams.get("append_to_response")).toBe("credits,external_ids");
    expect(urls[6]?.searchParams.has("append_to_response")).toBe(false);
    expect(urls[1]?.searchParams.get("append_to_response")).toBe("credits,external_ids");
    expect(urls[2]?.searchParams.get("append_to_response")).toBe("external_ids");
    expect(getOrFetch).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("skips external IDs for an episode media-page request", async () => {
    const urls: URL[] = [];
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(new URL(String(input)));
        return new Response(JSON.stringify({ id: 4, credits: { cast: [] } }));
      }),
    );

    await new TMDBClient().getEpisodeWithCredits(2, 3, 4, undefined, {
      includeExternalIds: false,
    });

    expect(urls[0]?.searchParams.get("append_to_response")).toBe("credits");
  });

  it("keeps metadata in Cloudflare's edge cache but never searches or trending", async () => {
    const inits: Array<RequestInit & { cf?: unknown }> = [];
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit & { cf?: unknown }) => {
        inits.push(init ?? {});
        return new Response(JSON.stringify({ id: 1, results: [] }));
      }),
    );

    const client = new TMDBClient();
    await client.getPersonWithCredits(5);
    await client.getMediaWithCredits("movie", 1);
    await client.searchMulti("x");
    await client.getTrending("tv", "day");

    expect(inits[0]?.cf).toMatchObject({
      cacheEverything: true,
      cacheTtlByStatus: { "200-299": 6 * 3600, "500-599": 0 },
    });
    expect(inits[1]?.cf).toMatchObject({ cacheTtlByStatus: { "200-299": 24 * 3600 } });
    expect(inits[2]?.cf).toBeUndefined();
    expect(inits[3]?.cf).toBeUndefined();
  });

  it("retries once after a 429 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 9 })));
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(new TMDBClient().getCollection(9)).resolves.toMatchObject({ id: 9 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a 404 and gives up after one retry on persistent 5xx", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    const notFound = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", notFound);
    await expect(new TMDBClient().getCollection(1)).rejects.toThrow("TMDB API error: 404");
    expect(notFound).toHaveBeenCalledTimes(1);

    const down = vi.fn(async () => new Response("", { status: 503 }));
    vi.stubGlobal("fetch", down);
    await expect(new TMDBClient().getCollection(1)).rejects.toThrow("TMDB API error: 503");
    expect(down).toHaveBeenCalledTimes(2);
  });
});
