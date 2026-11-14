import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const resolveUserMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("../auth", () => ({ resolveUser: resolveUserMock }));

type Handler = typeof import("../../api/revert-task.post").default;
let revertTask: Handler;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  vi.stubGlobal("useRuntimeConfig", () => ({ resendApiKey: "" }));
  revertTask = (await import("../../api/revert-task.post")).default;
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
