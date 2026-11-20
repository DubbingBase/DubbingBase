import { describe, expect, it, vi } from "vitest";
import { edgeCache, fetchWithEdgePostCache } from "./edge";

describe("edgeCache", () => {
  it("keeps only successful responses for the lifetime", () => {
    expect(edgeCache(3600)).toEqual({
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: { "200-299": 3600, "404": 60, "500-599": 0 },
      },
    });
  });

  it("is a no-op for a zero lifetime", () => {
    expect(edgeCache(0)).toEqual({});
  });
});

describe("fetchWithEdgePostCache", () => {
  function fakeCaches() {
    const store = new Map<string, Response>();
    return {
      store,
      default: {
        match: async (request: Request) => store.get(request.url)?.clone(),
        put: async (request: Request, response: Response) => {
          store.set(request.url, response);
        },
      },
    };
  }

  it("serves a repeat POST from the Cache API and stores only 2xx", async () => {
    const caches = fakeCaches();
    vi.stubGlobal("caches", caches);
    const send = vi.fn(async () => new Response(JSON.stringify([{ id: 1 }])));

    const first = await fetchWithEdgePostCache("igdb:games:abc", 3600, send);
    const second = await fetchWithEdgePostCache("igdb:games:abc", 3600, send);

    expect(await first.json()).toEqual([{ id: 1 }]);
    expect(await second.json()).toEqual([{ id: 1 }]);
    expect(send).toHaveBeenCalledTimes(1);

    const failing = vi.fn(async () => new Response("", { status: 503 }));
    await fetchWithEdgePostCache("igdb:games:down", 3600, failing);
    await fetchWithEdgePostCache("igdb:games:down", 3600, failing);
    expect(failing).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("passes straight through without a Cache API or with a zero lifetime", async () => {
    const send = vi.fn(async () => new Response("[]"));
    await fetchWithEdgePostCache("x", 3600, send);
    vi.stubGlobal("caches", fakeCaches());
    await fetchWithEdgePostCache("x", 0, send);
    await fetchWithEdgePostCache("x", 0, send);
    expect(send).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });
});
