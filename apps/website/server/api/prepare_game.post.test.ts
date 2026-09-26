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
  prepareGame: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("../utils/auth", () => ({ requireUser: routeMocks.requireUser }));
vi.mock("../utils/services/media-preparation", () => ({
  prepareGame: routeMocks.prepareGame,
}));

let handler: typeof import("./prepare_game.post").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("readBody", readBody);
  handler = (await import("./prepare_game.post")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => vi.unstubAllGlobals());

async function postPayload(payload: unknown): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return await toWebHandler(app)(
    new Request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
}

describe("POST /api/prepare_game", () => {
  it.each([
    ["missing Wikipedia source", { igdbId: 42, dubbing_language: "fr-FR" }],
    [
      "invalid Wikipedia source",
      { igdbId: 42, wikipedia_language: "FR-fr", dubbing_language: "fr-FR" },
    ],
    ["missing dubbing region", { igdbId: 42, wikipedia_language: "simple" }],
    [
      "unregistered dubbing region",
      { igdbId: 42, wikipedia_language: "simple", dubbing_language: "fr" },
    ],
  ])("rejects %s with HTTP 400", async (_label, payload) => {
    const response = await postPayload(payload);

    expect(response.status).toBe(400);
    expect(routeMocks.prepareGame).not.toHaveBeenCalled();
  });

  it("passes distinct source and regional target values to extraction", async () => {
    routeMocks.prepareGame.mockResolvedValue({ ok: true, creditsAdded: 3 });

    const response = await postPayload({
      igdbId: 42,
      wikipedia_language: "simple",
      dubbing_language: "en-US",
    });

    expect(response.status).toBe(200);
    expect(routeMocks.prepareGame).toHaveBeenCalledWith({
      igdbId: 42,
      wikipediaLanguage: "simple",
      dubbingLanguage: "en-US",
    });
  });
});
