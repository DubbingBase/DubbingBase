import { createApp, defineEventHandler, toWebHandler } from "h3";
import { describe, expect, it } from "vitest";
import cacheHeadersMiddleware from "./00-cache-headers";
import {
  getCloudflareCacheControl,
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
  setPublicCacheHeaders,
} from "../utils/cache/http";

describe("default cache headers middleware", () => {
  it("defaults dynamic Nitro responses to no-store and clears Cloudflare headers", async () => {
    const app = createApp();
    app.use("/", cacheHeadersMiddleware);
    app.use(
      "/",
      defineEventHandler(() => ({ ok: true })),
    );

    const response = await toWebHandler(app)(new Request("http://localhost/"));

    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });

  it("allows a provider-only success handler to opt in after the default", async () => {
    const app = createApp();
    app.use("/", cacheHeadersMiddleware);
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
    expect(response.headers.has("pragma")).toBe(false);
    expect(response.headers.has("expires")).toBe(false);
  });
});
