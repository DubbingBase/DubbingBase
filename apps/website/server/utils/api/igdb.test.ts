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

function mockFetch() {
  let tokenFetchCount = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input) === tokenUrl) {
      tokenFetchCount += 1;
      return new Response(
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
  ])(
    "refreshes an %s instead of assigning a guessed expiry",
    async (_label, cachedValue) => {
      const values = new Map<string, unknown>([
        ["igdb:auth_token", cachedValue],
      ]);
      const fetch = mockFetch();
      const client = new IgdbClient(createCache(values));

      await client.query("games", "fields id;");
      await client.query("games", "fields id;");

      expect(fetch.tokenFetchCount).toBe(1);
      expect(values.get("igdb:auth_token")).toMatchObject({
        accessToken: "fresh-token",
        expiresAt: expect.any(Number),
      });
    },
  );

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
});
