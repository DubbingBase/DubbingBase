import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  getRouterParam,
  toWebHandler,
} from "h3";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGame: vi.fn(),
  getGameCharacters: vi.fn(),
  loadGameCharacterCatalog: vi.fn(),
  getDubbingProjects: vi.fn(),
  getGamePageDubbingProjects: vi.fn(),
}));

vi.mock("../index", () => ({
  useIgdbClient: () => ({
    getGame: mocks.getGame,
    getGameCharacters: mocks.getGameCharacters,
  }),
}));
vi.mock("../game-characters", () => ({
  loadGameCharacterCatalog: mocks.loadGameCharacterCatalog,
}));
vi.mock("../media-request", () => ({
  withMediaServiceTimeout: (request: () => Promise<unknown>) => request(),
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
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("getRouterParam", getRouterParam);
  vi.clearAllMocks();
  mocks.getGame.mockResolvedValue({ id: 1942, name: "Test game" });
  mocks.getGameCharacters.mockResolvedValue([]);
  mocks.loadGameCharacterCatalog.mockResolvedValue({
    characters: [],
    providerStatus: "available",
    localStatus: "available",
  });
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
  it("returns 404 when IGDB has no game or local character fallback", async () => {
    mocks.getGame.mockResolvedValueOnce(null);
    expect((await request()).status).toBe(404);
  });

  it("returns 502 when IGDB fails and there is no local character fallback", async () => {
    mocks.getGame.mockRejectedValueOnce(new Error("IGDB API error: 503 unavailable"));

    expect((await request()).status).toBe(502);
  });

  it("keeps local characters available when IGDB is unavailable", async () => {
    mocks.getGame.mockRejectedValueOnce(new Error("IGDB API error: 503 unavailable"));
    mocks.loadGameCharacterCatalog.mockResolvedValueOnce({
      characters: [
        {
          id: null,
          name: "Local character",
          stable_id: "game_character:11111111-1111-4111-8111-111111111111",
          game_character_id: "11111111-1111-4111-8111-111111111111",
          igdb_character_id: null,
          identity_source: "local",
          local_name: "Local character",
          mug_shot: undefined,
        },
      ],
      providerStatus: "unavailable",
      localStatus: "available",
    });

    const response = await request();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.game.name).toContain("Information indisponible");
    expect(data.characters[0]?.game_character_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(data.character_catalog_status).toBe("unavailable");
  });
});
