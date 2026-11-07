import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const resolveUserMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("../auth", () => ({ resolveUser: resolveUserMock }));

type Handler = typeof import("../../api/revert-task.post").default;
let revertTask: Handler;
let notifySubscribers: Handler;
let requestPage: Handler;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  vi.stubGlobal("useRuntimeConfig", () => ({ resendApiKey: "" }));
  revertTask = (await import("../../api/revert-task.post")).default;
  notifySubscribers = (await import("../../api/notify-subscribers.post")).default;
  requestPage = (await import("../../api/request-voice-actor-page.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  resolveUserMock.mockResolvedValue({ id: "user-1", app_metadata: { role: "admin" } });
});

afterAll(() => vi.unstubAllGlobals());

async function post(handler: Handler, body: string): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.supabaseAdmin = { from: fromMock };
      return handler(event);
    }),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}

describe("revert-task body validation", () => {
  it.each([
    ["an empty body", "{}"],
    ["a non-object body", "[1]"],
    ["a numeric auditLogId", JSON.stringify({ auditLogId: 5 })],
    ["an empty auditLogId", JSON.stringify({ auditLogId: "" })],
  ])("rejects %s with 400 before touching the database", async (_label, body) => {
    const response = await post(revertTask, body);
    expect(response.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("notify-subscribers payload validation", () => {
  it.each([
    ["no record", "{}"],
    ["a non-object body", '"x"'],
    ["a missing project id", JSON.stringify({ record: { voice_actor_id: 1 } })],
    ["a zero id", JSON.stringify({ record: { voice_actor_id: 0, dubbing_project_id: 2 } })],
    ["a negative id", JSON.stringify({ record: { voice_actor_id: 1, dubbing_project_id: -2 } })],
    ["a fractional id", JSON.stringify({ record: { voice_actor_id: 1.5, dubbing_project_id: 2 } })],
    [
      "a non-numeric id",
      JSON.stringify({ record: { voice_actor_id: "abc", dubbing_project_id: 2 } }),
    ],
  ])("returns 400 for %s", async (_label, body) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await post(notifySubscribers, body);
    expect(response.status).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("request-voice-actor-page body validation", () => {
  it.each([
    ["malformed JSON", "{not json"],
    ["a non-object body", "[]"],
    ["non-string names", JSON.stringify({ firstname: 1, lastname: 2 })],
    ["a missing lastname", JSON.stringify({ firstname: "A" })],
  ])("returns 400 for %s", async (_label, body) => {
    const response = await post(requestPage, body);
    expect(response.status).toBe(400);
  });

  it("requires authentication first", async () => {
    resolveUserMock.mockResolvedValue(null);
    const response = await post(requestPage, JSON.stringify({ firstname: "A", lastname: "B" }));
    expect(response.status).toBe(401);
  });
});
