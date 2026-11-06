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

let handler: typeof import("../../api/cast-vote.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/cast-vote.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.resolveUser.mockReturnValue({ id: "voter-1" });
});

afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(error: { code: string } | null = null) {
  const upsert = vi.fn(async () => ({ error }));
  const from = vi.fn(() => ({ upsert }));
  routeMocks.useSupabaseAdmin.mockReturnValue({ from });
  return { from, upsert };
}

async function post(requestBody: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = { id: "voter-1" };
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

describe("POST /api/cast-vote", () => {
  it("upserts the authenticated user's vote with a numeric work id", async () => {
    const { from, upsert } = createSupabaseMock();

    const response = await post({ work_id: 42, vote_type: "up" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(from).toHaveBeenCalledWith("votes");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "voter-1", work_id: 42, vote_type: "up" },
      { onConflict: "user_id,work_id" },
    );
  });

  it("accepts a numeric string work id and normalizes it to a number", async () => {
    const { upsert } = createSupabaseMock();

    const response = await post({ work_id: "7", vote_type: "down" });

    expect(response.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "voter-1", work_id: 7, vote_type: "down" },
      { onConflict: "user_id,work_id" },
    );
  });

  it("rejects a non-object body before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post("up");

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a missing vote_type before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({ work_id: 42 });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a vote_type outside up/down before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({ work_id: 42, vote_type: 1 });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a malformed work id before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({ work_id: "12abc", vote_type: "up" });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
