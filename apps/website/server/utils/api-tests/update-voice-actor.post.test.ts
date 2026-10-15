import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({ useSupabaseAdmin: routeMocks.useSupabaseAdmin }));

let handler: typeof import("../../api/update-voice-actor.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  vi.stubGlobal("useRuntimeConfig", () => ({ supabaseUrl: "http://supabase.local" }));
  handler = (await import("../../api/update-voice-actor.post")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

type User = { id: string; app_metadata?: { role?: string } };
type RpcResult = { data: unknown; error: { code?: string } | null };

function createSupabaseMock(result: RpcResult) {
  const remove = vi.fn(async () => ({ error: null }));
  const upload = vi.fn(async () => ({ error: null }));
  const list = vi.fn(async () => ({ data: [], error: null }));
  const fromStorage = vi.fn(() => ({ upload, remove, list }));
  const rpc = vi.fn(async () => result);
  return { supabase: { rpc, storage: { from: fromStorage } }, rpc, upload, remove, list };
}

async function post(options: {
  body: unknown;
  user?: User;
  authError?: { statusCode: number; message: string };
  result?: RpcResult;
  addWriteArgs?: boolean;
}) {
  const mocks = createSupabaseMock(
    options.result ?? {
      data: {
        record: {
          id: 41,
          bio: "Updated biography",
          updated_at: "2026-10-15T12:00:01.000Z",
          updated_by: options.user?.id,
        },
        audit_log_id: "audit-1",
        changed: true,
        replayed: false,
      },
      error: null,
    },
  );
  routeMocks.useSupabaseAdmin.mockReturnValue(mocks.supabase);
  routeMocks.requireUser.mockImplementation(() => {
    if (options.authError) throw createError(options.authError);
    return options.user;
  });

  const requestBody =
    options.addWriteArgs === false ||
    typeof options.body !== "object" ||
    options.body === null ||
    Array.isArray(options.body)
      ? options.body
      : {
          ...options.body,
          expected_updated_at:
            "expected_updated_at" in options.body
              ? options.body.expected_updated_at
              : "2026-10-15T12:00:00.000Z",
          request_id:
            "request_id" in options.body
              ? options.body.request_id
              : "11111111-1111-4111-8111-111111111111",
        };

  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }),
  );
  return { ...mocks, response };
}

