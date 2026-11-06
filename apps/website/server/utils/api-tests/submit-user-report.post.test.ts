import { createApp, createError, defineEventHandler, readBody, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  resolveUser: vi.fn(),
  sendDiscordAdminNotification: vi.fn(),
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../auth", () => ({ resolveUser: routeMocks.resolveUser }));
vi.mock("../notifications/discord", () => ({
  sendDiscordAdminNotification: routeMocks.sendDiscordAdminNotification,
}));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: routeMocks.useSupabaseAdmin,
}));

let handler: typeof import("../../api/submit-user-report.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/submit-user-report.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.resolveUser.mockReturnValue({ id: "reporter-1" });
  routeMocks.sendDiscordAdminNotification.mockResolvedValue(undefined);
});

afterAll(() => vi.unstubAllGlobals());

function createSupabaseMock(
  result: { data: Record<string, unknown> | null; error: { code: string } | null } = {
    data: { id: "report-1" },
    error: null,
  },
) {
  const single = vi.fn(async () => result);
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  const from = vi.fn(() => ({ insert }));
  routeMocks.useSupabaseAdmin.mockReturnValue({ from });
  return { from, insert };
}

async function post(requestBody: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => {
      event.context.user = { id: "reporter-1" };
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

describe("POST /api/submit-user-report", () => {
  it("inserts a pending report for the authenticated reporter", async () => {
    const { from, insert } = createSupabaseMock();

    const response = await post({
      target_url: "https://dubbingbase.com/movie/42",
      reason: "Erreur manifeste dans les données",
      details: "Le doublage est attribué au mauvais acteur.",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: { id: "report-1" } });
    expect(from).toHaveBeenCalledWith("user_reports");
    expect(insert).toHaveBeenCalledWith({
      reporter_id: "reporter-1",
      target_url: "https://dubbingbase.com/movie/42",
      reason: "Erreur manifeste dans les données",
      details: "Le doublage est attribué au mauvais acteur.",
      status: "pending",
    });
    expect(routeMocks.sendDiscordAdminNotification).toHaveBeenCalledOnce();
  });

  it("rejects a non-object body before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post("report");

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a missing reason before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({ target_url: "https://dubbingbase.com/movie/42" });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a target_url that is not an http(s) URL before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({
      target_url: "javascript:alert(1)",
      reason: "Autre",
    });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a non-string reason before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({
      target_url: "https://dubbingbase.com/movie/42",
      reason: 7,
    });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects non-string details before any database call", async () => {
    const { from } = createSupabaseMock();

    const response = await post({
      target_url: "https://dubbingbase.com/movie/42",
      reason: "Autre",
      details: { text: "too much" },
    });

    expect(response.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});
