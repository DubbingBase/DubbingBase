import {
  createApp,
  createError,
  defineEventHandler,
  setHeader,
  toWebHandler,
} from "h3";
import { describe, expect, it, vi } from "vitest";
import { OpenLibraryClient } from "../api/openlibrary";
import { SimpleCache } from "./index";
import {
  getCloudflareCacheControl,
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
  setErrorCacheHeaders,
  setPublicCacheHeaders,
  shouldDisableErrorCaching,
} from "./http";

describe("HTTP cache headers", () => {
  it("uses distinct cache windows for public API profiles", () => {
    expect(getPublicCacheControl("detail")).toBe(
      "public, max-age=300, stale-while-revalidate=86400",
    );
    expect(getPublicCacheControl("catalog")).toBe(
      "public, max-age=60, stale-while-revalidate=3600",
    );
    expect(getPublicCacheControl("discovery")).toBe(
      "public, max-age=60, stale-while-revalidate=3600",
    );
    expect(getPublicCacheControl("search")).toBe(
      "public, max-age=0, stale-while-revalidate=60",
    );
    expect(getCloudflareCacheControl("detail")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    expect(getCloudflareCacheControl("catalog")).toBe(
      "public, max-age=300, stale-while-revalidate=3600",
    );
    expect(getCloudflareCacheControl("discovery")).toBe(
      "public, max-age=600, stale-while-revalidate=3600",
    );
    expect(getCloudflareCacheControl("search")).toBe(
      "public, max-age=30, stale-while-revalidate=60",
    );
  });

  it("uses a 24 hour cache window for expensive static responses", () => {
    expect(getPublicCacheControl("static")).toBe(
      "public, max-age=86400, stale-while-revalidate=2592000",
    );
    expect(getCloudflareCacheControl("static")).toBe(
      "public, max-age=604800, stale-while-revalidate=2592000",
    );
  });

  it("disables caching for timeout and upstream server errors", () => {
    expect(shouldDisableErrorCaching({ statusCode: 502 })).toBe(true);
    expect(shouldDisableErrorCaching({ statusCode: 504 })).toBe(true);
    expect(shouldDisableErrorCaching(new Error("upstream failed"))).toBe(true);
    expect(shouldDisableErrorCaching({ statusCode: 404 })).toBe(true);
    expect(shouldDisableErrorCaching({ statusCode: 400 })).toBe(true);
    expect(NO_STORE_CACHE_CONTROL).toBe("no-store, no-cache, must-revalidate");
  });

  it("overrides public detail headers on a timeout response", async () => {
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        setHeader(event, "Cache-Control", getPublicCacheControl("detail"));
        setHeader(
          event,
          "Cloudflare-CDN-Cache-Control",
          getCloudflareCacheControl("detail"),
        );
        setErrorCacheHeaders(event, { statusCode: 504 });
        throw createError({ statusCode: 504, statusMessage: "Timed out" });
      }),
    );
    const response = await toWebHandler(app)(new Request("http://localhost/"));

    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });

  it("keeps edge search freshness shorter than detail responses", () => {
    expect(getPublicCacheControl("search")).toBe(
      "public, max-age=0, stale-while-revalidate=60",
    );
  });

  it("clears stale Pragma and Expires headers when switching to public caching", async () => {
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        setHeader(event, "Pragma", "no-cache");
        setHeader(event, "Expires", "0");
        setPublicCacheHeaders(event, "detail");
        return "ok";
      }),
    );
    const response = await toWebHandler(app)(new Request("http://localhost/"));

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=86400",
    );
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      "public, max-age=3600, stale-while-revalidate=86400",
    );
    expect(response.headers.get("vary")).toBe("Accept-Language");
    expect(response.headers.has("pragma")).toBe(false);
    expect(response.headers.has("expires")).toBe(false);
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
