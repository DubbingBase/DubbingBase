import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/save-toy-metadata.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/save-toy-metadata.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({ id: "admin-1", app_metadata: { role: "admin" } });
});

afterAll(() => vi.unstubAllGlobals());

type RpcResult = { data: unknown; error: { code?: string } | null };

function createSupabaseMock(
  result: RpcResult = {
    data: {
      record: {
        content_id: 1,
        name: "Lunii Storyteller",
        manufacturer: "Lunii",
        product_line: "My Fabulous Storyteller",
        release_year: 2022,
        cover_url: null,
        description: "A screen-free audio storyteller.",
        created_by: "admin-1",
        updated_by: "admin-1",
        created_at: "2026-10-23T11:00:00Z",
        updated_at: "2026-10-23T12:00:00Z",
      },
      audit_log_id: "audit-1",
      replayed: false,
    },
    error: null,
  },
) {
  const rpc = vi.fn(async () => result);
  routeMocks.useSupabaseAdmin.mockReturnValue({ rpc });
  return { rpc };
}

async function post(body: unknown) {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return response;
}

function validBody() {
  return {
    request_id: "e65a9ae4-d053-4c2f-a85c-9273b95e1288",
    content_id: 1,
    expected_updated_at: null,
    metadata: {
      name: "Lunii Storyteller",
      manufacturer: "Lunii",
      product_line: "My Fabulous Storyteller",
      release_year: 2022,
      cover_url: null,
      description: "A screen-free audio storyteller.",
    },
  };
}

describe("POST /api/save-toy-metadata", () => {
  it("requires an administrator before the service-role write", async () => {
    const { rpc } = createSupabaseMock();
    routeMocks.requireAdmin.mockImplementation(() => {
      throw createError({ statusCode: 403, message: "Admin required" });
    });

    const response = await post(validBody());

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("saves the allowlisted metadata through the audited RPC", async () => {
    const { rpc } = createSupabaseMock();
    const body = validBody();

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      toy: { id: 1, name: "Lunii Storyteller", release_year: 2022 },
      auditLogId: "audit-1",
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledWith("controlled_save_toy_metadata", {
      p_actor_id: "admin-1",
      p_request_id: body.request_id,
      p_content_id: body.content_id,
      p_expected_updated_at: null,
      p_payload: body.metadata,
    });
  });

  it("rejects protected metadata and unsafe cover URLs before invoking the RPC", async () => {
    const { rpc } = createSupabaseMock();
    const protectedField = await post({
      ...validBody(),
      metadata: { ...validBody().metadata, created_by: "other" },
    });
    const unsafeCover = await post({
      ...validBody(),
      metadata: { ...validBody().metadata, cover_url: "javascript:alert(1)" },
    });
    const invalidYear = await post({
      ...validBody(),
      metadata: { ...validBody().metadata, release_year: 2201 },
    });

    expect(protectedField.status).toBe(400);
    expect(unsafeCover.status).toBe(400);
    expect(invalidYear.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns conflict when metadata changed since it was loaded", async () => {
    createSupabaseMock({ data: null, error: { code: "55000" } });

    const response = await post(validBody());

    expect(response.status).toBe(409);
  });
});
