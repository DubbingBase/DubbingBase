import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));
const adminId = "00000000-0000-4000-8000-000000563660";
const requestId = "8f43b9a3-659f-4a97-9dc4-dd45166e5e68";

vi.mock("../auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/admin/dubbing-project.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/admin/dubbing-project.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({ id: adminId });
});
afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(
  result: { data: number | null; error: (Error & { code?: string }) | null } = {
    data: 501,
    error: null,
  },
) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const supabase = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return result;
    }),
  };
  return { supabase, rpcCalls };
}

async function post(body: unknown): Promise<Response> {
  const requestBody =
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    !Object.hasOwn(body, "request_id")
      ? { ...body, request_id: requestId }
      : body;
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }),
  );
}

describe("POST /api/admin/dubbing-project", () => {
  it("rejects callers who do not pass admin authorization before creating a service client", async () => {
    routeMocks.requireAdmin.mockImplementation(() => {
      throw createError({ statusCode: 403, message: "Admin access required" });
    });
    const { supabase, rpcCalls } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const response = await post({
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
      operations: [
        { actor_id: 101, work_id: null, expected_voice_actor_id: null, voice_actor_id: 201 },
      ],
    });

    expect(response.status).toBe(403);
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
    expect(rpcCalls).toEqual([]);
  });

  it("sends exact work operations and the selected regional project inputs to one RPC", async () => {
    const { supabase, rpcCalls } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const response = await post({
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
      operations: [
        { actor_id: 101, work_id: 305, expected_voice_actor_id: 199, voice_actor_id: 201 },
        { actor_id: 102, work_id: null, expected_voice_actor_id: null, voice_actor_id: 202 },
        { actor_id: 103, work_id: 306, expected_voice_actor_id: 200, voice_actor_id: null },
      ],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true, projectId: 501 });
    expect(rpcCalls).toEqual([
      {
        name: "save_regional_project_actor_assignments",
        args: {
          p_content_id: 211288,
          p_content_type: "tv",
          p_dubbing_language: "fr-FR",
          p_actor_id: adminId,
          p_request_id: requestId,
          p_operations: [
            { actor_id: 101, work_id: 305, expected_voice_actor_id: 199, voice_actor_id: 201 },
            { actor_id: 102, work_id: null, expected_voice_actor_id: null, voice_actor_id: 202 },
            { actor_id: 103, work_id: 306, expected_voice_actor_id: 200, voice_actor_id: null },
          ],
        },
      },
    ]);
  });

  it("rejects legacy and invalid dubbing languages before calling the RPC", async () => {
    const { supabase, rpcCalls } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    for (const dubbingLanguage of ["fr", "FR-fr", "fr-FRA", "zz-ZZ"]) {
      const response = await post({
        content_id: 211288,
        content_type: "tv",
        dubbing_language: dubbingLanguage,
        operations: [{ actor_id: 101, work_id: null, voice_actor_id: 201 }],
      });
      expect(response.status).toBe(400);
    }
    expect(rpcCalls).toEqual([]);
  });

  it("accepts a supported regional code", async () => {
    const { supabase, rpcCalls } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const response = await post({
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-BE",
      operations: [
        {
          actor_id: 101,
          work_id: null,
          expected_voice_actor_id: null,
          voice_actor_id: 201,
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(rpcCalls[0]?.args).toMatchObject({ p_dubbing_language: "fr-BE" });
  });

  it("rejects duplicate actors and no-op operations", async () => {
    const { supabase, rpcCalls } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const duplicateResponse = await post({
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
      operations: [
        { actor_id: 101, work_id: 305, expected_voice_actor_id: 200, voice_actor_id: 201 },
        { actor_id: 101, work_id: 306, expected_voice_actor_id: 201, voice_actor_id: 202 },
      ],
    });
    const emptyOperationResponse = await post({
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
      operations: [
        { actor_id: 101, work_id: null, expected_voice_actor_id: null, voice_actor_id: null },
      ],
    });

    expect(duplicateResponse.status).toBe(400);
    expect(emptyOperationResponse.status).toBe(400);
    expect(rpcCalls).toEqual([]);
  });

  it("rejects unknown request fields and invalid request IDs", async () => {
    const { supabase, rpcCalls } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const base = {
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
      operations: [
        { actor_id: 101, work_id: 305, expected_voice_actor_id: 199, voice_actor_id: 201 },
      ],
    };
    const unknownField = await post({ ...base, protected: true });
    const missingRequestId = await post({ ...base, request_id: null });
    const invalidRequestId = await post({ ...base, request_id: "not-a-uuid" });
    const unknownOperationField = await post({
      ...base,
      operations: [{ ...base.operations[0], status: "validated" }],
    });

    expect(unknownField.status).toBe(400);
    expect(missingRequestId.status).toBe(400);
    expect(invalidRequestId.status).toBe(400);
    expect(unknownOperationField.status).toBe(400);
    expect(rpcCalls).toEqual([]);
  });

  it("requires an optional positive expected voice actor ID", async () => {
    const { supabase, rpcCalls } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const base = {
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
    };
    const missingExpectedValue = await post({
      ...base,
      operations: [{ actor_id: 101, work_id: 305, voice_actor_id: 201 }],
    });
    const invalidExpectedValue = await post({
      ...base,
      operations: [
        { actor_id: 101, work_id: 305, expected_voice_actor_id: -1, voice_actor_id: 201 },
      ],
    });
    const unsafeContentId = await post({
      ...base,
      content_id: Number.MAX_SAFE_INTEGER + 1,
      operations: [
        { actor_id: 101, work_id: 305, expected_voice_actor_id: 199, voice_actor_id: 201 },
      ],
    });

    expect(missingExpectedValue.status).toBe(400);
    expect(invalidExpectedValue.status).toBe(400);
    expect(unsafeContentId.status).toBe(400);
    expect(rpcCalls).toEqual([]);
  });

  it("surfaces the database ambiguity rejection without retrying a destructive save", async () => {
    const { supabase, rpcCalls } = createSupabaseMock({
      data: null,
      error: Object.assign(new Error("Actor 101 has multiple works in this regional project"), {
        code: "55000",
      }),
    });
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const response = await post({
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
      operations: [
        { actor_id: 101, work_id: 305, expected_voice_actor_id: 199, voice_actor_id: 201 },
      ],
    });

    expect(response.status).toBe(409);
    expect(rpcCalls).toHaveLength(1);
  });

  it("surfaces a stale assignment conflict as HTTP 409", async () => {
    const { supabase } = createSupabaseMock({
      data: null,
      error: Object.assign(new Error("Assignment changed; reload before saving"), {
        code: "40001",
      }),
    });
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

    const response = await post({
      content_id: 211288,
      content_type: "tv",
      dubbing_language: "fr-FR",
      operations: [
        { actor_id: 101, work_id: 305, expected_voice_actor_id: 199, voice_actor_id: 201 },
      ],
    });

    expect(response.status).toBe(409);
  });
});
