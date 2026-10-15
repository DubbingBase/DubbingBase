import {
  createApp,
  createError,
  defineEventHandler,
  readMultipartFormData,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  from: vi.fn(),
  claimResult: vi.fn(),
  actorResult: vi.fn(),
  studioResult: vi.fn(),
  rpc: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({
    from: routeMocks.from,
    rpc: routeMocks.rpc,
    storage: {
      from: () => ({ upload: routeMocks.upload, remove: routeMocks.remove }),
    },
  }),
}));

let handler: typeof import("../../api/submit-task.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readMultipartFormData", readMultipartFormData);
  handler = (await import("../../api/submit-task.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockReturnValue({ id: "user-1", app_metadata: {} });
  routeMocks.claimResult.mockResolvedValue({
    data: {
      claim_id: "c2e7345d-8f16-450a-b903-4f8c7b917f6a",
      category: "enrich_voice_actor",
      entity_id: "41",
      user_id: "user-1",
      expires_at: "2099-01-01T00:00:00.000Z",
      consumed_at: null,
    },
    error: null,
  });
  routeMocks.actorResult.mockResolvedValue({
    data: {
      nationality: null,
      date_of_birth: null,
      bio: null,
      tmdb_id: null,
      wikidata_id: null,
      profile_picture: null,
      social_media_links: null,
    },
    error: null,
  });
  routeMocks.studioResult.mockResolvedValue({ data: null, error: null });
  routeMocks.rpc.mockResolvedValue({
    data: [{ status: "submitted", points_awarded: 10 }],
    error: null,
  });
  routeMocks.upload.mockResolvedValue({
    data: { path: "41/c2e7345d-8f16-450a-b903-4f8c7b917f6a.png" },
    error: null,
  });
  routeMocks.remove.mockResolvedValue({ data: [], error: null });

  routeMocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      maybeSingle: vi.fn(() =>
        table === "gamification_task_locks"
          ? routeMocks.claimResult()
          : table === "voice_actors"
            ? routeMocks.actorResult()
            : routeMocks.studioResult(),
      ),
    };
    return query;
  });
});

afterAll(() => vi.unstubAllGlobals());

async function postForm(form: FormData): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return await toWebHandler(app)(new Request("http://localhost/", { method: "POST", body: form }));
}

describe("POST /api/submit-task", () => {
  it("derives category and entity from an owned claim and records success only after the RPC", async () => {
    const form = new FormData();
    form.append("claimId", "c2e7345d-8f16-450a-b903-4f8c7b917f6a");
    form.append("bio", "Voice actor biography");

    const response = await postForm(form);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, pointsAwarded: 10 });
    expect(routeMocks.rpc).toHaveBeenCalledWith("submit_gamification_task_contribution", {
      p_claim_id: "c2e7345d-8f16-450a-b903-4f8c7b917f6a",
      p_user_id: "user-1",
      p_updates: { bio: "Voice actor biography" },
      p_is_admin: false,
    });
  });

  it("rejects client-supplied category and entity authority before database reads", async () => {
    const form = new FormData();
    form.append("claimId", "c2e7345d-8f16-450a-b903-4f8c7b917f6a");
    form.append("category", "enrich_studio");
    form.append("entityId", "99");

    const response = await postForm(form);

    expect(response.status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid, wrong-owner, expired, and consumed claims without submitting", async () => {
    const invalidId = new FormData();
    invalidId.append("claimId", "not-a-uuid");
    invalidId.append("bio", "Bio");
    expect((await postForm(invalidId)).status).toBe(400);
    expect(routeMocks.from).not.toHaveBeenCalled();

    routeMocks.claimResult.mockResolvedValueOnce({ data: null, error: null });
    const form = new FormData();
    form.append("claimId", "c2e7345d-8f16-450a-b903-4f8c7b917f6a");
    form.append("bio", "Bio");
    const response = await postForm(form);
    expect(response.status).toBe(409);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("does not report success or leave a staged image when the atomic write fails", async () => {
    routeMocks.rpc.mockResolvedValueOnce({ data: null, error: new Error("audit insert failed") });
    const form = new FormData();
    form.append("claimId", "c2e7345d-8f16-450a-b903-4f8c7b917f6a");
    form.append(
      "file",
      new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: "image/png",
      }),
      "actor.png",
    );

    const response = await postForm(form);

    expect(response.status).toBe(500);
    expect(await response.json()).not.toEqual({ success: true, pointsAwarded: 10 });
    expect(routeMocks.upload).toHaveBeenCalledOnce();
    expect(routeMocks.remove).toHaveBeenCalledOnce();
  });

  it("allows a non-admin first voice-actor picture and blocks replacement before upload", async () => {
    const firstUpload = new FormData();
    firstUpload.append("claimId", "c2e7345d-8f16-450a-b903-4f8c7b917f6a");
    firstUpload.append(
      "file",
      new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: "image/png",
      }),
      "actor.png",
    );
    expect((await postForm(firstUpload)).status).toBe(200);
    expect(routeMocks.upload).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    routeMocks.requireUser.mockReturnValue({ id: "user-1", app_metadata: {} });
    routeMocks.claimResult.mockResolvedValue({
      data: {
        claim_id: "c2e7345d-8f16-450a-b903-4f8c7b917f6a",
        category: "enrich_voice_actor",
        entity_id: "41",
        user_id: "user-1",
        expires_at: "2099-01-01T00:00:00.000Z",
        consumed_at: null,
      },
      error: null,
    });
    routeMocks.actorResult.mockResolvedValue({
      data: {
        nationality: null,
        date_of_birth: null,
        bio: null,
        tmdb_id: null,
        wikidata_id: null,
        profile_picture: "41/existing.png",
        social_media_links: null,
      },
      error: null,
    });
    routeMocks.rpc.mockResolvedValue({
      data: [{ status: "submitted", points_awarded: 10 }],
      error: null,
    });
    routeMocks.from.mockImplementation((table: string) => {
      const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        maybeSingle: vi.fn(() =>
          table === "gamification_task_locks" ? routeMocks.claimResult() : routeMocks.actorResult(),
        ),
      };
      return query;
    });

    const replaceForm = new FormData();
    replaceForm.append("claimId", "c2e7345d-8f16-450a-b903-4f8c7b917f6a");
    replaceForm.append(
      "file",
      new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: "image/png",
      }),
      "actor.png",
    );
    const response = await postForm(replaceForm);
    expect(response.status).toBe(403);
    expect(routeMocks.upload).not.toHaveBeenCalled();
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });
});
