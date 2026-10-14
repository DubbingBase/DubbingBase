import {
  createApp,
  createError,
  defineEventHandler,
  readBody,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({ rpc: routeMocks.rpc }),
}));

let handler: typeof import("../../api/get-random-task.post").default;
let getHandler: typeof import("../../api/get-random-task.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/get-random-task.post")).default;
  getHandler = (await import("../../api/get-random-task.get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockReturnValue({ id: "user-1" });
});

afterAll(() => vi.unstubAllGlobals());

async function postPayload(payload: unknown): Promise<Response> {
  const app = createApp();
  app.use("/", defineEventHandler((event) => handler(event)));
  return await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

async function getRequest(): Promise<Response> {
  const app = createApp();
  app.use("/", defineEventHandler((event) => getHandler(event)));
  return await toWebHandler(app)(new Request("http://localhost/"));
}

describe("POST /api/get-random-task", () => {
  it("does not acquire a claim through GET", async () => {
    const response = await getRequest();

    expect(response.status).toBe(405);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("requires an authenticated user", async () => {
    routeMocks.requireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, message: "Unauthorized" });
    });

    const response = await postPayload({ category: "enrich_voice_actor" });

    expect(response.status).toBe(401);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid categories without requesting a claim", async () => {
    const response = await postPayload({ category: "unknown" });

    expect(response.status).toBe(400);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("resolves an any request to the concrete category returned by the database", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: [{
        task: { id: 3, logo_url: null },
        category: "enrich_studio",
        claim_id: "claim-2",
        expires_at: "2026-10-14T18:37:00.000Z",
      }],
      error: null,
    });

    const response = await postPayload({ category: "any" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      task: { id: 3, logo_url: null },
      category: "enrich_studio",
      claimId: "claim-2",
      expiresAt: "2026-10-14T18:37:00.000Z",
    });
    expect(routeMocks.rpc).toHaveBeenCalledWith("claim_gamification_task", {
      p_category: "any",
      p_user_id: "user-1",
    });
  });

  it("returns the opaque claim details from the atomic database acquisition", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: [{
        task: { id: 7, bio: null },
        category: "enrich_voice_actor",
        claim_id: "opaque-id",
        expires_at: "2026-10-14T18:37:00.000Z",
      }],
      error: null,
    });

    const response = await postPayload({ category: "enrich_voice_actor" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      task: { id: 7, bio: null },
      category: "enrich_voice_actor",
      claimId: "opaque-id",
      expiresAt: "2026-10-14T18:37:00.000Z",
    });
    expect(routeMocks.rpc).toHaveBeenCalledWith("claim_gamification_task", {
      p_category: "enrich_voice_actor",
      p_user_id: "user-1",
    });
  });

  it("preserves all four response keys when no task can be claimed", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: [{ task: null, category: "enrich_studio", claim_id: null, expires_at: null }],
      error: null,
    });

    const response = await postPayload({ category: "enrich_studio" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      task: null,
      category: "enrich_studio",
      claimId: null,
      expiresAt: null,
    });
  });

  it("does not reveal database failures as a successful no-task response", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: null,
      error: new Error("database unavailable"),
    });

    const response = await postPayload({ category: "enrich_studio" });

    expect(response.status).toBe(500);
    expect(await response.json()).not.toEqual({
      task: null,
      category: "enrich_studio",
      claimId: null,
      expiresAt: null,
    });
  });
});
