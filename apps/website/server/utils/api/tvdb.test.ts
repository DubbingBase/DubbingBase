import { afterEach, describe, expect, it, vi } from "vitest";
import { CACHE_TTL, SimpleCache } from "../cache";
import { buildCacheKey } from "../cache/constants";
import { TVDBClient } from "./tvdb";

afterEach(() => vi.unstubAllGlobals());

describe("TVDB persistence policy", () => {
  it("keeps auth tokens and character mappings in KV", async () => {
    const values = new Map<string, unknown>();
    const writeTtls: number[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/login")) {
        return new Response(JSON.stringify({ data: { token: "fresh-token" } }));
      }
      return new Response(
        JSON.stringify({ data: { id: 42, name: "Character" } }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({ tvdbApiKey: "test-key" }));
    const client = new TVDBClient(
      new SimpleCache(() => ({
        get: async (key) => values.get(key) ?? null,
        put: async (key, value, options) => {
          writeTtls.push(options.expirationTtl);
          values.set(key, JSON.parse(value));
        },
      })),
    );

    await client.getCharacterById(42);
    await client.getCharacterById(42);

    expect(values.get("tvdb:auth_token")).toBe("fresh-token");
    expect(
      values.get(
        buildCacheKey({ provider: "tvdb", resource: "character", id: 42 }),
      ),
    ).toMatchObject({
      data: { id: 42, name: "Character" },
    });
    expect(writeTtls).toContain(CACHE_TTL.STABLE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not persist search results", async () => {
    const values = new Map<string, unknown>([
      ["tvdb:auth_token", "cached-token"],
    ]);
    const reads: string[] = [];
    const writes: string[] = [];
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ data: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({ tvdbApiKey: "test-key" }));
    const client = new TVDBClient(
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

    await client.searchSeries("example");

    expect(reads).toEqual(["tvdb:auth_token"]);
    expect(writes).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
