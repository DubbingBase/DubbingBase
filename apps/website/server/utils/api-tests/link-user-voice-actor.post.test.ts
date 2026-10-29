import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const actorId = "56365001-0000-4000-8000-000000000001";
const targetUserId = "56365001-0000-4000-8000-000000000002";
const requestId = "56365001-0000-4000-8000-000000000003";

const rpcMock = vi.hoisted(() => vi.fn());

let handler: typeof import("../../api/link-user-voice-actor.post").default;
let actor: { id: string; app_metadata: { role: string } } | undefined = {
  id: actorId,
  app_metadata: { role: "admin" },
};

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/link-user-voice-actor.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  actor = { id: actorId, app_metadata: { role: "admin" } };
  rpcMock.mockResolvedValue({
    data: [{ link_id: "link-id", created: true, audit_log_id: "audit-id", replayed: false }],
    error: null,
  });
});

afterAll(() => vi.unstubAllGlobals());

async function post(body: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = actor;
      event.context.supabase = { rpc: rpcMock };
      return handler(event);
    }),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/link-user-voice-actor", () => {
  it("uses the authenticated administrator and returns the audit result", async () => {
    const response = await post({
      request_id: requestId,
      user_id: targetUserId,
      voice_actor_id: 41,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      alreadyLinked: false,
      auditLogId: "audit-id",
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith("admin_link_user_voice_actor_controlled", {
      p_actor_id: actorId,
      p_request_id: requestId,
      p_user_id: targetUserId,
      p_voice_actor_id: 41,
    });
  });

  it("preserves the legacy default of linking the administrator's own account", async () => {
    const response = await post({ request_id: requestId, voice_actor_id: 41 });

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("admin_link_user_voice_actor_controlled", {
      p_actor_id: actorId,
      p_request_id: requestId,
      p_user_id: actorId,
      p_voice_actor_id: 41,
    });
  });

  it("treats an identical existing relationship as a retry without another audit", async () => {
    rpcMock.mockResolvedValue({
      data: [{ link_id: "link-id", created: false, audit_log_id: "audit-id", replayed: false }],
      error: null,
    });

    const response = await post({ request_id: requestId, targetUserId, voice_actor_id: "41" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, alreadyLinked: true });
  });

  it("rejects non-admins and unknown or mismatched fields before the RPC", async () => {
    actor = { id: actorId, app_metadata: { role: "user" } };
    const unauthorized = await post({
      request_id: requestId,
      user_id: targetUserId,
      voice_actor_id: 41,
    });
    actor = { id: actorId, app_metadata: { role: "admin" } };
    const unknown = await post({
      request_id: requestId,
      user_id: targetUserId,
      voice_actor_id: 41,
      created_by: actorId,
    });
    const mismatched = await post({
      user_id: targetUserId,
      targetUserId: actorId,
      voice_actor_id: 41,
      request_id: requestId,
    });

    expect(unauthorized.status).toBe(403);
    expect(unknown.status).toBe(400);
    expect(mismatched.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects anonymous and malformed requests before the RPC", async () => {
    actor = undefined;
    const anonymous = await post({
      request_id: requestId,
      user_id: targetUserId,
      voice_actor_id: 41,
    });
    actor = { id: actorId, app_metadata: { role: "admin" } };
    const malformed = await post({
      request_id: "not-a-uuid",
      user_id: "not-a-uuid",
      voice_actor_id: -1,
    });

    expect(anonymous.status).toBe(401);
    expect(malformed.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("maps relationship conflicts and fails closed on database errors", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "23505" } });
    const conflict = await post({
      request_id: requestId,
      user_id: targetUserId,
      voice_actor_id: 41,
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "XX000" } });
    const failed = await post({ request_id: requestId, user_id: targetUserId, voice_actor_id: 41 });

    expect(conflict.status).toBe(409);
    expect(failed.status).toBe(500);
  });

  it("returns the original result for a stable request retry", async () => {
    rpcMock.mockResolvedValue({
      data: [{ link_id: "link-id", created: true, audit_log_id: "audit-id", replayed: true }],
      error: null,
    });

    const response = await post({
      request_id: requestId,
      user_id: targetUserId,
      voice_actor_id: 41,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      alreadyLinked: false,
      replayed: true,
    });
  });

  it("maps request ID reuse with a different payload to a conflict", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P2001" } });

    const response = await post({
      request_id: requestId,
      user_id: targetUserId,
      voice_actor_id: 42,
    });

    expect(response.status).toBe(409);
  });
});
