import { describe, expect, it, vi } from "vitest";
import { CACHE_TTL, createCacheNamespace, SimpleCache, type GetOrFetchOptions } from "./index";
import { buildCacheKey } from "./constants";
import { OpenLibraryClient } from "../api/openlibrary";

interface FakeKv {
  get: (key: string, options: { type: "json" }) => Promise<unknown>;
  put: (key: string, value: string, options: { expirationTtl: number }) => Promise<void>;
}

function makeCache(initial = new Map<string, unknown>()) {
  let reads = 0;
  const writes: Array<{ key: string; value: unknown; ttl: number }> = [];
  const values = initial;
  const kv: FakeKv = {
    get: async (key) => {
      reads += 1;
      return values.get(key) ?? null;
    },
    put: async (key, value, options) => {
      const parsed: unknown = JSON.parse(value);
      values.set(key, parsed);
      writes.push({ key, value: parsed, ttl: options.expirationTtl });
    },
  };

  return {
    cache: new SimpleCache(() => kv),
    values,
    writes,
    get reads() {
      return reads;
    },
  };
}

describe("SimpleCache policies", () => {
  it("requires a TTL for persistent writes and rejects TTLs for read-only access", () => {
    const persistent: GetOrFetchOptions = {
      cachePolicy: "persistent",
      ttl: "STABLE",
    };
    const readOnly: GetOrFetchOptions = { cachePolicy: "read-only" };
    // @ts-expect-error persistent writes must select an explicit TTL
    const missingTtl: GetOrFetchOptions = { cachePolicy: "persistent" };
    const ttlOnReadOnly: GetOrFetchOptions = {
      cachePolicy: "read-only",
      // @ts-expect-error read-only policy cannot carry a TTL
      ttl: "STABLE",
    };

    expect([persistent.cachePolicy, readOnly.cachePolicy]).toEqual(["persistent", "read-only"]);
    expect([missingTtl, ttlOnReadOnly]).toHaveLength(2);
  });

  it("persistent reads KV, fetches and writes on a miss, then serves the hit", async () => {
    const harness = makeCache();
    const namespace = createCacheNamespace<{ title: string }>();
    const fetcher = vi.fn(async () => ({ title: "Provider title" }));

    await expect(
      harness.cache.getOrFetch(namespace, "tmdb:movie:1", fetcher, {
        ttl: "STABLE",
        cachePolicy: "persistent",
      }),
    ).resolves.toEqual({ title: "Provider title" });
    await expect(
      harness.cache.getOrFetch(namespace, "tmdb:movie:1", fetcher, {
        ttl: "STABLE",
        cachePolicy: "persistent",
      }),
    ).resolves.toEqual({ title: "Provider title" });

    expect(harness.reads).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(harness.writes).toEqual([
      {
        key: "tmdb:movie:1",
        value: { title: "Provider title" },
        ttl: CACHE_TTL.STABLE,
      },
    ]);
  });

  it("read-only reads KV and fetches misses without writing", async () => {
    const harness = makeCache();
    const namespace = createCacheNamespace<string>();

    await expect(
      harness.cache.getOrFetch(namespace, "tvdb:characters:1", async () => "upstream mapping", {
        cachePolicy: "read-only",
      }),
    ).resolves.toBe("upstream mapping");

    expect(harness.reads).toBe(1);
    expect(harness.writes).toEqual([]);
  });

  it("coalesces a same-key, same-policy miss", async () => {
    const harness = makeCache();
    const namespace = createCacheNamespace<string>();
    let resolveFetch: ((value: string) => void) | undefined;
    const fetcher = vi.fn(() => new Promise<string>((resolve) => (resolveFetch = resolve)));
    const first = harness.cache.getOrFetch(namespace, "provider:coalesced", fetcher, {
      cachePolicy: "persistent",
      ttl: "STABLE",
    });
    const second = harness.cache.getOrFetch(namespace, "provider:coalesced", fetcher, {
      cachePolicy: "persistent",
      ttl: "STABLE",
    });

    expect(second).toBe(first);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    resolveFetch?.("shared result");
    await expect(Promise.all([first, second])).resolves.toEqual(["shared result", "shared result"]);
  });

  it("keeps the same key independent across different policies", async () => {
    const harness = makeCache();
    const namespace = createCacheNamespace<string>();
    const resolveFetches: Array<(value: string) => void> = [];
    const fetcher = vi.fn(() => new Promise<string>((resolve) => resolveFetches.push(resolve)));

    const persistent = harness.cache.getOrFetch(namespace, "provider:mixed-policy", fetcher, {
      cachePolicy: "persistent",
      ttl: "STABLE",
    });
    const readOnly = harness.cache.getOrFetch(namespace, "provider:mixed-policy", fetcher, {
      cachePolicy: "read-only",
    });

    expect(readOnly).not.toBe(persistent);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    resolveFetches[0]?.("persistent result");
    resolveFetches[1]?.("read-only result");
    await expect(Promise.all([persistent, readOnly])).resolves.toEqual([
      "persistent result",
      "read-only result",
    ]);
    expect(harness.reads).toBe(2);
    expect(harness.writes).toHaveLength(1);
  });

  it("does not persist null or failed results and allows retry", async () => {
    const harness = makeCache();
    const namespace = createCacheNamespace<string | null>();
    let attempts = 0;
    const fetcher = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) return null;
      if (attempts === 2) throw new Error("upstream failed");
      return "recovered";
    });

    await expect(
      harness.cache.getOrFetch(namespace, "provider:nullable", fetcher, {
        cachePolicy: "persistent",
        ttl: "STABLE",
      }),
    ).resolves.toBeNull();
    await expect(
      harness.cache.getOrFetch(namespace, "provider:nullable", fetcher, {
        cachePolicy: "persistent",
        ttl: "STABLE",
      }),
    ).rejects.toThrow("upstream failed");
    await expect(
      harness.cache.getOrFetch(namespace, "provider:nullable", fetcher, {
        cachePolicy: "persistent",
        ttl: "STABLE",
      }),
    ).resolves.toBe("recovered");

    expect(harness.writes).toEqual([
      {
        key: "provider:nullable",
        value: "recovered",
        ttl: CACHE_TTL.STABLE,
      },
    ]);
  });
});

