import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { buildCacheKey } from "../cache/constants";
import { OpenLibraryClient } from "./openlibrary";

afterEach(() => vi.unstubAllGlobals());

describe("OpenLibrary persistence policy", () => {
  it("does not read or write KV for search results", async () => {
    let reads = 0;
    let writes = 0;
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ docs: [] })));
    const client = new OpenLibraryClient(
      new SimpleCache(() => ({
        get: async () => {
          reads += 1;
          return null;
        },
        put: async () => {
          writes += 1;
        },
      })),
    );

    await expect(client.searchBooks("example")).resolves.toEqual([]);

    expect(reads).toBe(0);
    expect(writes).toBe(0);
  });

  it("fetches book details directly without reading or writing KV", async () => {
    const values = new Map<string, unknown>();
    let fetches = 0;
    const reads: string[] = [];
    const writes: string[] = [];
    vi.stubGlobal("fetch", async () => {
      fetches += 1;
      return new Response(JSON.stringify({ title: "Shared detail" }));
    });
    const client = new OpenLibraryClient(
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

    await client.getBook(42);
    await client.getBook(42);

    expect(fetches).toBe(2);
    expect(reads).toEqual([]);
    expect(writes).toEqual([]);
    expect(values.size).toBe(0);
  });

  it("retains the small shared author-name mapping in KV", async () => {
    const values = new Map<string, unknown>();
    const reads: string[] = [];
    const writes: string[] = [];
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: "Shared Author" })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new OpenLibraryClient(
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

    await client.getAuthorName("/authors/OL1A");
    await client.getAuthorName("OL1A");

    const key = buildCacheKey({ provider: "openlibrary", resource: "author", id: "OL1A" });
    expect(reads).toEqual([key, key]);
    expect(writes).toEqual([key]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
