import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { PodcastClient } from "./podcast";

afterEach(() => vi.unstubAllGlobals());

describe("Podcast persistence policy", () => {
  it("does not read or write KV for search results", async () => {
    let reads = 0;
    let writes = 0;
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ resultCount: 0, results: [] })),
    );
    const client = new PodcastClient(
      new SimpleCache(() => ({
        get: async () => {
          reads += 1;
          return null;
        },
        put: async () => {
          writes += 1;
        },
      })),
    );

    await expect(client.searchPodcasts("example")).resolves.toEqual([]);

    expect(reads).toBe(0);
    expect(writes).toBe(0);
  });
});
