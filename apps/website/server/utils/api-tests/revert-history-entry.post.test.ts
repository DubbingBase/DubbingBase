import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
  requireUser: routeMocks.requireUser,
}));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/revert-history-entry.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/revert-history-entry.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockResolvedValue({ id: "admin-1", app_metadata: { role: "admin" } });
});
afterAll(() => vi.unstubAllGlobals());

const auditId = "11111111-1111-4111-8111-111111111111";
const voiceActorAudit = {
  id: auditId,
  entity_type: "voice_actor",
  entity_id: "1",
  previous_value: { bio: "Old bio" },
  new_value: { bio: "Vandal bio" },
  reverted_at: null,
};

type Options = {
  audit?: Record<string, unknown> | null;
  current?: Record<string, unknown> | null;
  rpcError?: { code: string };
};

function createSupabaseMock(options: Options) {
  const rpc = vi.fn(async (_name: string, _args: Record<string, unknown>) => ({
    data: null,
    error: options.rpcError ?? null,
  }));
  const marked: Array<Record<string, unknown>> = [];
  const from = vi.fn((table: string) => {
    const result = (data: unknown) => ({ data, error: null });
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      is: vi.fn(async () => ({ error: null })),
      in: vi.fn(async () => result(options.current ? [options.current] : [])),
      maybeSingle: vi.fn(async () =>
        result(options.audit === undefined ? voiceActorAudit : options.audit),
      ),
      single: vi.fn(async () =>
        result({ updated_at: "2026-11-14T10:00:00Z", reviewed_status: "waiting" }),
      ),
      update: vi.fn((values: Record<string, unknown>) => {
        marked.push(values);
        return chain;
      }),
    };
    if (table !== "audit_logs" && table !== "voice_actors") return chain;
    return chain;
  });
  routeMocks.useSupabaseAdmin.mockReturnValue({ from, rpc });
  return { rpc, marked };
}

async function post(body: unknown, options: Options = {}) {
  const mocks = createSupabaseMock(options);
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
  return { response, ...mocks };
}

const matchingCurrent = { id: 1, updated_at: "2026-11-14T10:00:00Z", bio: "Vandal bio" };

describe("POST /api/revert-history-entry", () => {
  it("is admin only", async () => {
    routeMocks.requireAdmin.mockRejectedValue(
      createError({ statusCode: 403, message: "Forbidden" }),
    );
    const { response, rpc } = await post({ audit_log_id: auditId }, { current: matchingCurrent });
    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates the request body", async () => {
    expect((await post({ audit_log_id: "nope" })).response.status).toBe(400);
    expect((await post({ audit_log_id: auditId, extra: 1 })).response.status).toBe(400);
  });

  it("restores the previous value through the audited RPC as the acting admin and marks the entry", async () => {
    const { response, rpc, marked } = await post(
      { audit_log_id: auditId },
      { current: matchingCurrent },
    );
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "controlled_update_voice_actor",
      expect.objectContaining({
        p_actor_id: "admin-1",
        p_voice_actor_id: 1,
        p_payload: { bio: "Old bio" },
        p_expected_updated_at: "2026-11-14T10:00:00Z",
      }),
    );
    expect(marked).toEqual([{ reverted_at: expect.any(String) }]);
  });

  it("refuses without writing when a later edit changed the field", async () => {
    const { response, rpc, marked } = await post(
      { audit_log_id: auditId },
      { current: { ...matchingCurrent, bio: "A good later edit" } },
    );
    expect(response.status).toBe(409);
    expect(rpc).not.toHaveBeenCalled();
    expect(marked).toEqual([]);
  });

  it("returns 404 for an unknown entry and 422 for unsupported ones", async () => {
    expect((await post({ audit_log_id: auditId }, { audit: null })).response.status).toBe(404);
    const unsupported = await post(
      { audit_log_id: auditId },
      { audit: { ...voiceActorAudit, entity_type: "dubbing_project" }, current: matchingCurrent },
    );
    expect(unsupported.response.status).toBe(422);
  });

  it.each(["40001", "PT409"])(
    "maps a concurrent change (%s) to 409 and does not mark the entry reverted",
    async (code) => {
      const { response, marked } = await post(
        { audit_log_id: auditId },
        { current: matchingCurrent, rpcError: { code } },
      );
      expect(response.status).toBe(409);
      expect(marked).toEqual([]);
    },
  );
});
