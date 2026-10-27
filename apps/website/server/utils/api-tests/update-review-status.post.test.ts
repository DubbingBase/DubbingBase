import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/update-review-status.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/update-review-status.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockReturnValue({ id: "reviewer-1" });
});

afterAll(() => vi.unstubAllGlobals());

const request = {
  request_id: "e65a9ae4-d053-4c2f-a85c-9273b95e1288",
  work_id: 73,
  expected_updated_at: "2026-10-15T12:00:00.000Z",
  reviewed_status: "accepted",
};

function createSupabaseMock(result: {
  data: Array<{ work_id: number; audit_log_id: string | null; replayed: boolean }> | null;
  error: { code: string } | null;
}) {
  const rpc = vi.fn(async () => result);
  const updatedAt = "2026-10-15T12:00:00.000Z";
  const workRow = {
    id: 73,
    updated_at: updatedAt,
    reviewed_status: "accepted",
    dubbing_projects: { id: 9 },
  };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: { updated_at: updatedAt }, error: null })),
    single: vi.fn(async () => ({ data: workRow, error: null })),
  };
  const from = vi.fn(() => query);
  routeMocks.useSupabaseAdmin.mockReturnValue({ rpc, from });
  return { rpc, from, query };
}

async function post(requestBody: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = { id: "reviewer-1" };
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

describe("POST /api/update-review-status", () => {
  it("calls the controlled RPC with the authenticated actor and returns the audited result", async () => {
    const { rpc, from } = createSupabaseMock({
      data: [{ work_id: 73, audit_log_id: "audit-review-1", replayed: false }],
      error: null,
    });

    const response = await post(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      data: { id: 73, reviewed_status: "accepted" },
      audit_log_id: "audit-review-1",
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledWith("update_work_review_status_controlled", {
      p_actor_id: "reviewer-1",
      p_request_id: request.request_id,
      p_work_id: request.work_id,
      p_expected_updated_at: request.expected_updated_at,
      p_reviewed_status: request.reviewed_status,
    });
    expect(from).toHaveBeenCalledWith("work");
  });

  it("keeps legacy callers compatible when they omit retry and version metadata", async () => {
    const { rpc } = createSupabaseMock({
      data: [{ work_id: 73, audit_log_id: null, replayed: false }],
      error: null,
    });

    const response = await post({ work_id: 73, reviewed_status: "accepted" });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("update_work_review_status_controlled", {
      p_actor_id: "reviewer-1",
      p_request_id: null,
      p_work_id: 73,
      p_expected_updated_at: "2026-10-15T12:00:00.000Z",
      p_reviewed_status: "accepted",
    });
  });

  it("rejects arbitrary fields, invalid statuses, and impersonation attempts before mutation", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: null });

    const extraField = await post({ ...request, performance: "voice" });
    const invalidStatus = await post({ ...request, reviewed_status: "pending" });
    const impersonation = await post({ ...request, targetUserId: "another-user" });

    expect(extraField.status).toBe(400);
    expect(invalidStatus.status).toBe(400);
    expect(impersonation.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps unauthorized ownership and stale versions to controlled errors", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: { code: "42501" } });
    const forbidden = await post(request);
    expect(forbidden.status).toBe(403);

    routeMocks.useSupabaseAdmin.mockReturnValue({
      rpc: vi.fn(async () => ({ data: null, error: { code: "40001" } })),
    });
    const stale = await post(request);
    expect(stale.status).toBe(409);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("does not report success when the audited database transaction fails", async () => {
    const { rpc, from } = createSupabaseMock({ data: null, error: { code: "XX000" } });

    const response = await post(request);

    expect(response.status).toBe(500);
    expect(rpc).toHaveBeenCalledOnce();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects anonymous callers before reaching the privileged database client", async () => {
    routeMocks.requireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
    });
    const { rpc } = createSupabaseMock({ data: null, error: null });

    const response = await post(request);

    expect(response.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the original audit on a stable retry", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ work_id: 73, audit_log_id: "audit-review-1", replayed: false }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ work_id: 73, audit_log_id: "audit-review-1", replayed: true }],
        error: null,
      });
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn(async () => ({ data: { id: 73 }, error: null })),
    };
    routeMocks.useSupabaseAdmin.mockReturnValue({ rpc, from: vi.fn(() => query) });

    const first = await post(request);
    const retry = await post(request);

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({
      audit_log_id: "audit-review-1",
      replayed: true,
    });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
