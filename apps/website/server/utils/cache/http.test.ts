import { createApp, defineEventHandler, toWebHandler } from "h3";
import { describe, expect, it, vi } from "vitest";
import { OpenLibraryClient } from "../api/openlibrary";
import { createCacheNamespace, SimpleCache } from "./index";
import {
  getCloudflareCacheControl,
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
  setNoCacheHeaders,
  setPublicCacheHeaders,
} from "./http";

describe("HTTP cache headers", () => {
  it("defines only cache windows used by provider-only responses", () => {
    expect(getPublicCacheControl("discovery")).toBe(
      "public, max-age=60, stale-while-revalidate=3600",
    );
    expect(getCloudflareCacheControl("discovery")).toBe(
      "public, max-age=600, stale-while-revalidate=3600",
    );
    expect(getPublicCacheControl("static")).toBe(
      "public, max-age=86400, stale-while-revalidate=2592000",
    );
    expect(getCloudflareCacheControl("static")).toBe(
      "public, max-age=604800, stale-while-revalidate=2592000",
    );
  });

  it("defines the no-store value for dynamic responses", () => {
    expect(NO_STORE_CACHE_CONTROL).toBe("no-store, no-cache, must-revalidate");
  });

  it("caches a provider-only successful response without header-language variance", async () => {
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        setPublicCacheHeaders(event, "discovery");
        return { results: ["provider-only"] };
      }),
    );
    const response = await toWebHandler(app)(new Request("http://localhost/"));

    expect(response.headers.get("cache-control")).toBe(
      getPublicCacheControl("discovery"),
    );
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      getCloudflareCacheControl("discovery"),
    );
    expect(response.headers.has("vary")).toBe(false);
    await expect(response.json()).resolves.toEqual({
      results: ["provider-only"],
    });
  });

  it("keeps mixed detail responses fresh while reusing provider metadata from KV", async () => {
    const values = new Map<string, unknown>();
    const kv = {
      get: vi.fn(async (key: string) => values.get(key) ?? null),
      put: vi.fn(async (key: string, value: string) => {
        values.set(key, JSON.parse(value));
      }),
    };
    const cache = new SimpleCache(() => kv);
    const namespace = createCacheNamespace<{ title: string }>();
    const fetchProviderMetadata = vi.fn(async () => ({
      title: "Provider title",
    }));
    let requestCount = 0;
    const app = createApp();
    app.use(
      "/",
      defineEventHandler(async (event) => {
        setNoCacheHeaders(event);
        requestCount += 1;
        const metadata = await cache.getOrFetch(
          namespace,
          "tmdb:movie:1",
          fetchProviderMetadata,
          { cachePolicy: "persistent" },
        );
        return { metadata, dubbingProjects: [`request-${requestCount}`] };
      }),
    );
    const handler = toWebHandler(app);

    const firstResponse = await handler(new Request("http://localhost/"));
    const firstBody = await firstResponse.json();
    const secondResponse = await handler(new Request("http://localhost/"));
    const secondBody = await secondResponse.json();

    expect(firstResponse.headers.get("cache-control")).toBe(
      NO_STORE_CACHE_CONTROL,
    );
    expect(secondResponse.headers.get("cache-control")).toBe(
      NO_STORE_CACHE_CONTROL,
    );
    expect(firstBody).toEqual({
      metadata: { title: "Provider title" },
      dubbingProjects: ["request-1"],
    });
    expect(secondBody).toEqual({
      metadata: { title: "Provider title" },
      dubbingProjects: ["request-2"],
    });
    expect(fetchProviderMetadata).toHaveBeenCalledTimes(1);
    expect(kv.get).toHaveBeenCalledTimes(2);
  });
});

describe("OpenLibrary author caching", () => {
  const invalidResponses: Array<[string, () => Response]> = [
    [
      "empty author responses",
      () => new Response(JSON.stringify({}), { status: 200 }),
    ],
    ["upstream errors", () => new Response("unavailable", { status: 503 })],
  ];

  it.each(invalidResponses)(
    "does not cache %s",
    async (_label, makeResponse) => {
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
    },
  );
});
