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
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
  setErrorCacheHeaders,
  setPublicCacheHeaders,
  shouldDisableErrorCaching,
} from "./http";

describe("HTTP cache headers", () => {
  it("uses a five minute public cache window across ordinary profiles", () => {
    expect(getPublicCacheControl("detail")).toBe(
      "public, max-age=300, s-maxage=300",
    );
    expect(getPublicCacheControl("catalog")).toBe(
      "public, max-age=300, s-maxage=300",
    );
    expect(getPublicCacheControl("discovery")).toBe(
      "public, max-age=300, s-maxage=300",
    );
    expect(getPublicCacheControl("search")).toBe(
      "public, max-age=300, s-maxage=300",
    );
  });

  it("uses a 24 hour cache window for expensive static responses", () => {
    expect(getPublicCacheControl("static")).toBe(
      "public, max-age=86400, s-maxage=86400",
    );
  });

  it("disables caching for timeout and upstream server errors", () => {
    expect(shouldDisableErrorCaching({ statusCode: 502 })).toBe(true);
    expect(shouldDisableErrorCaching({ statusCode: 504 })).toBe(true);
    expect(shouldDisableErrorCaching(new Error("upstream failed"))).toBe(true);
    expect(shouldDisableErrorCaching({ statusCode: 404 })).toBe(false);
    expect(NO_STORE_CACHE_CONTROL).toBe("no-store, no-cache, must-revalidate");
  });

  it("overrides public detail headers on a timeout response", async () => {
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => {
        setHeader(event, "Cache-Control", getPublicCacheControl("detail"));
        setErrorCacheHeaders(event, { statusCode: 504 });
        throw createError({ statusCode: 504, statusMessage: "Timed out" });
      }),
    );
    const response = await toWebHandler(app)(new Request("http://localhost/"));

    expect(response.status).toBe(504);
    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });

  it("uses the same short cache window for search responses", () => {
    expect(getPublicCacheControl("search")).toBe(
      "public, max-age=300, s-maxage=300",
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
      "public, max-age=300, s-maxage=300",
    );
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
