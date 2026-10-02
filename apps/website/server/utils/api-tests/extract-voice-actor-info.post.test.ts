import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../auth", () => ({ requireAdmin: vi.fn() }));

let handler: typeof import("../../api/extract-voice-actor-info.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/extract-voice-actor-info.post")).default;
});

afterAll(() => vi.unstubAllGlobals());

describe("POST /api/extract-voice-actor-info Wikipedia source URL", () => {
  it("rejects a Simple Wikipedia URL before making external requests", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ query: { pages: {} } }), { status: 200 }));
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => handler(event)),
    );

    const response = await toWebHandler(app)(
      new Request("http://localhost/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wikipediaUrl: "https://simple.wikipedia.org/wiki/Example" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
