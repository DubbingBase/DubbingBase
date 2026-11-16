import { createApp, createError, defineEventHandler, getQuery, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  resolveUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ resolveUser: routeMocks.resolveUser }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));
vi.mock("../urls/supabase", () => ({
  buildSupabaseImageUrl: (path: string) => `https://img.test/${path}`,
}));

let handler: typeof import("../../api/entity-history.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../../api/entity-history.get")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

const rows = [
  {
    id: "audit-1",
    created_at: "2026-11-14T10:00:00Z",
    action: "update",
    entity_type: "voice_actor",
    entity_id: "1",
    user_name: "Alice",
    previous_value: { bio: "Old", tmdb_id: null },
    new_value: { bio: "New", tmdb_id: 42 },
    reverted_at: null,
  },
];

async function get(query: string, user: unknown, current: Record<string, unknown> | null = null) {
  routeMocks.resolveUser.mockResolvedValue(user);
  const rpc = vi.fn(async () => ({ data: rows, error: null }));
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      in: vi.fn(async () => ({ data: current ? [current] : [], error: null })),
    })),
  }));
  routeMocks.useSupabaseAdmin.mockReturnValue({ rpc, from });
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  const response = await toWebHandler(app)(new Request(`http://localhost/?${query}`));
  return { response, rpc, from };
}

describe("GET /api/entity-history", () => {
  it("rejects invalid types and ids", async () => {
    expect((await get("type=users&id=1", null)).response.status).toBe(400);
    expect((await get("type=studio&id=1;drop", null)).response.status).toBe(400);
  });

  it("serves anonymous visitors the public history without revert capability", async () => {
    const { response, from } = await get("type=voice_actor&id=1", null);
    const body = await response.json();
    expect(body.canRevert).toBe(false);
    expect(body.entries[0]).toMatchObject({
      contributor: "Alice",
      important: true,
      revertable: false,
      reverted: false,
    });
    expect(body.entries[0].changes.map((change: { field: string }) => change.field)).toEqual([
      "bio",
      "tmdb_id",
    ]);
    // Anonymous requests never load current entity state.
    expect(from).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain("user_id");
  });

  it("tells admins which entries can still be reverted", async () => {
    const admin = { id: "admin-1", app_metadata: { role: "admin" } };
    const stillThere = await get("type=voice_actor&id=1", admin, {
      id: 1,
      updated_at: "2026-11-14T11:00:00Z",
      bio: "New",
      tmdb_id: 42,
    });
    const first = await stillThere.response.json();
    expect(first.canRevert).toBe(true);
    expect(first.entries[0].revertable).toBe(true);

    const changed = await get("type=voice_actor&id=1", admin, {
      id: 1,
      updated_at: "2026-11-14T11:00:00Z",
      bio: "Fixed by someone else",
      tmdb_id: 42,
    });
    const second = await changed.response.json();
    expect(second.entries[0]).toMatchObject({
      revertable: false,
      revertBlockedReason: "changed_since",
    });
  });
});
