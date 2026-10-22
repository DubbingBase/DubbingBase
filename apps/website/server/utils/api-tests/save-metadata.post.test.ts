import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/save-metadata.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/save-metadata.post")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

type User = { id: string; app_metadata?: { role?: string } };
type RpcResult = { data: unknown; error: { code?: string } | null };

function createSupabaseMock(
  result: RpcResult = {
    data: {
      record: { id: 41, firstname: "Ada", lastname: "Example" },
      audit_log_id: "audit-1",
      replayed: false,
    },
    error: null,
  },
) {
  const rpc = vi.fn(async () => result);
  return { supabase: { rpc }, rpc };
}

async function post(options: {
  body: unknown;
  user?: User;
  authError?: { statusCode: number; message: string };
  result?: RpcResult;
}) {
  const { supabase, rpc } = createSupabaseMock(options.result);
  routeMocks.useSupabaseAdmin.mockReturnValue(supabase);
  routeMocks.requireAdmin.mockImplementation(() => {
    if (options.authError) {
      throw createError(options.authError);
    }
    return options.user;
  });

  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(options.body),
    }),
  );
  return { response, rpc };
}

describe("POST /api/save-metadata", () => {
  it.each([
    ["anonymous", { statusCode: 401, message: "Unauthorized" }],
    ["non-admin", { statusCode: 403, message: "Unauthorized: Admin access required" }],
  ])("rejects %s before invoking the service-role operation", async (_name, authError) => {
    const { response, rpc } = await post({
      body: { type: "voice_actor", payload: { firstname: "Ada", lastname: "Example" } },
      authError,
    });
    expect(response.status).toBe(authError.statusCode);
    expect(rpc).not.toHaveBeenCalled();
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("uses the actor-bound atomic RPC and returns its inserted record", async () => {
    const { response, rpc } = await post({
      body: { type: "voice_actor", payload: { firstname: "Ada", lastname: "Example" } },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { id: 41, firstname: "Ada", lastname: "Example" },
    });
    expect(rpc).toHaveBeenCalledWith("controlled_save_metadata", {
      p_actor_id: "admin-1",
      p_entity_type: "voice_actor",
      p_payload: { firstname: "Ada", lastname: "Example" },
    });
  });

  it("accepts an administrator request key for job creation", async () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    const { response, rpc } = await post({
      body: { type: "job", payload: { name: "Director" }, request_id: requestId },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
      result: {
        data: { record: { id: 4, name: "Director" }, audit_log_id: "audit-2", replayed: false },
        error: null,
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: 4, name: "Director" } });
    expect(rpc).toHaveBeenCalledWith("controlled_save_metadata", {
      p_actor_id: "admin-1",
      p_entity_type: "job",
      p_payload: { name: "Director" },
      p_request_id: requestId,
    });
  });

  it("rejects unknown entity types and protected fields before the privileged write", async () => {
    const user = { id: "admin-1", app_metadata: { role: "admin" } };
    for (const body of [
      { type: "work", payload: { id: 1 } },
      { type: "job", payload: { name: "Director", id: 99 } },
      {
        type: "voice_actor",
        payload: { firstname: "Ada", lastname: "Example", created_by: "other" },
      },
      { type: "job", payload: { name: "Director" }, user_id: "other" },
    ]) {
      const { response, rpc } = await post({ body, user });
      expect(response.status).toBe(400);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("maps duplicate entity conflicts to HTTP 409", async () => {
    const { response } = await post({
      body: { type: "job", payload: { name: "Director" } },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
      result: { data: null, error: { code: "23505" } },
    });
    expect(response.status).toBe(409);
  });
});
