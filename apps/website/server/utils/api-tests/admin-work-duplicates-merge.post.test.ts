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

let handler: typeof import("../../api/admin/work-duplicates/merge.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/admin/work-duplicates/merge.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({ id: "admin-1" });
});

afterAll(() => vi.unstubAllGlobals());

const updates = {
  performance: null,
  status: null,
  reviewed_status: null,
  note: null,
  highlight: null,
  source_id: null,
  suggestions: null,
  character_name: null,
};

async function post(rpcResult: unknown): Promise<Response> {
  const rpc = vi.fn(async () => rpcResult);
  routeMocks.useSupabaseAdmin.mockReturnValue({ rpc });
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ canonicalId: 1, workIds: [1, 2], updates }),
    }),
  );
}

describe("POST /api/admin/work-duplicates/merge", () => {
  it.each(["40001", "PT409"])("maps a changed duplicate group (%s) to a conflict", async (code) => {
    const response = await post({ data: null, error: { code } });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ statusMessage: "DUPLICATE_GROUP_CHANGED" });
  });

  it("maps invalid merge values to 422", async () => {
    const response = await post({ data: null, error: { code: "22023" } });

    expect(response.status).toBe(422);
  });
});
