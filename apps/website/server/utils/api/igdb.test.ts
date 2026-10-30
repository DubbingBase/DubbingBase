import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { IgdbClient } from "./igdb";

const tokenUrl = "https://id.twitch.tv/oauth2/token";

function createCache(values: Map<string, unknown>, failDelete = false) {
  return new SimpleCache(() => ({
    get: async (key) => values.get(key) ?? null,
    put: async (key, value) => values.set(key, JSON.parse(value)),
    delete: async (key) => {
      if (failDelete) throw new Error("KV delete failed");
      values.delete(key);
    },
  }));
}

function mockFetch(tokenBody = "") {
  let tokenFetchCount = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === tokenUrl) {
      tokenFetchCount += 1;
      return new Response(
        tokenBody ||
          JSON.stringify({
            access_token: "fresh-token",
            expires_in: 7200,
            token_type: "bearer",
          }),
      );
    }
    return new Response("[]");
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("useRuntimeConfig", () => ({
    igdbClientId: "client-id",
    igdbClientSecret: "client-secret",
  }));
  return {
    fetchMock,
    get tokenFetchCount() {
      return tokenFetchCount;
    },
  };
}

describe("IgdbClient token cache expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not cache search, trending, game, or character metadata", async () => {
    const values = new Map<string, unknown>([
      ["igdb:auth_token", { accessToken: "cached-token", expiresAt: Date.now() + 60_000 }],
    ]);
    const fetch = mockFetch();
    const reads: string[] = [];
    const writes: string[] = [];
    const client = new IgdbClient(
      new SimpleCache(() => ({
        get: async (key) => {
          reads.push(key);
          return values.get(key) ?? null;
        },
        put: async (key, value) => {
          writes.push(key);
          values.set(key, JSON.parse(value));
        },
      })),
    );

    await client.searchGames("example");
    await client.getTrendingGames();
    await client.getGame(42);
    await client.getGameCharacters(42);

    expect(reads).toEqual(["igdb:auth_token"]);
    expect(writes).toEqual([]);
    expect(fetch.tokenFetchCount).toBe(0);
  });

  it("fetches game metadata on every request while retaining the token cache", async () => {
    const values = new Map<string, unknown>([
      ["igdb:auth_token", { accessToken: "cached-token", expiresAt: Date.now() + 60_000 }],
    ]);
    const reads: string[] = [];
    const writes: string[] = [];
    let gameFetches = 0;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      if (String(input) === tokenUrl) {
        return new Response("{}", { status: 500 });
      }
      gameFetches += 1;
      return new Response(JSON.stringify([{ id: 42, name: "Game" }]));
    });
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "client-id",
      igdbClientSecret: "client-secret",
    }));
    const client = new IgdbClient(
      new SimpleCache(() => ({
        get: async (key) => {
          reads.push(key);
          return values.get(key) ?? null;
        },
        put: async (key, value) => {
          writes.push(key);
          values.set(key, JSON.parse(value));
        },
      })),
    );

    await client.getGame(42);
    await client.getGame(42);

    expect(gameFetches).toBe(2);
    expect(reads).toEqual(["igdb:auth_token"]);
    expect(writes).toEqual([]);
    expect(values.size).toBe(1);
  });

  it("restores a cached expiry and reuses the token only until that expiry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const expiresAt = Date.now() + 10_000;
    const values = new Map<string, unknown>([
      ["igdb:auth_token", { accessToken: "cached-token", expiresAt }],
    ]);
    const fetch = mockFetch();
    const client = new IgdbClient(createCache(values));

    await client.query("games", "fields id;");
    vi.setSystemTime(expiresAt - 1);
    await client.query("games", "fields id;");
    expect(fetch.tokenFetchCount).toBe(0);

    vi.setSystemTime(expiresAt);
    await client.query("games", "fields id;");
    expect(fetch.tokenFetchCount).toBe(1);
    expect(values.get("igdb:auth_token")).toMatchObject({
      accessToken: "fresh-token",
      expiresAt: expect.any(Number),
    });
  });

  it.each([
    ["expired token metadata", { accessToken: "expired-token", expiresAt: 0 }],
    ["legacy string token", "legacy-token"],
    ["empty cached token", { accessToken: " ", expiresAt: Date.now() + 60_000 }],
  ])("refreshes an %s instead of assigning a guessed expiry", async (_label, cachedValue) => {
    const values = new Map<string, unknown>([["igdb:auth_token", cachedValue]]);
    const fetch = mockFetch();
    const client = new IgdbClient(createCache(values));

    await client.query("games", "fields id;");
    await client.query("games", "fields id;");

    expect(fetch.tokenFetchCount).toBe(1);
    expect(values.get("igdb:auth_token")).toMatchObject({
      accessToken: "fresh-token",
      expiresAt: expect.any(Number),
    });
  });

  it("bounds stale-token recovery when KV deletion fails", async () => {
    const values = new Map<string, unknown>([
      ["igdb:auth_token", { accessToken: "expired-token", expiresAt: 0 }],
    ]);
    const fetch = mockFetch();
    const client = new IgdbClient(createCache(values, true));

    await client.query("games", "fields id;");
    await client.query("games", "fields id;");

    expect(fetch.tokenFetchCount).toBe(1);
    expect(values.get("igdb:auth_token")).toMatchObject({
      accessToken: "expired-token",
      expiresAt: 0,
    });
  });

  it("fetches game details and localizations concurrently without changing game order", async () => {
    const values = new Map<string, unknown>([
      ["igdb:auth_token", { accessToken: "cached-token", expiresAt: Date.now() + 60_000 }],
    ]);
    const pendingRequests = new Map<string, (response: Response) => void>();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/popularity_primitives")) {
        return new Response(
          JSON.stringify([
            { game_id: 42, popularity_type: 1, value: 100 },
            { game_id: 7, popularity_type: 1, value: 80 },
          ]),
        );
      }

      const endpoint = url.endsWith("/games")
        ? "games"
        : url.endsWith("/game_localizations")
          ? "game_localizations"
          : null;
      if (endpoint === null) throw new Error(`Unexpected IGDB request: ${url}`);

      return new Promise<Response>((resolve) => {
        pendingRequests.set(endpoint, resolve);
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "client-id",
      igdbClientSecret: "client-secret",
    }));

    const client = new IgdbClient(createCache(values));
    const trendingGames = client.getTrendingGames(2, "fr-FR");

    await vi.waitFor(() => {
      expect([...pendingRequests.keys()]).toEqual(
        expect.arrayContaining(["games", "game_localizations"]),
      );
    });

    pendingRequests.get("games")?.(
      new Response(
        JSON.stringify([
          { id: 7, name: "Seven" },
          { id: 42, name: "Forty-two" },
        ]),
      ),
    );
    pendingRequests.get("game_localizations")?.(
      new Response(
        JSON.stringify([
          { game: 42, name: "Quarante-deux", region: { identifier: "fr-FR" } },
          { game: 7, name: "Sept", region: { identifier: "fr-FR" } },
        ]),
      ),
    );

    await expect(trendingGames).resolves.toMatchObject({
      degraded: false,
      games: [
        { id: 7, name: "Sept" },
        { id: 42, name: "Quarante-deux" },
      ],
    });
  });

  it.each([
    ["empty access token", '{"access_token":"","expires_in":7200}'],
    ["whitespace access token", '{"access_token":" ","expires_in":7200}'],
    ["missing access token", '{"expires_in":7200}'],
    ["non-numeric expiry", '{"access_token":"token","expires_in":"7200"}'],
    ["non-finite expiry", '{"access_token":"token","expires_in":1e999}'],
    ["non-positive expiry", '{"access_token":"token","expires_in":0}'],
  ])("rejects and does not cache a response with %s", async (_label, body) => {
    const values = new Map<string, unknown>();
    const fetch = mockFetch(body);
    const client = new IgdbClient(createCache(values));

    await expect(client.query("games", "fields id;")).rejects.toThrow(
      "Invalid Twitch OAuth token response",
    );
    await expect(client.query("games", "fields id;")).rejects.toThrow(
      "Invalid Twitch OAuth token response",
    );

    expect(fetch.tokenFetchCount).toBe(2);
    expect(values.has("igdb:auth_token")).toBe(false);
  });
});

