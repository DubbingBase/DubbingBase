import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/delete-voice-actor-link.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/delete-voice-actor-link.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockReturnValue({ id: "voice-owner-1" });
});

afterAll(() => vi.unstubAllGlobals());

const body = {
  request_id: "e65a9ae4-d053-4c2f-a85c-9273b95e1288",
  id: 73,
  expected_updated_at: "2026-10-15T12:00:00.000Z",
};

function createSupabaseMock(result: {
  data: Array<{ work_id: number; audit_log_id: string; replayed: boolean }> | null;
  error: { code: string } | null;
}) {
  const rpc = vi.fn(async () => result);
  const from = vi.fn();
  routeMocks.useSupabaseAdmin.mockReturnValue({ from, rpc });
  return { from, rpc };
}

async function post(requestBody: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = { id: "voice-owner-1" };
      return handler(event);
    }),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }),
  );
}

describe("POST /api/delete-voice-actor-link", () => {
  it("uses the authenticated actor and preserves a typed audit response", async () => {
    const { from, rpc } = createSupabaseMock({
      data: [{ work_id: 73, audit_log_id: "audit-delete-1", replayed: false }],
      error: null,
    });

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Voice actor link deleted successfully",
      auditLogId: "audit-delete-1",
      replayed: false,
    });
    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("delete_voice_actor_work_link", {
      p_user_id: "voice-owner-1",
      p_request_id: body.request_id,
      p_work_id: body.id,
      p_expected_updated_at: body.expected_updated_at,
    });
  });

  it("rejects target user impersonation before calling the RPC", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: null });

    const response = await post({ ...body, targetUserId: "another-user" });

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports dependent records as a conflict instead of claiming success", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: { code: "23503" } });

    const response = await post(body);

    expect(response.status).toBe(409);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
