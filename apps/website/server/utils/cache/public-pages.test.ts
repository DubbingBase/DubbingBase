import { describe, expect, it } from "vitest";
import { isPublicCacheablePage, shouldCachePublicPage } from "./public-pages";

const base = {
  method: "GET",
  pathname: "/movie/550",
  status: 200,
  cookieHeader: undefined,
  authorizationHeader: undefined,
  supabaseCookiePrefix: "sb-abc-auth-token",
};

describe("isPublicCacheablePage", () => {
  it.each([
    "/",
    "/fr",
    "/movies",
    "/fr/series",
    "/voice-actors/",
    "/movie/550",
    "/ja/show/1399",
    "/es/voice-actor/12",
    "/actor/287",
    "/fr/actor/287",
    "/game/12345",
    "/fr/game/12345",
  ])("allows %s", (path) => expect(isPublicCacheablePage(path)).toBe(true));

  it.each([
    "/admin",
    "/profile",
    "/login",
    "/search",
    "/voice-actor/new",
    "/movie/550/edit",
    "/actor/287/edit",
    "/game/new",
    "/game/12345/edit",
    "/api/trending/movies",
  ])("rejects %s", (path) => expect(isPublicCacheablePage(path)).toBe(false));
});

describe("shouldCachePublicPage", () => {
  it("caches anonymous successful GETs", () => {
    expect(shouldCachePublicPage(base)).toBe(true);
  });

  it("does not cache signed-in, authorized, failed or non-GET requests", () => {
    expect(
      shouldCachePublicPage({
        ...base,
        cookieHeader: "theme=x; sb-abc-auth-token.0=x",
      }),
    ).toBe(false);
    expect(shouldCachePublicPage({ ...base, authorizationHeader: "Bearer x" })).toBe(false);
    expect(shouldCachePublicPage({ ...base, status: 404 })).toBe(false);
    expect(shouldCachePublicPage({ ...base, method: "POST" })).toBe(false);
  });
});
