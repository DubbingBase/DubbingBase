import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  getGameCharacters: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));
vi.mock("../../utils", () => ({
  useIgdbClient: () => ({ getGameCharacters: routeMocks.getGameCharacters }),
}));

let handler: typeof import("../../api/game-characters/[id].put").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getRouterParam", () => "11111111-1111-4111-8111-111111111111");
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/game-characters/[id].put")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({ id: "admin-1" });
  routeMocks.getGameCharacters.mockResolvedValue([{ id: 77, name: "Character" }]);
});

afterAll(() => vi.unstubAllGlobals());

function mockDatabase() {
  const rpc = vi.fn(async () => ({
    data: [
      {
        game_character_id: "11111111-1111-4111-8111-111111111111",
        updated_at: "2026-10-30T00:00:00Z",
        audit_log_id: "22222222-2222-4222-8222-222222222222",
        replayed: false,
      },
    ],
    error: null,
  }));
  const maybeSingle = vi.fn(async () => ({
    data: { igdb_game_id: 42 },
    error: null,
  }));
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  routeMocks.useSupabaseAdmin.mockReturnValue({
    from: vi.fn(() => builder),
    rpc,
  });
  return { rpc, maybeSingle };
}

async function put(body: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/11111111-1111-4111-8111-111111111111", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validBody = {
  request_id: "e65a9ae4-d053-4c2f-a85c-9273b95e1288",
  expected_updated_at: "2026-10-30T00:00:00Z",
  igdb_character_id: 77,
};

describe("PUT /api/game-characters/:id", () => {
  it("rechecks that a confirmed IGDB candidate belongs to the game's catalog", async () => {
    const { rpc } = mockDatabase();

    const response = await put(validBody);

    expect(response.status, await response.clone().text()).toBe(200);
    expect(routeMocks.getGameCharacters).toHaveBeenCalledWith(42);
    expect(rpc).toHaveBeenCalledWith("update_game_character_references", {
      p_actor_id: "admin-1",
      p_request_id: validBody.request_id,
      p_game_character_id: "11111111-1111-4111-8111-111111111111",
      p_expected_updated_at: validBody.expected_updated_at,
      p_references: { igdb_character_id: 77 },
    });
  });

  it("does not save a stale or unrelated IGDB character id", async () => {
    const { rpc } = mockDatabase();
    routeMocks.getGameCharacters.mockResolvedValue([{ id: 78, name: "Other" }]);

    const response = await put(validBody);

    expect(response.status, await response.clone().text()).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("leaves Wikidata updates independent of IGDB availability", async () => {
    const { rpc, maybeSingle } = mockDatabase();
    routeMocks.getGameCharacters.mockRejectedValue(new Error("offline"));

    const response = await put({
      request_id: validBody.request_id,
      expected_updated_at: validBody.expected_updated_at,
      wikidata_qid: "Q12345",
    });

    expect(response.status).toBe(200);
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(routeMocks.getGameCharacters).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith(
      "update_game_character_references",
      expect.objectContaining({ p_references: { wikidata_qid: "Q12345" } }),
    );
  });
});
