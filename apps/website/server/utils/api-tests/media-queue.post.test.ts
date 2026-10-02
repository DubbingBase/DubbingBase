import {
  createApp,
  createError,
  defineEventHandler,
  readBody,
  toWebHandler,
} from "h3";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const routeMocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
  sendDiscordAdminNotification: vi.fn(),
}));

vi.mock("../auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../db/client", () => ({
  useSupabaseAdmin: () => ({ rpc: routeMocks.rpc }),
}));
vi.mock("../notifications/discord", () => ({
  sendDiscordAdminNotification: routeMocks.sendDiscordAdminNotification,
}));
let handler: typeof import("../../api/media-queue.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("../../api/media-queue.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.requireUser.mockReturnValue({ id: "user-u1" });
  routeMocks.rpc.mockResolvedValue({ data: null, error: null });
  routeMocks.sendDiscordAdminNotification.mockResolvedValue(undefined);
});

afterAll(() => vi.unstubAllGlobals());

async function post(body: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/media-queue", () => {
  it("uses the authenticated user as requested_by instead of a body-supplied identity", async () => {
    const response = await post({
      action: "enqueue",
      mediaType: "video_game",
      mediaId: 42,
      wikipedia_language: "simple",
      dubbing_language: "en-US",
      requested_by: "user-u2",
    });

    expect(response.status).toBe(200);
    expect(routeMocks.rpc).toHaveBeenCalledWith("enqueue_media_fetch", {
      p_media_type: "video_game",
      p_tmdb_id: 42,
      p_season_number: undefined,
      p_episode_number: undefined,
      p_language: "simple",
      p_wikipedia_language: "simple",
      p_dubbing_language: "en-US",
      p_is_manual: true,
      p_requested_by: "user-u1",
    });
  });

  it("rejects anonymous manual enqueue before writing to the queue", async () => {
    routeMocks.requireUser.mockImplementation(() => {
      throw createError({ statusCode: 401, message: "Unauthorized" });
    });

    const response = await post({
      action: "enqueue",
      mediaType: "video_game",
      mediaId: 42,
      wikipedia_language: "simple",
    });

    expect(response.status).toBe(401);
    expect(routeMocks.rpc).not.toHaveBeenCalled();
  });
});
