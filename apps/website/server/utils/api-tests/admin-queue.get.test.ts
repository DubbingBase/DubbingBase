import { createApp, createError, defineEventHandler, getQuery, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("../auth", () => ({ requireAdmin: routeMocks.requireAdmin }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({ rpc: routeMocks.rpc }),
}));

let handler: typeof import("../../api/admin/queue.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../../api/admin/queue.get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireAdmin.mockReturnValue({ id: "admin-u1" });
  routeMocks.rpc.mockResolvedValue({ data: [], error: null });
});

afterAll(() => vi.unstubAllGlobals());

async function getQueue(query: string): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(new Request(`http://localhost/${query}`));
}

describe("GET /api/admin/queue", () => {
  it("returns 401 when the caller is unauthenticated", async () => {
    routeMocks.requireAdmin.mockImplementation(() => {
      throw createError({ statusCode: 401, message: "Unauthorized" });
    });

    const response = await getQueue("?");

    expect(response.status).toBe(401);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is authenticated but not an admin", async () => {
    routeMocks.requireAdmin.mockImplementation(() => {
      throw createError({ statusCode: 403, message: "Admin access required" });
    });

    const response = await getQueue("?");

    expect(response.status).toBe(403);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });

  it("uses the normal queue RPC for other statuses and forwards queue, status, limit, and offset", async () => {
    const row = {
      id: 73,
      queue_name: "wiki_check",
      tmdb_id: 211289,
      media_type: "movie",
      language: "fr",
      wikipedia_language: "fr",
      dubbing_language: "fr-FR",
      season_number: null,
      episode_number: null,
      status: "pending",
      error_message: null,
      created_at: "2026-09-28T12:01:00.000Z",
      read_ct: 0,
      is_manual: true,
      requested_by: "user-u2",
    };
    routeMocks.rpc.mockResolvedValue({ data: [row], error: null });

    const response = await getQueue("?queue=wiki_check&status=pending&limit=25&offset=5");

    expect(response.status).toBe(200);
    const body: unknown = await response.json();
    expect(body).toMatchObject({ items: [row], stats: expect.any(Object) });
    expect(routeMocks.rpc).toHaveBeenCalledWith("get_media_queue_items", {
      p_queue_name: "wiki_check",
      p_status: "pending",
      p_limit: 25,
      p_offset: 5,
    });
  });

  it.each(["active", "archived"] as const)(
    "accepts the %s filter used by the admin queue UI",
    async (status) => {
      const response = await getQueue(`?status=${status}`);

      expect(response.status).toBe(200);
      expect(routeMocks.rpc).toHaveBeenCalledWith(
        "get_media_queue_items",
        expect.objectContaining({ p_status: status }),
      );
    },
  );

  it.each(["unknown", "review_needed"])("returns 400 for unsupported status %s", async (status) => {
    const response = await getQueue(`?status=${status}`);

    expect(response.status).toBe(400);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });
});
