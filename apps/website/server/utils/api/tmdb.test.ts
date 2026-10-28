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
});
