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
  findOrCreateDubbingProject: vi.fn(),
  requireDubbingLanguage: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));
vi.mock("../db/dubbing-project", () => ({
  findOrCreateDubbingProject: routeMocks.findOrCreateDubbingProject,
}));
vi.mock("../dubbing-language", () => ({
  requireDubbingLanguage: routeMocks.requireDubbingLanguage,
}));

let handler: typeof import("../../api/process-credits.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/process-credits.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({
    id: "current-admin-id",
    app_metadata: { role: "admin" },
  });
  routeMocks.findOrCreateDubbingProject.mockResolvedValue(13);
  routeMocks.requireDubbingLanguage.mockReturnValue("en-US");
  routeMocks.rpc.mockImplementation(async (functionName: string) =>
    functionName === "controlled_save_metadata"
      ? { data: { record: { id: 91 } }, error: null }
      : { data: [], error: null },
  );
  const workQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
    then: (resolve: (value: { data: never[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  };
  workQuery.select.mockReturnValue(workQuery);
  workQuery.eq.mockReturnValue(workQuery);
  workQuery.is.mockReturnValue(workQuery);
  workQuery.ilike.mockReturnValue(workQuery);
  workQuery.limit.mockReturnValue(workQuery);
  routeMocks.from.mockReturnValue(workQuery);
  routeMocks.useSupabaseAdmin.mockReturnValue({
    from: routeMocks.from,
    rpc: routeMocks.rpc,
  });
});

afterAll(() => vi.unstubAllGlobals());

async function postPayload(payload: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

describe("POST /api/process-credits", () => {
  it("preserves a fresh match operation ID when saving and retrying a voice actor", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const matchPayload = {
      action: "match",
      credits: [{ voiceActor: "Ada Lovelace" }],
    };
    const matchResponse = await postPayload(matchPayload);
    const matchedCredits = (await matchResponse.json()).credits;
    const requestId = matchedCredits[0].request_id;

    expect(matchResponse.status).toBe(200);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const secondMatchResponse = await postPayload(matchPayload);
    const secondMatchedCredits = (await secondMatchResponse.json()).credits;
    expect(secondMatchedCredits[0].request_id).not.toBe(requestId);

    const savePayload = {
      action: "save",
      credits: matchedCredits,
      mediaType: "movie",
      mediaId: 42,
      dubbing_language: "en-US",
    };
    const response = await postPayload(savePayload);
    const retryResponse = await postPayload(savePayload);

    expect(response.status).toBe(200);
    expect(retryResponse.status).toBe(200);
    expect(routeMocks.rpc).toHaveBeenNthCalledWith(
      1,
      "controlled_save_metadata",
      {
        p_actor_id: "current-admin-id",
        p_entity_type: "voice_actor",
        p_payload: { firstname: "Ada", lastname: "Lovelace" },
        p_request_id: requestId,
      },
    );
    expect(routeMocks.rpc).toHaveBeenNthCalledWith(
      3,
      "controlled_save_metadata",
      {
        p_actor_id: "current-admin-id",
        p_entity_type: "voice_actor",
        p_payload: { firstname: "Ada", lastname: "Lovelace" },
        p_request_id: requestId,
      },
    );
    consoleError.mockRestore();
  });

  it("rejects unmatched voice actor saves without a request ID", async () => {
    const response = await postPayload({
      action: "save",
      credits: [{ voiceActor: "Ada Lovelace" }],
      mediaType: "movie",
      mediaId: 42,
      dubbing_language: "en-US",
    });

    expect(response.status).toBe(400);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });
});
