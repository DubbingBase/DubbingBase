import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/update-voice-actor.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/update-voice-actor.post")).default;
});

beforeEach(() => vi.clearAllMocks());
afterAll(() => vi.unstubAllGlobals());

type User = { id: string; app_metadata?: { role?: string } };

function createSupabaseMock(linked = true) {
  const linkQuery = {
    select: vi.fn(() => linkQuery),
    eq: vi.fn(() => linkQuery),
    maybeSingle: vi.fn(async () => ({
      data: linked ? { voice_actor_id: 41 } : null,
      error: null,
    })),
  };
  const updateQuery = {
    eq: vi.fn(() => updateQuery),
    select: vi.fn(() => updateQuery),
    single: vi.fn(async () => ({ data: { id: 41 }, error: null })),
  };
  const update = vi.fn(() => updateQuery);
  const supabase = {
    from: vi.fn((table: string) => {
      if (table === "user_voice_actor_links") return linkQuery;
      return { update };
    }),
  };
  return { supabase, update, linkQuery };
}

async function post(options: { user?: User; updates: Record<string, unknown>; linked?: boolean }) {
  const mocks = createSupabaseMock(options.linked);
  routeMocks.useSupabaseAdmin.mockReturnValue(mocks.supabase);
  routeMocks.requireUser.mockImplementation(() => options.user);

  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = options.user;
      return handler(event);
    }),
  );
  const response = await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ voice_actor_id: 41, updates: options.updates }),
    }),
  );
  return { ...mocks, response };
}

describe("POST /api/update-voice-actor", () => {
  it.each([
    ["remote URL", "https://images.example.test/picture.jpg"],
    ["storage path", "41/portrait.png"],
    ["empty string", ""],
    ["null", null],
  ])(
    "rejects linked non-admin profile_picture %s before privileged writes",
    async (_name, picture) => {
      const { response, update } = await post({
        user: { id: "linked-user" },
        updates: { profile_picture: picture },
      });
      expect(response.status).toBe(403);
      expect(update).not.toHaveBeenCalled();
      expect(routeMocks.useSupabaseAdmin).not.toHaveBeenCalled();
    },
  );

  it("allows linked non-admin users to update permitted metadata", async () => {
    const { response, update, linkQuery } = await post({
      user: { id: "linked-user" },
      updates: { biography: "Updated biography" },
    });
    expect(response.status).toBe(200);
    expect(linkQuery.maybeSingle).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ biography: "Updated biography" }),
    );
  });

  it.each(["41/new-picture.png", null])(
    "allows admins to modify profile_picture to %s",
    async (picture) => {
      const { response, update } = await post({
        user: { id: "admin", app_metadata: { role: "admin" } },
        updates: { profile_picture: picture },
      });
      expect(response.status).toBe(200);
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ profile_picture: picture }));
    },
  );
});
