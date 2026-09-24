import { describe, expect, it, vi } from "vitest";
import { CACHE_TTL, SimpleCache } from "./index";
import { buildCacheKey } from "./constants";

interface FakeKv {
  get: (key: string, options: { type: "json" }) => Promise<unknown>;
  put: (key: string, value: string, options: { expirationTtl: number }) => Promise<void>;
}

describe("SimpleCache", () => {
  it("reads from KV for every lookup instead of retaining an in-memory entry", async () => {
    let getCount = 0;
    const kv: FakeKv = {
      get: async () => {
        getCount += 1;
        return { value: getCount };
      },
      put: async () => undefined,
    };
    const cache = new SimpleCache(() => kv);

    const fetcher = vi.fn(async () => ({ value: 0 }));
    await expect(cache.getOrFetch("external:key", fetcher)).resolves.toEqual({
      value: 1,
    });
    await expect(cache.getOrFetch("external:key", fetcher)).resolves.toEqual({
      value: 2,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches and stores a KV miss, then serves the KV value on a hit", async () => {
    const values = new Map<string, unknown>();
    const kv: FakeKv = {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => values.set(key, JSON.parse(value)),
    };
    const cache = new SimpleCache(() => kv);
    const fetcher = async () => ({ title: "Result" });

    await expect(
      cache.getOrFetch("external:resource:1", fetcher, { ttl: "NORMAL" }),
    ).resolves.toEqual({ title: "Result" });
    await expect(
      cache.getOrFetch("external:resource:1", async () => ({ title: "Wrong" })),
    ).resolves.toEqual({ title: "Result" });
    expect(CACHE_TTL).toEqual({
      TRENDING: 60 * 60,
      NORMAL: 24 * 60 * 60,
      STABLE: 7 * 24 * 60 * 60,
    });
  });

  it("force refreshes the same key and stores the fetched value", async () => {
    const values = new Map<string, unknown>([["external:resource:1", "old"]]);
    let writes = 0;
    const kv: FakeKv = {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => {
        writes += 1;
        values.set(key, JSON.parse(value));
      },
    };
    const cache = new SimpleCache(() => kv);

    await expect(
      cache.getOrFetch("external:resource:1", async () => "new", {
        forceRefresh: true,
      }),
    ).resolves.toBe("new");
    expect(values.get("external:resource:1")).toBe("new");
    expect(writes).toBe(1);
  });

  it("does not write empty fetch results to KV", async () => {
    let writes = 0;
    const cache = new SimpleCache(() => ({
      get: async () => null,
      put: async () => {
        writes += 1;
      },
    }));

    await expect(cache.getOrFetch("external:missing", async () => null)).resolves.toBeNull();
    expect(writes).toBe(0);
  });

  it("coalesces same-key misses, including forced refreshes", async () => {
    const values = new Map<string, unknown>();
    let resolveFetch: ((value: string) => void) | undefined;
    let fetchCount = 0;
    const kv: FakeKv = {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => values.set(key, JSON.parse(value)),
    };
    const cache = new SimpleCache(() => kv);
    const fetcher = () => {
      fetchCount += 1;
      return new Promise<string>((resolve) => {
        resolveFetch = resolve;
      });
    };

    const first = cache.getOrFetch("external:coalesced", fetcher, {
      forceRefresh: true,
    });
    const second = cache.getOrFetch("external:coalesced", fetcher, {
      forceRefresh: true,
    });
    await vi.waitFor(() => expect(fetchCount).toBe(1));
    resolveFetch?.("shared");

    await expect(Promise.all([first, second])).resolves.toEqual(["shared", "shared"]);
    expect(fetchCount).toBe(1);
  });

  it("does not let a pending normal lookup suppress a forced refresh", async () => {
    let resolveRead: ((value: unknown) => void) | undefined;
    let forcedFetchCount = 0;
    const cache = new SimpleCache(() => ({
      get: async () =>
        new Promise<unknown>((resolve) => {
          resolveRead = resolve;
        }),
      put: async () => undefined,
    }));

    const normal = cache.getOrFetch("external:refresh-race", async () => "normal");
    await vi.waitFor(() => expect(resolveRead).toBeDefined());
    const forced = cache.getOrFetch(
      "external:refresh-race",
      async () => {
        forcedFetchCount += 1;
        return "fresh";
      },
      { forceRefresh: true },
    );

    await vi.waitFor(() => expect(forcedFetchCount).toBe(1));
    resolveRead?.("stale");

    await expect(normal).resolves.toBe("stale");
    await expect(forced).resolves.toBe("fresh");
  });

  it("does not let a slower normal fetch overwrite a forced refresh", async () => {
    const values = new Map<string, unknown>();
    let resolveNormalFetch: ((value: string) => void) | undefined;
    const cache = new SimpleCache(() => ({
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => values.set(key, JSON.parse(value)),
    }));

    const normal = cache.getOrFetch(
      "external:fetch-race",
      () =>
        new Promise<string>((resolve) => {
          resolveNormalFetch = resolve;
        }),
    );
    await vi.waitFor(() => expect(resolveNormalFetch).toBeDefined());
    const forced = cache.getOrFetch("external:fetch-race", async () => "fresh", {
      forceRefresh: true,
    });

    await expect(forced).resolves.toBe("fresh");
    expect(values.get("external:fetch-race")).toBe("fresh");
    resolveNormalFetch?.("stale");
    await expect(normal).resolves.toBe("stale");
    expect(values.get("external:fetch-race")).toBe("fresh");
  });

  it("cleans up failed in-flight requests so a later request can retry", async () => {
    let fetchCount = 0;
    const cache = new SimpleCache(() => ({
      get: async () => null,
      put: async () => undefined,
    }));
    const fetcher = async () => {
      fetchCount += 1;
      if (fetchCount === 1) throw new Error("upstream failed");
      return "recovered";
    };

    await expect(cache.getOrFetch("external:retry", fetcher)).rejects.toThrow("upstream failed");
    await expect(cache.getOrFetch("external:retry", fetcher)).resolves.toBe("recovered");
    expect(fetchCount).toBe(2);
  });

  it("does not force refresh authentication tokens", async () => {
    const cache = new SimpleCache(() => ({
      get: async () => "cached-token",
      put: async () => undefined,
    }));
    let fetchCount = 0;

    await expect(
      cache.getOrFetch(
        "tvdb:auth_token",
        async () => {
          fetchCount += 1;
          return "new-token";
        },
        { forceRefresh: true },
      ),
    ).resolves.toBe("cached-token");
    expect(fetchCount).toBe(0);
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
