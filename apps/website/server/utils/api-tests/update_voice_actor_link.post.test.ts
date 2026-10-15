import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/update_voice_actor_link.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/update_voice_actor_link.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockReturnValue({ id: "voice-owner-1" });
});

afterAll(() => vi.unstubAllGlobals());

const body = {
  request_id: "e65a9ae4-d053-4c2f-a85c-9273b95e1288",
  work_id: 73,
  expected_updated_at: "2026-10-15T12:00:00.000Z",
  performance: "chant",
};

function createSupabaseMock(result: {
  data: Array<{ work_id: number; audit_log_id: string; replayed: boolean }> | null;
  error: { code: string } | null;
}) {
  const rpc = vi.fn(async () => result);
  const row = {
    id: 73,
    voice_actor_id: 41,
    performance: "chant",
    updated_at: "2026-10-15T12:00:01.000Z",
  };
  const workQuery = {
    select: vi.fn(() => workQuery),
    eq: vi.fn(() => workQuery),
    single: vi.fn(async () => ({ data: row, error: null })),
  };
  const from = vi.fn(() => workQuery);
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

describe("POST /api/update_voice_actor_link", () => {
  it("requires a versioned request and sends the session actor to the controlled RPC", async () => {
    const { rpc } = createSupabaseMock({
      data: [{ work_id: 73, audit_log_id: "audit-update-1", replayed: false }],
      error: null,
    });

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 73,
      performance: "chant",
      auditLogId: "audit-update-1",
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledWith("update_voice_actor_work_performance", {
      p_user_id: "voice-owner-1",
      p_request_id: body.request_id,
      p_work_id: body.work_id,
      p_expected_updated_at: body.expected_updated_at,
      p_performance: body.performance,
    });
  });

  it("rejects protected fields and impersonation attempts before calling the RPC", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: null });

    const protectedField = await post({ ...body, voice_actor_id: 999 });
    const impersonation = await post({ ...body, targetUserId: "another-user" });

    expect(protectedField.status).toBe(400);
    expect(impersonation.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a conflict for a stale expected version", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: { code: "40001" } });

    const response = await post(body);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      statusMessage: "Work changed or the request id was reused; reload and retry",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("does not report a failed audit transaction as a successful update", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: { code: "XX000" } });

    const response = await post(body);

    expect(response.status).toBe(500);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("returns the original success for a stable idempotent retry", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ work_id: 73, audit_log_id: "audit-update-1", replayed: false }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ work_id: 73, audit_log_id: "audit-update-1", replayed: true }],
        error: null,
      });
    const workQuery = {
      select: vi.fn(() => workQuery),
      eq: vi.fn(() => workQuery),
      single: vi.fn(async () => ({ data: { id: 73, performance: "chant" }, error: null })),
    };
    routeMocks.useSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => workQuery),
      rpc,
    });

    const first = await post(body);
    const second = await post(body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ replayed: true });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
