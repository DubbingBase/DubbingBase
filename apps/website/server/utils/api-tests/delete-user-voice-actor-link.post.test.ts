import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const actorId = "56365002-0000-4000-8000-000000000001";
const targetUserId = "56365002-0000-4000-8000-000000000002";
const requestId = "56365002-0000-4000-8000-000000000003";
const linkId = "56365002-0000-4000-8000-000000000004";

const rpcMock = vi.hoisted(() => vi.fn());

let handler: typeof import("../../api/delete-user-voice-actor-link.post").default;
let actor: { id: string; app_metadata: { role: string } } | undefined = {
  id: actorId,
  app_metadata: { role: "user" },
};

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/delete-user-voice-actor-link.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  actor = { id: actorId, app_metadata: { role: "user" } };
  rpcMock.mockResolvedValue({
    data: [{ deleted: true, audit_log_id: "audit-id", replayed: false }],
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

describe("POST /api/delete-user-voice-actor-link", () => {
  it("lets a user remove their own link through the audited RPC", async () => {
    const response = await post({
      request_id: requestId,
      expected_link_id: linkId,
      voice_actor_id: 41,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      removed: true,
      auditLogId: "audit-id",
    });
    expect(rpcMock).toHaveBeenCalledWith("delete_user_voice_actor_link_controlled", {
      p_actor_id: actorId,
      p_request_id: requestId,
      p_user_id: actorId,
      p_voice_actor_id: 41,
      p_expected_link_id: linkId,
    });
  });

  it("allows administrators to unlink another user", async () => {
    actor = { id: actorId, app_metadata: { role: "admin" } };

    const response = await post({
      request_id: requestId,
      expected_link_id: linkId,
      targetUserId,
      voice_actor_id: 41,
    });

    expect(response.status).toBe(200);
    expect(rpcMock).toHaveBeenCalledWith("delete_user_voice_actor_link_controlled", {
      p_actor_id: actorId,
      p_request_id: requestId,
      p_user_id: targetUserId,
      p_voice_actor_id: 41,
      p_expected_link_id: linkId,
    });
  });

  it("rejects impersonation and unknown fields before the RPC", async () => {
    const unauthorized = await post({
      request_id: requestId,
      expected_link_id: linkId,
      user_id: targetUserId,
      voice_actor_id: 41,
    });
    const unknown = await post({
      request_id: requestId,
      expected_link_id: linkId,
      voice_actor_id: 41,
      actor_id: targetUserId,
    });

    expect(unauthorized.status).toBe(403);
    expect(unknown.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects anonymous and malformed requests before the RPC", async () => {
    actor = undefined;
    const anonymous = await post({
      request_id: requestId,
      expected_link_id: linkId,
      voice_actor_id: 41,
    });
    actor = { id: actorId, app_metadata: { role: "user" } };
    const malformed = await post({
      request_id: "bad",
      expected_link_id: linkId,
      voice_actor_id: "0",
    });

    expect(anonymous.status).toBe(401);
    expect(malformed.status).toBe(400);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("keeps missing-link retries idempotent and maps database failures", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ deleted: false, audit_log_id: null, replayed: false }],
      error: null,
    });
    const missing = await post({
      request_id: requestId,
      expected_link_id: linkId,
      voice_actor_id: 41,
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501" } });
    const unauthorized = await post({
      request_id: requestId,
      expected_link_id: linkId,
      voice_actor_id: 41,
    });

    expect(missing.status).toBe(200);
    expect(await missing.json()).toMatchObject({ success: true, removed: false });
    expect(unauthorized.status).toBe(403);
  });

  it("returns the original delete result on retry and maps stale links to conflicts", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ deleted: true, audit_log_id: "audit-id", replayed: true }],
      error: null,
    });
    const replay = await post({
      request_id: requestId,
      expected_link_id: linkId,
      voice_actor_id: 41,
    });
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "P2001" } });
    const stale = await post({
      request_id: requestId,
      expected_link_id: linkId,
      voice_actor_id: 41,
    });

    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ removed: true, replayed: true });
    expect(stale.status).toBe(409);
  });
});
