import { createApp, createError, defineEventHandler, setHeader, toWebHandler } from "h3";
import { describe, expect, it } from "vitest";
import {
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
  setErrorCacheHeaders,
  shouldDisableErrorCaching,
} from "./http";

describe("HTTP cache headers", () => {
  it("uses a short public cache window across profiles", () => {
    expect(getPublicCacheControl("detail")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
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
      "public, max-age=60, s-maxage=300, stale-while-revalidate=300",
    );
  });
});
