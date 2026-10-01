import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { TMDBClient } from "./tmdb";

afterEach(() => vi.unstubAllGlobals());

function createClient() {
  let reads = 0;
  let writes = 0;
  vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ id: 1, results: [] }))),
  );
  const client = new TMDBClient(
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

  return {
    client,
    get reads() {
      return reads;
    },
    get writes() {
      return writes;
    },
  };
}

describe("TMDB persistence policy", () => {
  it("does not read or write KV for search or trending responses", async () => {
    const setup = createClient();

    await setup.client.searchMulti("example");
    await setup.client.getTrending("movie", "day");

    expect(setup.reads).toBe(0);
    expect(setup.writes).toBe(0);
  });

  it("retains KV for media details shared by internal fan-out", async () => {
    const setup = createClient();

    await setup.client.getMediaWithCredits("movie", 42);

    expect(setup.reads).toBe(1);
    expect(setup.writes).toBe(1);
  });
});
