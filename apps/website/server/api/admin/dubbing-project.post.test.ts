import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  findOrCreateDubbingProject: vi.fn(),
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../../utils/auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));
vi.mock("../../utils/db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));
vi.mock("../../utils/db/dubbing-project", () => ({
  findOrCreateDubbingProject: routeMocks.findOrCreateDubbingProject,
}));

let handler: typeof import("./dubbing-project.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("./dubbing-project.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock() {
  const rpcCalls: Array<{
    name: string;
    args: Record<string, unknown>;
  }> = [];
  const supabase = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
      rpcCalls.push({ name, args });
      return { error: null };
    }),
  };

  return { supabase, rpcCalls };
}

async function saveRegion(
  dubbingLanguage: string,
  projectId: number,
  voiceActorId: number,
): Promise<Response> {
  const { supabase, rpcCalls } = createSupabaseMock();
  routeMocks.findOrCreateDubbingProject.mockResolvedValue(projectId);
  routeMocks.useSupabaseAdmin.mockReturnValue(supabase);

  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        content_id: 211288,
        content_type: "tv",
        dubbing_language: dubbingLanguage,
        actor_ids: [101],
        assignments: [{ actor_id: 101, voice_actor_id: voiceActorId }],
      }),
    }),
  );

  expect(response.status).toBe(200);
  expect(rpcCalls).toEqual([
    {
      name: "replace_regional_project_actor_assignments",
      args: {
        p_dubbing_project_id: projectId,
        p_actor_ids: [101],
        p_assignments: [{ actor_id: 101, voice_actor_id: voiceActorId }],
      },
    },
  ]);
  expect(routeMocks.findOrCreateDubbingProject).toHaveBeenCalledWith(211288, "tv", dubbingLanguage);
  return response;
}

describe("POST /api/admin/dubbing-project", () => {
  it("creates and writes only the selected regional project", async () => {
    await saveRegion("fr-FR", 501, 201);
    await saveRegion("fr-CA", 502, 202);

    expect(routeMocks.findOrCreateDubbingProject.mock.calls).toEqual([
      [211288, "tv", "fr-FR"],
      [211288, "tv", "fr-CA"],
    ]);
  });
});
