import { createApp, defineEventHandler, getQuery, getRouterParam, toWebHandler } from "h3";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGame: vi.fn(),
  getGameCharacters: vi.fn(),
  getDubbingProjects: vi.fn(),
  getGamePageDubbingProjects: vi.fn(),
}));

vi.mock("../index", () => ({
  useIgdbClient: () => ({
    getGame: mocks.getGame,
    getGameCharacters: mocks.getGameCharacters,
  }),
}));
vi.mock("../db/queries", () => ({
  getDubbingProjects: mocks.getDubbingProjects,
  getGamePageDubbingProjects: mocks.getGamePageDubbingProjects,
}));
vi.mock("../db/client", () => ({ useSupabaseAdmin: vi.fn() }));
vi.mock("../notifications/discord", () => ({
  sendDiscordAdminNotification: vi.fn(),
}));
vi.mock("../background", () => ({ scheduleBackgroundTask: vi.fn() }));

let handler: typeof import("../../api/game/[id].get").default;

beforeEach(async () => {
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("getRouterParam", getRouterParam);
  vi.clearAllMocks();
  mocks.getGame.mockResolvedValue({ id: 1942, name: "Test game" });
  mocks.getGameCharacters.mockResolvedValue([]);
  mocks.getDubbingProjects.mockResolvedValue([]);
  mocks.getGamePageDubbingProjects.mockResolvedValue([]);
  handler = (await import("../../api/game/[id].get")).default;
});

afterAll(() => vi.unstubAllGlobals());

async function request(path = "/api/game/1942"): Promise<Response> {
  const app = createApp();
  app.use(
    defineEventHandler((event) => {
      event.context.params = { id: path.split("/").at(-1) || "" };
      return handler(event);
    }),
  );
  return await toWebHandler(app)(new Request(`http://localhost${path}`));
}

describe("GET /api/game/:id", () => {
  it("returns 404 for a missing game and 502 for an IGDB failure", async () => {
    mocks.getGame.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(404);

    mocks.getGame.mockRejectedValueOnce(new Error("IGDB API error: 503 unavailable"));
    expect((await request()).status).toBe(502);
  });
});
