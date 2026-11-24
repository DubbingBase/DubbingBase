import { createEvent } from "h3";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Call {
  table: string;
  select: string;
  options: unknown;
  eq: [string, unknown][];
  order: [string, unknown][];
  range: [number, number][];
}

const mocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("./db/client", () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }));

import { listSitemapChunks, loadSitemapChunk } from "./sitemap-data";
import { SITEMAP_CHUNK_SIZE } from "./sitemap";

const request = new IncomingMessage(new Socket());
request.url = "/sitemap.xml";
const event = createEvent(request, new ServerResponse(request));

function createClient(
  respond: (call: Call) => { data?: unknown[]; count?: number; error?: Error | null },
) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, select: "", options: undefined, eq: [], order: [], range: [] };
      calls.push(call);
      const builder = {
        select(columns: string, options?: unknown) {
          call.select = columns;
          call.options = options;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.eq.push([column, value]);
          return builder;
        },
        order(column: string, options: unknown) {
          call.order.push([column, options]);
          return builder;
        },
        range(from: number, to: number) {
          call.range.push([from, to]);
          return builder;
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          const { data = null, count = null, error = null } = respond(call);
          return Promise.resolve({ data, count, error }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, calls };
}

describe("sitemap media chunks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts media having dubbing projects, per kind", async () => {
    const { client, calls } = createClient((call) => ({
      count: call.table === "media" ? 1 : 0,
    }));
    mocks.useSupabaseAdmin.mockReturnValue(client);

    const chunks = await listSitemapChunks(event);

    expect(chunks.map(({ name }) => name)).toEqual(["movies", "shows", "games"]);
    const mediaCalls = calls.filter((call) => call.table === "media");
    expect(mediaCalls.map((call) => call.eq)).toEqual([
      [["kind", "movie"]],
      [["kind", "tv"]],
      [["kind", "video_game"]],
    ]);
    for (const call of mediaCalls) {
      expect(call.select).toContain("dubbing_projects!inner");
      expect(call.options).toEqual({ count: "exact", head: true });
    }
  });

  it("builds paths from media.content_id with the newest project updated_at", async () => {
    const { client, calls } = createClient(() => ({
      data: [
        {
          content_id: 603,
          dubbing_projects: [
            { updated_at: "2026-01-01T00:00:00Z" },
            { updated_at: "2026-03-01T00:00:00Z" },
            { updated_at: null },
          ],
        },
        { content_id: 604, dubbing_projects: [{ updated_at: null }] },
      ],
    }));
    mocks.useSupabaseAdmin.mockReturnValue(client);

    const records = await loadSitemapChunk(event, "movies", 1);

    expect(records).toEqual([
      { path: "/movie/603", lastmod: "2026-03-01T00:00:00Z" },
      { path: "/movie/604", lastmod: null },
    ]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe("media");
    expect(calls[0]?.select).toContain("dubbing_projects!inner(updated_at)");
    expect(calls[0]?.eq).toEqual([["kind", "movie"]]);
    expect(calls[0]?.order).toEqual([["content_id", { ascending: true }]]);
    expect(calls[0]?.range).toEqual([[0, 999]]);
  });

  it("uses the show and game kinds and path prefixes", async () => {
    const row = { content_id: 9, dubbing_projects: [{ updated_at: "2026-02-02T00:00:00Z" }] };
    const { client, calls } = createClient(() => ({ data: [row] }));
    mocks.useSupabaseAdmin.mockReturnValue(client);

    await expect(loadSitemapChunk(event, "shows", 1)).resolves.toEqual([
      { path: "/show/9", lastmod: "2026-02-02T00:00:00Z" },
    ]);
    await expect(loadSitemapChunk(event, "games", 1)).resolves.toEqual([
      { path: "/game/9", lastmod: "2026-02-02T00:00:00Z" },
    ]);
    expect(calls.map((call) => call.eq)).toEqual([[["kind", "tv"]], [["kind", "video_game"]]]);
  });

  it("offsets the range of later chunks", async () => {
    const { client, calls } = createClient((call) => {
      const [start = 0, end = 0] = call.range[0] ?? [];
      return {
        data: Array.from({ length: end - start + 1 }, (_, i) => ({
          content_id: start + i,
          dubbing_projects: [{ updated_at: null }],
        })),
      };
    });
    mocks.useSupabaseAdmin.mockReturnValue(client);

    const records = await loadSitemapChunk(event, "movies", 2);

    expect(records).toHaveLength(SITEMAP_CHUNK_SIZE);
    expect(records[0]?.path).toBe(`/movie/${SITEMAP_CHUNK_SIZE}`);
    expect(calls[0]?.range[0]?.[0]).toBe(SITEMAP_CHUNK_SIZE);
    expect(calls[0]?.range).toEqual([[SITEMAP_CHUNK_SIZE, 2 * SITEMAP_CHUNK_SIZE - 1]]);
    expect(calls.every((call) => call.eq[0]?.[1] === "movie")).toBe(true);
  });

  it("throws Supabase errors", async () => {
    const error = new Error("boom");
    const { client } = createClient(() => ({ error }));
    mocks.useSupabaseAdmin.mockReturnValue(client);

    await expect(loadSitemapChunk(event, "movies", 1)).rejects.toBe(error);
  });
});