describe("POST /api/update-voice-actor", () => {
  it.each([["anonymous", { statusCode: 401, message: "Unauthorized" }]])(
    "rejects %s before a successful mutation",
    async (_name, authError) => {
      const { response, rpc } = await post({
        body: { voice_actor_id: 41, updates: { bio: "Updated biography" } },
        authError,
      });
      expect(response.status).toBe(authError.statusCode);
      expect(rpc).not.toHaveBeenCalled();
      expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
    },
  );

  it("maps an absent or incorrect voice actor link to forbidden", async () => {
    const { response, rpc } = await post({
      body: { voice_actor_id: 41, updates: { bio: "Updated biography" } },
      user: { id: "unlinked-user" },
      result: { data: null, error: { code: "42501" } },
    });
    expect(response.status).toBe(403);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("passes a linked user's allowlisted patch and identity to the controlled RPC", async () => {
    const { response, rpc } = await post({
      body: {
        voice_actor_id: "41",
        updates: {
          bio: "Updated biography",
          social_media_links: { website: "https://example.test" },
        },
        expected_updated_at: "2026-10-15T12:00:00.000Z",
        request_id: "11111111-1111-4111-8111-111111111111",
      },
      user: { id: "linked-user" },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      profile: {
        id: 41,
        bio: "Updated biography",
        updated_at: "2026-10-15T12:00:01.000Z",
        updated_by: "linked-user",
      },
    });
    expect(rpc).toHaveBeenCalledWith("controlled_update_voice_actor", {
      p_actor_id: "linked-user",
      p_voice_actor_id: 41,
      p_payload: {
        bio: "Updated biography",
        social_media_links: { website: "https://example.test" },
      },
      p_expected_updated_at: "2026-10-15T12:00:00.000Z",
      p_request_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects protected fields, profile pictures, malformed IDs, and empty patches", async () => {
    const user = { id: "linked-user" };
    for (const { body, statusCode } of [
      { body: { voice_actor_id: 41, updates: { created_by: "other-user" } }, statusCode: 400 },
      { body: { voice_actor_id: 41, updates: { firstname: "Forged" } }, statusCode: 403 },
      {
        body: { voice_actor_id: 41, updates: { profile_picture: "41/new-picture.png" } },
        statusCode: 403,
      },
      { body: { voice_actor_id: 0, updates: { bio: "invalid id" } }, statusCode: 400 },
      { body: { voice_actor_id: 41, updates: {} }, statusCode: 400 },
    ]) {
      const { response, rpc } = await post({ body, user });
      expect(response.status).toBe(statusCode);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("requires an expected version and per-operation request ID", async () => {
    const { response, rpc } = await post({
      body: { voice_actor_id: 41, updates: { bio: "Updated biography" } },
      user: { id: "linked-user" },
      addWriteArgs: false,
    });
    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("allows admins to patch administrator fields through the same audited operation", async () => {
    const { response, rpc } = await post({
      body: {
        voice_actor_id: 41,
        updates: { tmdb_id: 88, status: "active", profile_picture: "41/portrait.png" },
        expected_updated_at: "2026-10-15T12:00:00.000Z",
        request_id: "11111111-1111-4111-8111-111111111111",
      },
      user: { id: "admin-user", app_metadata: { role: "admin" } },
    });
    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("controlled_update_voice_actor", {
      p_actor_id: "admin-user",
      p_voice_actor_id: 41,
      p_payload: { tmdb_id: 88, status: "active", profile_picture: "41/portrait.png" },
      p_expected_updated_at: "2026-10-15T12:00:00.000Z",
      p_request_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it.each([
    ["stale update", "40001", 409],
    ["invalid field", "22023", 400],
    ["missing actor", "P0002", 404],
  ])("maps %s from the atomic operation", async (_name, code, statusCode) => {
    const { response } = await post({
      body: { voice_actor_id: 41, updates: { bio: "Updated biography" } },
      user: { id: "linked-user" },
      result: { data: null, error: { code } },
    });
    expect(response.status).toBe(statusCode);
  });

  it("stages an external picture at a stable content-addressed path for retries", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          }),
      ),
    );
    try {
      const body = {
        voice_actor_id: 41,
        updates: { profile_picture: "https://images.example.test/portrait.jpg" },
        expected_updated_at: "2026-10-15T12:00:00.000Z",
        request_id: "11111111-1111-4111-8111-111111111111",
      };
      const first = await post({
        body,
        user: { id: "admin-user", app_metadata: { role: "admin" } },
      });
      const retry = await post({
        body: {
          ...body,
          request_id: body.request_id.toUpperCase(),
        },
        user: { id: "admin-user", app_metadata: { role: "admin" } },
      });
      expect(first.response.status).toBe(200);
      expect(retry.response.status).toBe(200);
      const firstPath = first.upload.mock.calls[0]?.[0];
      const retryPath = retry.upload.mock.calls[0]?.[0];
      expect(firstPath).toBe(retryPath);
      expect(firstPath).toMatch(
        /^41-11111111-1111-4111-8111-111111111111-[a-f0-9]{64}-[a-f0-9]{64}\.jpg$/,
      );
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });

  it("removes a newly staged picture when the audited database operation fails", async () => {
    const originalFetch = globalThis.fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([4, 5, 6]), {
            status: 200,
            headers: { "content-type": "image/jpeg" },
          }),
      ),
    );
    try {
      const { response, remove, upload } = await post({
        body: {
          voice_actor_id: 41,
          updates: { profile_picture: "https://images.example.test/failed.jpg" },
        },
        user: { id: "admin-user", app_metadata: { role: "admin" } },
        result: { data: null, error: { code: "50000" } },
      });
      expect(response.status).toBe(500);
      expect(remove).toHaveBeenCalledWith([upload.mock.calls[0]?.[0]]);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });
});
