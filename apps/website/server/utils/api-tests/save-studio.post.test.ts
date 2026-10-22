import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/save-studio.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/save-studio.post")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

type User = { id: string };

async function post(options: { user?: User; body: unknown; rpcResult?: unknown }) {
  const rpc = vi.fn(
    async () =>
      options.rpcResult ?? {
        data: [{ studio_id: 7, audit_log_id: "audit-7", replayed: false }],
        error: null,
      },
  );
  routeMocks.useSupabaseAdmin.mockReturnValue({ rpc });
  routeMocks.requireUser.mockImplementation(() => {
    if (!options.user) throw createError({ statusCode: 401, message: "Unauthorized" });
    return options.user;
  });

  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = options.user;
      return handler(event);
    }),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(options.body),
    }),
  );
  return { rpc, response };
}

describe("POST /api/save-studio", () => {
  const requestId = "e51cfeb6-411e-40bf-994e-f75cf48ef53c";

  it("rejects anonymous writes before using the service client", async () => {
    const { response } = await post({
      body: { id: null, requestId, updates: { name: "Studio" } },
    });
    expect(response.status).toBe(401);
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
  });

  it.each([
    { id: "1 OR 1=1", requestId, updates: { name: "Studio" } },
    { id: null, requestId, updates: { name: "Studio", is_admin: true } },
    { id: null, requestId, updates: { name: "Studio", website_url: "javascript:alert(1)" } },
    { id: null, updates: { name: "Studio" } },
    { id: null, requestId: "bad-key", updates: { name: "Studio" } },
    { id: "7", requestId, updates: { city: "Paris" } },
  ])("rejects malformed input before calling the controlled write", async (body) => {
    const { response, rpc } = await post({ user: { id: "member" }, body });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the authenticated actor, expected version, and request id", async () => {
    const { response, rpc } = await post({
      user: { id: "member-1" },
      body: {
        id: "7",
        expectedUpdatedAt: "2026-10-15T12:00:00",
        requestId,
        updates: {
          city: "  Paris  ",
          social_media_links: { instagram: "https://instagram.com/studio" },
        },
      },
    });

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("controlled_save_studio", {
      p_actor_id: "member-1",
      p_studio_id: 7,
      p_expected_updated_at: "2026-10-15T12:00:00",
      p_request_id: requestId,
      p_updates: {
        city: "Paris",
        social_media_links: { instagram: "https://instagram.com/studio" },
      },
    });
    await expect(response.json()).resolves.toEqual({
      success: true,
      studioId: 7,
      auditLogId: "audit-7",
      replayed: false,
    });
  });

  it("surfaces protected logo writes as forbidden", async () => {
    const { response } = await post({
      user: { id: "member-1" },
      body: {
        id: "7",
        expectedUpdatedAt: "2026-10-15T12:00:00",
        requestId,
        updates: { logo_url: "https://cdn.test/logo.png" },
      },
      rpcResult: { data: null, error: { code: "42501" } },
    });
    expect(response.status).toBe(403);
  });

  it("returns a conflict when the persisted studio changed", async () => {
    const { response } = await post({
      user: { id: "member-1" },
      body: {
        id: "7",
        expectedUpdatedAt: "2026-10-15T12:00:00",
        requestId,
        updates: { city: "Paris" },
      },
      rpcResult: { data: null, error: { code: "40001" } },
    });
    expect(response.status).toBe(409);
  });

  it("returns the prior mutation result for an idempotent retry", async () => {
    const { response } = await post({
      user: { id: "member-1" },
      body: { id: null, requestId, updates: { name: "Studio" } },
      rpcResult: {
        data: [{ studio_id: 7, audit_log_id: "audit-7", replayed: true }],
        error: null,
      },
    });
    await expect(response.json()).resolves.toMatchObject({ replayed: true, studioId: 7 });
  });
});