describe("IgdbClient game characters", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([0, 50, 51, 1001])("retrieves all %i matching characters", async (count) => {
    const requests: string[] = [];
    const characters = Array.from({ length: count }, (_, index) => ({
      id: index + 1,
      name: `Character ${index + 1}`,
    }));
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "client-id",
      igdbClientSecret: "client-secret",
    }));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === tokenUrl) {
        return new Response(
          JSON.stringify({
            access_token: "fresh-token",
            expires_in: 7200,
            token_type: "bearer",
          }),
        );
      }
      requests.push(String(init?.body));
      const offset = requests.length === 1 ? 0 : requests.length === 2 ? 500 : 1000;
      return new Response(JSON.stringify(characters.slice(offset, offset + 500)));
    });
    const client = new IgdbClient(createCache(new Map()));

    const result = await client.getGameCharacters(42);

    expect(result).toHaveLength(count);
    expect(result[0]?.id).toBe(count > 0 ? 1 : undefined);
    expect(result.at(-1)?.id).toBe(count > 0 ? count : undefined);
    expect(requests).toHaveLength(count > 500 ? Math.ceil(count / 500) : 1);
    expect(requests[0]).toContain("sort id asc;");
    expect(requests[0]).toContain("limit 500;");
    expect(requests[0]).toContain("offset 0;");
    if (requests[1]) expect(requests[1]).toContain("offset 500;");
    if (requests[2]) expect(requests[2]).toContain("offset 1000;");
  });

  it("deduplicates IDs across pages", async () => {
    const requests: string[] = [];
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "client-id",
      igdbClientSecret: "client-secret",
    }));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === tokenUrl) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 7200 }));
      }
      requests.push(String(init?.body));
      const page =
        requests.length === 1
          ? Array.from({ length: 500 }, (_, index) => ({
              id: index + 1,
              name: `Character ${index + 1}`,
            }))
          : [
              { id: 500, name: "Duplicate" },
              { id: 501, name: "Character 501" },
            ];
      return new Response(JSON.stringify(page));
    });
    const client = new IgdbClient(createCache(new Map()));

    const result = await client.getGameCharacters(42);

    expect(result).toHaveLength(501);
    expect(result.at(-1)?.id).toBe(501);
  });

  it("rejects a result beyond its bounded request window", async () => {
    const requests: string[] = [];
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "client-id",
      igdbClientSecret: "client-secret",
    }));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === tokenUrl) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 7200 }));
      }
      requests.push(String(init?.body));
      return new Response(
        JSON.stringify(
          Array.from({ length: 500 }, (_, index) => ({
            id: index + 1,
            name: `Character ${index + 1}`,
          })),
        ),
      );
    });
    const client = new IgdbClient(createCache(new Map()));

    await expect(client.getGameCharacters(42)).rejects.toThrow("at least 2500 characters");
    expect(requests).toHaveLength(5);
  });

  it("rejects a later page failure instead of returning a partial catalog", async () => {
    let characterRequests = 0;
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "client-id",
      igdbClientSecret: "client-secret",
    }));
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      if (String(input) === tokenUrl) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 7200 }));
      }
      characterRequests++;
      if (characterRequests === 1) {
        return new Response(
          JSON.stringify(
            Array.from({ length: 500 }, (_, index) => ({
              id: index + 1,
              name: `Character ${index + 1}`,
            })),
          ),
        );
      }
      return new Response("provider unavailable", { status: 503 });
    });
    const client = new IgdbClient(createCache(new Map()));

    await expect(client.getGameCharacters(42)).rejects.toThrow("IGDB API error: 503");
    expect(characterRequests).toBe(2);
  });
});
