import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { TVDBClient } from "./tvdb";

afterEach(() => vi.unstubAllGlobals());

describe("TVDB persistence policy", () => {
  it("keeps auth tokens in KV but fetches metadata without KV", async () => {
    const reads: string[] = [];
    const writes: Array<[string, number]> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/login")) {
        return new Response(JSON.stringify({ data: { token: "fresh-token" } }));
      }
      return new Response(JSON.stringify({ data: { id: 42, name: "Character" } }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({ tvdbApiKey: "test-key" }));
    const client = new TVDBClient(
      new SimpleCache(() => ({
        get: async (key) => {
          reads.push(key);
          return null;
        },
        put: async (key, _value, options) => {
          writes.push([key, options.expirationTtl]);
        },
      })),
    );

    await client.getSeriesById(42);
    await client.getSeriesById(42);

    expect(reads).toEqual(["tvdb:auth_token"]);
    expect(writes).toEqual([["tvdb:auth_token", 23 * 60 * 60]]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not persist search results", async () => {
    const values = new Map<string, unknown>([["tvdb:auth_token", "cached-token"]]);
    const reads: string[] = [];
    const writes: string[] = [];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] })));
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
