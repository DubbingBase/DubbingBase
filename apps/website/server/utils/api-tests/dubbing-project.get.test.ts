import { createApp, createError, defineEventHandler, getQuery, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({
  requireAdmin: routeMocks.requireAdmin,
}));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/admin/dubbing-project.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../../api/admin/dubbing-project.get")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock() {
  const project = { id: 501 };
  const works = [
    {
      id: 305,
      actor_id: 101,
      voice_actor_id: 201,
      voice_actor: {
        id: 201,
        firstname: "One",
        lastname: "Voice",
        profile_picture: null,
      },
    },
    {
      id: 306,
      actor_id: 101,
      voice_actor_id: 202,
      voice_actor: {
        id: 202,
        firstname: "Two",
        lastname: "Voice",
        profile_picture: null,
      },
    },
    {
      id: 307,
      actor_id: 102,
      voice_actor_id: 203,
      voice_actor: null,
    },
  ];
  const selectedColumns: string[] = [];

  const supabase = {
    from(table: string) {
      const builder = {
        select(columns: string) {
          selectedColumns.push(columns);
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle: async () => ({ data: project, error: null }),
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ data: works, error: null }).then(resolve, reject);
        },
      };
      return table === "dubbing_projects" ? builder : builder;
    },
  };

  return { supabase, selectedColumns };
}

describe("GET /api/admin/dubbing-project", () => {
  it("returns exact work IDs and marks every row for ambiguous actors non-editable", async () => {
    const { supabase, selectedColumns } = createSupabaseMock();
    routeMocks.useSupabaseAdmin.mockReturnValue(supabase);
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => handler(event)),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/?content_id=211288&content_type=tv&dubbing_language=fr-FR"),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      projectId: 501,
      works: [
        {
          work_id: 305,
          actor_id: 101,
          voice_actor_id: 201,
          voice_actor: {
            id: 201,
            firstname: "One",
            lastname: "Voice",
            profile_picture: null,
          },
          editable: false,
        },
        {
          work_id: 306,
          actor_id: 101,
          voice_actor_id: 202,
          voice_actor: {
            id: 202,
            firstname: "Two",
            lastname: "Voice",
            profile_picture: null,
          },
          editable: false,
        },
        {
          work_id: 307,
          actor_id: 102,
          voice_actor_id: 203,
          voice_actor: null,
          editable: true,
        },
      ],
    });
    expect(selectedColumns).toContain(
      "id, actor_id, voice_actor_id, voice_actor:voice_actors(id, firstname, lastname, profile_picture)",
    );
  });
});