describe("buildCacheKey", () => {
  const common = {
    provider: "tvdb",
    resource: "series",
    id: 123,
  };

  it("separates language, params, and Unicode queries", () => {
    const french = buildCacheKey({ ...common, language: "fr-FR" });
    const japanese = buildCacheKey({ ...common, language: "ja-JP" });
    const extended = buildCacheKey({
      ...common,
      language: "fr-FR",
      params: { extended: true },
    });
    const accented = buildCacheKey({
      provider: "wikipedia",
      resource: "search",
      query: "声優 café",
    });
    const otherAccented = buildCacheKey({
      provider: "wikipedia",
      resource: "search",
      query: "声優 cafe",
    });

    expect(new Set([french, japanese, extended]).size).toBe(3);
    expect(accented).not.toBe(otherAccented);
    expect(accented).toMatch(/^[a-z0-9:_-]+$/);
  });
});

describe("OpenLibrary author caching", () => {
  const invalidResponses: Array<[string, () => Response]> = [
    ["empty author responses", () => new Response(JSON.stringify({}))],
    ["upstream errors", () => new Response("unavailable", { status: 503 })],
  ];

  it.each(invalidResponses)("does not cache %s", async (_label, makeResponse) => {
    let writes = 0;
    const client = new OpenLibraryClient(
      new SimpleCache(() => ({
        get: async () => null,
        put: async () => {
          writes += 1;
        },
      })),
    );
    const fetchMock = vi.fn(async () => makeResponse());
    vi.stubGlobal("fetch", fetchMock);

    try {
      await expect(client.getAuthorName("OL123A")).resolves.toBe("");
      await expect(client.getAuthorName("OL123A")).resolves.toBe("");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(writes).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
