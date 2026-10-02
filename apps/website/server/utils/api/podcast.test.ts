import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { PodcastClient } from "./podcast";

afterEach(() => vi.unstubAllGlobals());

describe("Podcast persistence policy", () => {
  it("fetches search results directly", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ resultCount: 0, results: [] })),
    );
    const client = new PodcastClient();

    await expect(client.searchPodcasts("example")).resolves.toEqual([]);
  });

  it("fetches podcast details on every request without KV", async () => {
    const get = vi.fn(async () => null);
    const put = vi.fn(async () => undefined);
    const getOrFetch = vi.spyOn(SimpleCache.prototype, "getOrFetch");
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            resultCount: 1,
            results: [{ collectionId: 42, collectionName: "Podcast" }],
          }),
        ),
    );
    vi.stubGlobal("CACHE_KV", { get, put });
    vi.stubGlobal("fetch", fetchMock);
    const client = new PodcastClient();

    await client.getPodcast(42);
    await client.getPodcast(42);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getOrFetch).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });
});
