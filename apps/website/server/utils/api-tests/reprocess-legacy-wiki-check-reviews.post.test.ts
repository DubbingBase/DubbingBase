import { createApp, createError, defineEventHandler, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({ rpc: routeMocks.rpc }),
}));

let handler: typeof import("../../api/admin/queue/reprocess-legacy-wiki-check-reviews.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  handler = (await import("../../api/admin/queue/reprocess-legacy-wiki-check-reviews.post"))
    .default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({ id: "admin-u1" });
  routeMocks.rpc.mockResolvedValue({ data: [], error: null });
});

afterAll(() => vi.unstubAllGlobals());

async function postReprocess(): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/api/admin/queue/reprocess-legacy-wiki-check-reviews", {
      method: "POST",
    }),
  );
}

describe("POST /api/admin/queue/reprocess-legacy-wiki-check-reviews", () => {
  it("requires an authenticated admin", async () => {
    routeMocks.requireAdmin.mockImplementation(() => {
      throw createError({ statusCode: 403, message: "Admin access required" });
    });

    const response = await postReprocess();

    expect(response.status).toBe(403);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("invokes the fixed, idempotent database reprocessor without client-supplied IDs", async () => {
    const outcomes = [
      { tmdb_id: 1492640, outcome: "requeued", queued_msg_id: 701 },
      { tmdb_id: 284558, outcome: "already_enqueued", queued_msg_id: null },
    ];
    routeMocks.rpc.mockResolvedValue({ data: outcomes, error: null });

    const response = await postReprocess();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ outcomes });
    expect(routeMocks.rpc).toHaveBeenCalledWith("reprocess_legacy_wiki_check_reviews");
  });

  it("returns a server error when the database reprocessor fails", async () => {
    routeMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "database failure" },
    });

    const response = await postReprocess();

    expect(response.status).toBe(500);
  });
});
