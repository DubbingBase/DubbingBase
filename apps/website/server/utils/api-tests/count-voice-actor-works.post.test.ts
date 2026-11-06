import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/count-voice-actor-works.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/count-voice-actor-works.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(
  result: {
    data: Array<{ voice_actor_id: number | null }> | null;
    error: { code: string } | null;
  } = {
    data: [],
    error: null,
  },
) {
  const inFilter = vi.fn(async () => result);
  const select = vi.fn(() => ({ in: inFilter }));
  const from = vi.fn(() => ({ select }));
  routeMocks.useSupabaseAdmin.mockReturnValue({ from });
  return { from, select, inFilter };
}

async function post(requestBody: unknown): Promise<Response> {
  const app = createApp();
  app.use("/", handler);
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requestBody),
    }),
  );
}

describe("POST /api/count-voice-actor-works", () => {
  it("counts works for each requested voice actor id", async () => {
    const { from, select, inFilter } = createSupabaseMock({
      data: [{ voice_actor_id: 3 }, { voice_actor_id: 3 }, { voice_actor_id: 9 }],
      error: null,
    });

    const response = await post({ ids: [3, 9, 12] });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ 3: 2, 9: 1, 12: 0 });
    expect(from).toHaveBeenCalledWith("work");
    expect(select).toHaveBeenCalledWith("voice_actor_id");
    expect(inFilter).toHaveBeenCalledWith("voice_actor_id", [3, 9, 12]);
  });

  it("rejects a non-object body before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post([3, 9]);

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a missing ids field before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({});

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an empty ids array before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({ ids: [] });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects non-integer or non-positive ids before any database call", async () => {
    const { from } = createSupabaseMock();

    const responses = await Promise.all([
      post({ ids: ["3"] }),
      post({ ids: [3.5] }),
      post({ ids: [0] }),
      post({ ids: [-1] }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400, 400]);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects more ids than the bulk limit before any database call", async () => {
    const { from } = createSupabaseMock();
    const ids = Array.from({ length: 501 }, (_, index) => index + 1);

    const response = await post({ ids });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
