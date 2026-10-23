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
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  fetchTmdb: vi.fn(),
  fetchTmdbCredits: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));
vi.mock("../../utils", () => ({
  useTmdbClient: () => ({
    fetchMediaDetails: routeMocks.fetchTmdb,
    fetchMediaCredits: routeMocks.fetchTmdbCredits,
  }),
  useIgdbClient: () => ({ getGame: vi.fn(), getGameCharacters: vi.fn() }),
  useOpenLibraryClient: () => ({ getBook: vi.fn() }),
  usePodcastClient: () => ({ getPodcast: vi.fn() }),
}));

let handler: typeof import("../../api/save-dubbing-project.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/save-dubbing-project.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({
    id: "admin-1",
    app_metadata: { role: "admin" },
  });
  routeMocks.fetchTmdb.mockResolvedValue({
    id: 90,
    credits: { cast: [{ id: 12 }] },
  });
  routeMocks.fetchTmdbCredits.mockResolvedValue({ cast: [{ id: 12 }] });
});
afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(result: {
  data: Array<{
    project_id: number;
    updated_at: string | null;
    audit_log_id: string;
    replayed: boolean;
  }> | null;
  error: { code: string } | null;
}) {
  const rpc = vi.fn(async () => result);
  routeMocks.useSupabaseAdmin.mockReturnValue({ rpc });
  return { rpc };
}

async function post(body: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function validBody() {
  return {
    request_id: "e65a9ae4-d053-4c2f-a85c-9273b95e1288",
    project_id: 51,
    expected_updated_at: "2026-10-15T12:00:00",
    project: {
      content_id: 90,
      content_type: "movie",
      language: "fr-FR",
      studio_id: null,
      status: "validated",
    },
    crew: [{ job_id: 1, person_id: 8 }],
    cast: [
      {
        id: 27,
        expected_updated_at: "2026-10-15T12:00:00.000Z",
        expected: {
          actor_id: 12,
          character_id: null,
          character_name: "Rôle",
          voice_actor_id: 8,
          performance: "dialogues",
          note: null,
          highlight: false,
          status: "validated",
        },
        actor_id: 12,
        character_name: "Rôle",
        voice_actor_id: 8,
        performance: "dialogues",
        note: null,
        highlight: false,
      },
    ],
  };
}

describe("POST /api/save-dubbing-project", () => {
  it("requires an administrator before external lookups or privileged writes", async () => {
    routeMocks.requireAdmin.mockImplementation(() => {
      throw createError({ statusCode: 403, message: "Admin required" });
    });
    const { rpc } = createSupabaseMock({ data: null, error: null });

    const response = await post(validBody());

    expect(response.status).toBe(403);
    expect(routeMocks.fetchTmdb).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects protected project fields before any RPC", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: null });
    const body = {
      ...validBody(),
      project: { ...validBody().project, updated_at: "client-value" },
    };

    const response = await post(body);

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates media and actor references, then sends the entire save to one atomic RPC", async () => {
    const result = {
      project_id: 51,
      updated_at: "2026-10-15T12:05:00",
      audit_log_id: "f20d747e-c98e-43ea-9356-133fcbf0b496",
      replayed: false,
    };
    const { rpc } = createSupabaseMock({ data: [result], error: null });
    const body = validBody();

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      projectId: 51,
      updatedAt: result.updated_at,
      auditLogId: result.audit_log_id,
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("save_dubbing_project_editor", {
      p_actor_id: "admin-1",
      p_request_id: body.request_id,
      p_project_id: body.project_id,
      p_expected_updated_at: body.expected_updated_at,
      p_project: body.project,
      p_crew: body.crew,
      p_cast: body.cast,
    });
  });

  it("validates TV actors against aggregate credits", async () => {
    routeMocks.fetchTmdb.mockResolvedValue({ id: 90, credits: { cast: [] } });
    const { rpc } = createSupabaseMock({
      data: [
        {
          project_id: 51,
          updated_at: "2026-10-15T12:05:00",
          audit_log_id: "f20d747e-c98e-43ea-9356-133fcbf0b496",
          replayed: false,
        },
      ],
      error: null,
    });
    const body = validBody();
    body.project.content_type = "tv";

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(routeMocks.fetchTmdbCredits).toHaveBeenCalledWith("tv", 90);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("returns a conflict instead of success for a stale RPC result", async () => {
    const { rpc } = createSupabaseMock({
      data: null,
      error: { code: "55000" },
    });

    const response = await post(validBody());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      statusMessage: "Project data changed; reload before saving again",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("returns a retryable conflict when PostgreSQL aborts a deadlocked save", async () => {
    createSupabaseMock({ data: null, error: { code: "40P01" } });

    const response = await post(validBody());

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      statusMessage: "Project data changed; reload before saving again",
    });
  });

  it("rejects an actor that is not in the media provider cast", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: null });
    const body = validBody();
    const castRow = body.cast.at(0);
    if (!castRow) throw new Error("Expected one cast row in valid body");
    castRow.actor_id = 999;

    const response = await post(body);

    expect(response.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });
});
