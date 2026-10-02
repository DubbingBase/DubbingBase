import { afterEach, describe, expect, it, vi } from "vitest";
import { SimpleCache } from "../cache";
import { OpenLibraryClient } from "./openlibrary";

afterEach(() => vi.unstubAllGlobals());

describe("OpenLibrary persistence policy", () => {
  it("does not read or write KV for search results", async () => {
    let reads = 0;
    let writes = 0;
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ docs: [] })),
    );
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

  it("retains shared KV for book details used by uncached internal reads", async () => {
    const values = new Map<string, unknown>();
    let fetches = 0;
    vi.stubGlobal("fetch", async () => {
      fetches += 1;
      return new Response(JSON.stringify({ title: "Shared detail" }));
    });
    const client = new OpenLibraryClient(
      new SimpleCache(() => ({
        get: async (key) => values.get(key) ?? null,
        put: async (key, value) => values.set(key, JSON.parse(value)),
      })),
    );

    await client.getBook(42);
    await client.getBook(42);

    expect(fetches).toBe(1);
    expect(values.size).toBe(1);
  });
});
