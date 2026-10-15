import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  fetchMediaDetails: vi.fn(),
  getGame: vi.fn(),
  getGameCharacters: vi.fn(),
  getBook: vi.fn(),
  getPodcast: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));
vi.mock("../../utils", () => ({
  useTmdbClient: () => ({ fetchMediaDetails: routeMocks.fetchMediaDetails }),
  useIgdbClient: () => ({
    getGame: routeMocks.getGame,
    getGameCharacters: routeMocks.getGameCharacters,
  }),
  useOpenLibraryClient: () => ({ getBook: routeMocks.getBook }),
  usePodcastClient: () => ({ getPodcast: routeMocks.getPodcast }),
}));

let handler: typeof import("../../api/link-voice-actor.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/link-voice-actor.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockReturnValue({
    id: "actor-user-1",
    app_metadata: { role: "user" },
  });
  routeMocks.fetchMediaDetails.mockResolvedValue({
    id: 90,
    credits: { cast: [{ id: 12 }] },
  });
});

afterAll(() => vi.unstubAllGlobals());

const requestId = "e65a9ae4-d053-4c2f-a85c-9273b95e1288";

function validBody() {
  return {
    request_id: requestId,
    voice_actor_id: 41,
    media_type: "movie",
    media_id: 90,
    actor_id: 12,
    character_name: " Rôle libre ",
    performance: "dialogues",
    dubbing_language: "fr-FR",
  };
}

function query(result: { data: unknown; error: { code: string } | null }) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return chain;
}

function createSupabaseMock(options?: {
  ownership?: boolean;
  rpcResult?: {
    data: Array<{
      work_id: number;
      project_id: number;
      audit_log_id: string;
      replayed: boolean;
    }> | null;
    error: { code: string } | null;
  };
}) {
  const rpc = vi.fn(
    async () =>
      options?.rpcResult ?? {
        data: [
          {
            work_id: 73,
            project_id: 25,
            audit_log_id: "audit-work-1",
            replayed: false,
          },
        ],
        error: null,
      },
  );
  const from = vi.fn((table: string) => {
    if (table === "user_voice_actor_links") {
      return query({
        data: options?.ownership === false ? null : { id: "ownership-link" },
        error: null,
      });
    }
    if (table === "voice_actors") {
      return query({
        data: { id: 41, firstname: "Voice", lastname: "Actor" },
        error: null,
      });
    }
    if (table === "work") {
      return query({
        data: {
          id: 73,
          dubbing_project_id: 25,
          voice_actor_id: 41,
          actor_id: 12,
          character_name: " Rôle libre ",
          performance: "dialogues",
          status: "user",
        },
        error: null,
      });
    }
    return query({ data: { id: 25 }, error: null });
  });
  routeMocks.useSupabaseAdmin.mockReturnValue({ from, rpc });
  return { from, rpc };
}

async function post(body: unknown, authenticated = true): Promise<Response> {
  if (!authenticated) {
    routeMocks.requireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, message: "Unauthorized" });
    });
  }
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = authenticated ? { id: "actor-user-1" } : undefined;
      return handler(event);
    }),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/link-voice-actor", () => {
  it("rejects anonymous writes before accessing the service client", async () => {
    const { rpc } = createSupabaseMock();

    const response = await post(validBody(), false);

    expect(response.status).toBe(401);
    expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the authenticated actor and one transactional audited RPC", async () => {
    const { rpc } = createSupabaseMock();
    const body = validBody();

    const response = await post(body);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 73,
      dubbing_project_id: 25,
      voice_actor_id: 41,
      character_name: " Rôle libre ",
      voiceActorDetails: { id: 41 },
      auditLogId: "audit-work-1",
      replayed: false,
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("create_voice_actor_work_link", {
      p_user_id: "actor-user-1",
      p_request_id: body.request_id,
      p_voice_actor_id: body.voice_actor_id,
      p_content_id: body.media_id,
      p_content_type: body.media_type,
      p_language: body.dubbing_language,
      p_actor_person_id: body.actor_id,
      p_character_name: body.character_name,
      p_performance: body.performance,
    });
  });

  it("rejects impersonation and protected fields before a mutation", async () => {
    const { rpc } = createSupabaseMock();

    const response = await post({ ...validBody(), targetUserId: "someone-else" });

    expect(response.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid performance values before a mutation", async () => {
    const { rpc } = createSupabaseMock();

    const response = await post({ ...validBody(), performance: "admin" });

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects invalid media types and dubbing languages before provider access", async () => {
    const { rpc } = createSupabaseMock();

    const mediaTypeResponse = await post({ ...validBody(), media_type: "book" });
    const languageResponse = await post({ ...validBody(), dubbing_language: "xx-XX" });

    expect(mediaTypeResponse.status).toBe(400);
    expect(languageResponse.status).toBe(400);
    expect(routeMocks.fetchMediaDetails).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects actor ids that do not belong to the selected movie", async () => {
    const { rpc } = createSupabaseMock();

    const response = await post({ ...validBody(), actor_id: 999 });

    expect(response.status).toBe(422);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects unlinked users before external media-provider lookups", async () => {
    const { rpc } = createSupabaseMock({ ownership: false });

    const response = await post(validBody());

    expect(response.status).toBe(403);
    expect(routeMocks.fetchMediaDetails).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a database ownership denial to forbidden", async () => {
    const { rpc } = createSupabaseMock({
      rpcResult: { data: null, error: { code: "42501" } },
    });

    const response = await post(validBody());

    expect(response.status).toBe(403);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("returns an idempotent retry result from the same stable request id", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: [{ work_id: 73, project_id: 25, audit_log_id: "audit-work-1", replayed: false }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ work_id: 73, project_id: 25, audit_log_id: "audit-work-1", replayed: true }],
        error: null,
      });
    const from = vi.fn((table: string) =>
      table === "voice_actors"
        ? query({ data: { id: 41 }, error: null })
        : query({ data: { id: 73, voice_actor_id: 41 }, error: null }),
    );
    routeMocks.useSupabaseAdmin.mockReturnValue({ from, rpc });

    const first = await post(validBody());
    const second = await post(validBody());

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ replayed: true, auditLogId: "audit-work-1" });
    expect(rpc.mock.calls.map(([name, args]) => [name, args.p_request_id])).toEqual([
      ["create_voice_actor_work_link", requestId],
      ["create_voice_actor_work_link", requestId],
    ]);
  });

  it("does not report success when the RPC fails internally", async () => {
    const { rpc } = createSupabaseMock({
      rpcResult: { data: null, error: { code: "XX000" } },
    });

    const response = await post(validBody());

    expect(response.status).toBe(500);
    expect(rpc).toHaveBeenCalledOnce();
  });
});
