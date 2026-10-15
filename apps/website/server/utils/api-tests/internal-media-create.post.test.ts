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
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/internal-media-create.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/internal-media-create.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({
    id: "admin-1",
    app_metadata: { role: "admin" },
  });
});

afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(result: {
  data: Array<{
    project_id: number;
    content_id: number;
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
    media_type: "advertisement",
    name: "Campaign",
    brand: "Studio",
    dubbing_language: "fr-FR",
  };
}

describe("POST /api/internal-media-create", () => {
  it("rejects protected and unknown fields before the controlled operation", async () => {
    const { rpc } = createSupabaseMock({ data: null, error: null });

    const response = await post({ ...validBody(), content_id: -1 });

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns the project and audit id from the atomic creation RPC", async () => {
    const { rpc } = createSupabaseMock({
      data: [
        {
          project_id: 51,
          content_id: -7,
          audit_log_id: "f20d747e-c98e-43ea-9356-133fcbf0b496",
          replayed: false,
        },
      ],
      error: null,
    });
    const body = validBody();

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      media: { project_id: 51, content_id: -7, media_type: "advertisement" },
      auditLogId: "f20d747e-c98e-43ea-9356-133fcbf0b496",
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledWith("create_internal_dubbing_project", {
      p_actor_id: "admin-1",
      p_request_id: body.request_id,
      p_media_type: body.media_type,
      p_language: body.dubbing_language,
      p_name: body.name,
      p_brand: body.brand,
      p_manufacturer: null,
      p_description: null,
    });
  });

  it("does not report success when the atomic operation fails", async () => {
    const { rpc } = createSupabaseMock({
      data: null,
      error: { code: "42501" },
    });

    const response = await post(validBody());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      statusMessage: "Internal media creation is not authorized",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });
});
