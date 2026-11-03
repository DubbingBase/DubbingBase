import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/game-characters.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/game-characters.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({
    id: "admin-1",
    app_metadata: { role: "admin" },
  });
});

afterAll(() => vi.unstubAllGlobals());

function mockCreate(result: unknown) {
  const rpc = vi.fn(async () => result);
  routeMocks.useSupabaseAdmin.mockReturnValue({ rpc });
  return rpc;
}

async function post(body: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const validBody = {
  request_id: "e65a9ae4-d053-4c2f-a85c-9273b95e1288",
  igdb_game_id: 42,
  name: "  New Character  ",
};

describe("POST /api/game-characters", () => {
  it("requires an administrator before calling the controlled create", async () => {
    routeMocks.requireAdmin.mockImplementation(() => {
      throw createError({ statusCode: 401, message: "Unauthorized" });
    });
    mockCreate({ data: null, error: null });

    const response = await post(validBody);

    expect(response.status).toBe(401);
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects unknown fields and invalid identities before the RPC", async () => {
    const rpc = mockCreate({ data: null, error: null });

    const response = await post({ ...validBody, character_id: 42 });

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("creates with the authenticated actor and returns the stable local ID", async () => {
    const rpc = mockCreate({
      data: [
        {
          game_character_id: "11111111-1111-4111-8111-111111111111",
          audit_log_id: "22222222-2222-4222-8222-222222222222",
          replayed: false,
        },
      ],
      error: null,
    });

    const response = await post(validBody);

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("create_game_character", {
      p_actor_id: "admin-1",
      p_request_id: validBody.request_id,
      p_igdb_game_id: 42,
      p_name: "  New Character  ",
    });
    await expect(response.json()).resolves.toEqual({
      character: {
        id: "11111111-1111-4111-8111-111111111111",
        igdb_game_id: 42,
        name: "New Character",
        igdb_character_id: null,
        wikidata_qid: null,
      },
      auditLogId: "22222222-2222-4222-8222-222222222222",
      replayed: false,
    });
  });

  it("returns a conflict when a request id is reused", async () => {
    mockCreate({ data: null, error: { code: "23505" } });

    const response = await post(validBody);

    expect(response.status).toBe(409);
  });
});
