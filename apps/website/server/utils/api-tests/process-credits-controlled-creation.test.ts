import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  requireDubbingLanguage: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
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
  routeMocks.requireDubbingLanguage.mockReturnValue("en-US");
  routeMocks.rpc.mockResolvedValue({
    data: [{ work_id: 13, project_id: 42, voice_actor_id: 91 }],
    error: null,
  });
  const query = {
    select: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  query.select.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  routeMocks.from.mockReturnValue(query);
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
  it("passes a stable per-credit request ID to the atomic save on retries", async () => {
    const matchPayload = {
      action: "match",
      credits: [{ voiceActor: "Ada Lovelace", role: "Misty", matchedActorId: 42 }],
    };
    const matchResponse = await postPayload(matchPayload);
    const matchedCredits = (await matchResponse.json()).credits;
    const requestId = matchedCredits[0].request_id;

    expect(matchResponse.status).toBe(200);
    expect(requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

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
    expect(routeMocks.rpc).toHaveBeenNthCalledWith(1, "save_admin_credit_import", {
      p_admin_id: "current-admin-id",
      p_request_id: requestId,
      p_content_id: 42,
      p_content_type: "movie",
      p_language: "en-US",
      p_voice_actor_id: null,
      p_voice_actor_firstname: "Ada",
      p_voice_actor_lastname: "Lovelace",
      p_work_actor_id: 42,
      p_character_id: null,
      p_character_name: "Misty",
    });
    expect(routeMocks.rpc).toHaveBeenNthCalledWith(
      2,
      "save_admin_credit_import",
      expect.objectContaining({ p_request_id: requestId }),
    );
  });

  it("rejects an unmatched voice actor save without its match request ID", async () => {
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

  it("derives a stable request ID for matched credits from legacy callers", async () => {
    const payload = {
      action: "save",
      credits: [
        {
          role: "Misty",
          matchedActorId: 42,
          matchedVoiceActor: {
            id: 91,
            firstname: "Ada",
            lastname: "Lovelace",
          },
        },
      ],
      mediaType: "movie",
      mediaId: 42,
      dubbing_language: "en-US",
    };

    const firstResponse = await postPayload(payload);
    const retryResponse = await postPayload(payload);

    expect(firstResponse.status).toBe(200);
    expect(retryResponse.status).toBe(200);
    expect(routeMocks.rpc).toHaveBeenCalledTimes(2);
    expect(routeMocks.rpc.mock.calls[1]?.[1]).toEqual(routeMocks.rpc.mock.calls[0]?.[1]);
    expect(routeMocks.rpc.mock.calls[0]?.[1].p_request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("continues a batch after one credit fails", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    routeMocks.rpc
      .mockResolvedValueOnce({
        data: [{ work_id: 13, project_id: 42, voice_actor_id: 91 }],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: "work failed" } });

    const response = await postPayload({
      action: "save",
      credits: [
        {
          request_id: "56368400-0000-4000-8000-000000000001",
          matchedActorId: 42,
          matchedVoiceActor: { id: 91, firstname: "Ada", lastname: "Lovelace" },
          role: "Misty",
        },
        {
          request_id: "56368400-0000-4000-8000-000000000002",
          matchedActorId: 43,
          matchedVoiceActor: { id: 92, firstname: "Grace", lastname: "Hopper" },
          role: "Brittany",
        },
      ],
      mediaType: "movie",
      mediaId: 42,
      dubbing_language: "en-US",
    });
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.successCount).toBe(1);
    expect(result.failedCredits).toHaveLength(1);
    expect(result.failedCredits[0].credit.role).toBe("Brittany");
    expect(routeMocks.rpc).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });
});
