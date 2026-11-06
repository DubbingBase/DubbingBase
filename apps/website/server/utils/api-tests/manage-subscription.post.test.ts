import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  resolveUser: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ resolveUser: routeMocks.resolveUser }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/manage-subscription.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/manage-subscription.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.resolveUser.mockReturnValue({ id: "subscriber-1" });
});

afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(error: { code: string } | null = null) {
  const insert = vi.fn(async () => ({ error }));
  const deleteEqVoiceActor = vi.fn(async () => ({ error }));
  const deleteEqUser = vi.fn(() => ({ eq: deleteEqVoiceActor }));
  const deleteFn = vi.fn(() => ({ eq: deleteEqUser }));
  const from = vi.fn(() => ({ insert, delete: deleteFn }));
  routeMocks.useSupabaseAdmin.mockReturnValue({ from });
  return { from, insert, deleteFn, deleteEqUser, deleteEqVoiceActor };
}

async function post(requestBody: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = { id: "subscriber-1" };
      return handler(event);
    }),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }),
  );
}

describe("POST /api/manage-subscription", () => {
  it("subscribes the authenticated user to a valid voice actor id", async () => {
    const { from, insert } = createSupabaseMock();

    const response = await post({ action: "subscribe", voice_actor_id: 15 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("voice_actor_subscriptions");
    expect(insert).toHaveBeenCalledWith({ user_id: "subscriber-1", voice_actor_id: 15 });
  });

  it("unsubscribes the authenticated user from a valid voice actor id", async () => {
    const { deleteEqUser, deleteEqVoiceActor } = createSupabaseMock();

    const response = await post({ action: "unsubscribe", voice_actor_id: 15 });

    expect(response.status).toBe(200);
    expect(deleteEqUser).toHaveBeenCalledWith("user_id", "subscriber-1");
    expect(deleteEqVoiceActor).toHaveBeenCalledWith("voice_actor_id", 15);
  });

  it("rejects a non-object body before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post("subscribe");

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an unknown action before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({ action: "delete-everything", voice_actor_id: 15 });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a subscribe request without voice_actor_id before any database call", async () => {
    const { from, insert } = createSupabaseMock();

    const response = await post({ action: "subscribe" });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a non-integer voice_actor_id before any database call", async () => {
    const { from, deleteFn } = createSupabaseMock();

    const response = await post({ action: "unsubscribe", voice_actor_id: "15; drop" });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
    expect(deleteFn).not.toHaveBeenCalled();
  });
});
