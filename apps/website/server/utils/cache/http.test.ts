import {
  createApp,
  createError,
  defineEventHandler,
  setHeader,
  toWebHandler,
} from "h3";
import { describe, expect, it } from "vitest";
import {
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
  setErrorCacheHeaders,
  shouldDisableErrorCaching,
} from "./http";

describe("public cache profiles", () => {
  it("keeps successful season and episode details at the detail TTL", () => {
    expect(getPublicCacheControl("detail")).toBe(
      "public, max-age=300, s-maxage=600, stale-while-revalidate=900",
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

  it("keeps search responses shorter than other public responses", () => {
    expect(getPublicCacheControl("search")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    );
  });
});
