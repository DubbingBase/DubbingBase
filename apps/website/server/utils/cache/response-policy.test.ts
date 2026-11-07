import { appendResponseHeader, createApp, defineEventHandler, toWebHandler } from "h3";
import { describe, expect, it } from "vitest";
import {
  getCloudflareCacheControl,
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
  setPublicCacheHeaders,
} from "./http";
import {
  applyCachePolicy,
  applyDefaultCachePolicy,
  resolveCacheDecision,
  type CacheDecisionInput,
} from "./response-policy";

const base: CacheDecisionInput = {
  method: "GET",
  pathname: "/movie/550",
  status: 200,
  cookieHeader: undefined,
  authorizationHeader: undefined,
  supabaseCookiePrefix: "sb-abc-auth-token",
  existingCacheControl: undefined,
  isDev: false,
};

describe("resolveCacheDecision", () => {
  it("shares anonymous allow-listed pages", () => {
    expect(resolveCacheDecision(base)).toBe("page");
    expect(
      resolveCacheDecision({ ...base, pathname: "/game/1942", disablePublicPageCache: true }),
    ).toBe("no-store");
  });

  it("never caches in development or on errors, even for allow-listed pages", () => {
    expect(resolveCacheDecision({ ...base, isDev: true })).toBe("no-store");
    expect(resolveCacheDecision({ ...base, status: 500 })).toBe("no-store");
    expect(
      resolveCacheDecision({
        ...base,
        status: 404,
        pathname: "/api/trending/movies",
        existingCacheControl: "public, max-age=60",
      }),
    ).toBe("no-store");
  });

  it("keeps an explicit public opt-in from a handler", () => {
    expect(
      resolveCacheDecision({
        ...base,
        pathname: "/api/trending/movies",
        existingCacheControl: "public, max-age=60",
      }),
    ).toBe("keep");
  });

  it("defaults everything else to no-store", () => {
    expect(resolveCacheDecision({ ...base, pathname: "/api/anything" })).toBe("no-store");
    expect(resolveCacheDecision({ ...base, pathname: "/admin" })).toBe("no-store");
    expect(resolveCacheDecision({ ...base, cookieHeader: "sb-abc-auth-token.0=x" })).toBe(
      "no-store",
    );
  });
});

describe("applyCachePolicy", () => {
  async function request(
    path: string,
    handler: Parameters<typeof defineEventHandler>[0],
    headers?: Record<string, string>,
  ): Promise<Response> {
    const app = createApp({
      onRequest: applyDefaultCachePolicy,
      onBeforeResponse: (event) =>
        applyCachePolicy(event, {
          isDev: false,
          supabaseCookiePrefix: "sb-abc-auth-token",
        }),
    });
    app.use("/", defineEventHandler(handler));
    return toWebHandler(app)(new Request(`http://localhost${path}`, { headers }));
  }

  it("defaults dynamic responses to no-store and clears Cloudflare headers", async () => {
    const response = await request("/api/x", () => ({ ok: true }));

    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });

  it("lets a provider-only handler opt in", async () => {
    const response = await request("/api/trending/movies", (event) => {
      setPublicCacheHeaders(event, "discovery");
      return { results: [] };
    });

    expect(response.headers.get("cache-control")).toBe(getPublicCacheControl("discovery"));
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      getCloudflareCacheControl("discovery"),
    );
    expect(response.headers.has("pragma")).toBe(false);
  });

  it("caches an anonymous allow-listed page and strips cookies", async () => {
    const response = await request("/movies", (event) => {
      appendResponseHeader(event, "set-cookie", "a=b");
      return "<html></html>";
    });

    expect(response.headers.get("cache-control")).toBe(getPublicCacheControl("page"));
    expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
      getCloudflareCacheControl("page"),
    );
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("keeps a degraded public page out of the shared cache", async () => {
    const response = await request("/game/1942", (event) => {
      event.context.disablePublicPageCache = true;
      return "<html>degraded</html>";
    });

    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
  });

  it("does not cache the same page for a signed-in request", async () => {
    const response = await request("/movies", () => "<html></html>", {
      // happy-dom's Request drops forbidden `cookie` headers; the cookie path is
      // covered by the resolveCacheDecision tests above.
      authorization: "Bearer token",
    });

    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
  });
});
