import {
  createApp,
  createError,
  defineEventHandler,
  readBody,
  toWebHandler,
} from "h3";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

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

interface DeleteBuilder {
  eq(column: string, value: number): DeleteBuilder;
  in(column: string, values: number[]): Promise<{ error: null }>;
}

function createSupabaseMock() {
  const deletedProjectIds: number[] = [];
  const insertedRows: Array<Record<string, unknown>> = [];
  const deleteBuilder: DeleteBuilder = {
    eq(column, value) {
      if (column === "dubbing_project_id") deletedProjectIds.push(value);
      return deleteBuilder;
    },
    async in() {
      return { error: null };
    },
  };
  const supabase = {
    from: vi.fn(() => ({
      delete: () => deleteBuilder,
      insert: async (rows: Array<Record<string, unknown>>) => {
        insertedRows.push(...rows);
        return { error: null };
      },
    })),
  };

  return { supabase, deletedProjectIds, insertedRows };
}

async function saveRegion(
  dubbingLanguage: string,
  projectId: number,
  voiceActorId: number,
): Promise<Response> {
  const { supabase, deletedProjectIds, insertedRows } = createSupabaseMock();
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
  expect(deletedProjectIds).toEqual([projectId]);
  expect(insertedRows).toEqual([
    {
      actor_id: 101,
      voice_actor_id: voiceActorId,
      dubbing_project_id: projectId,
      performance: "voice",
      status: "validated",
    },
  ]);
  expect(routeMocks.findOrCreateDubbingProject).toHaveBeenCalledWith(
    211288,
    "tv",
    dubbingLanguage,
  );
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
