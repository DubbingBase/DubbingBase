import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  toWebHandler,
  type EventHandler,
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
import cacheHeadersMiddleware from "../../middleware/00-cache-headers";
import { SimpleCache } from "../cache";
import { IgdbClient } from "../api/igdb";
import {
  getCloudflareCacheControl,
  getPublicCacheControl,
  NO_STORE_CACHE_CONTROL,
} from "../cache/http";

const routeMocks = vi.hoisted(() => ({
  getTrending: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  getTrendingGames: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  fetchMediaCredits: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock("../index", () => ({
  useTmdbClient: () => ({
    getTrending: routeMocks.getTrending,
    fetchMediaCredits: routeMocks.fetchMediaCredits,
  }),
  useIgdbClient: () => ({ getTrendingGames: routeMocks.getTrendingGames }),
}));

let trendingMoviesHandler: EventHandler;
let trendingShowsHandler: EventHandler;
let mediaCreditsHandler: EventHandler;
let getTrendingGamesResponse: typeof import("../../api/trending/games.get").getTrendingGamesResponse;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  trendingMoviesHandler = (await import("../../api/trending/movies.get"))
    .default;
  trendingShowsHandler = (await import("../../api/trending/shows.get")).default;
  getTrendingGamesResponse = (await import("../../api/trending/games.get"))
    .getTrendingGamesResponse;
  mediaCreditsHandler = (await import("../../api/get-media-credits.get"))
    .default;
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(() => vi.unstubAllGlobals());

async function request(handler: EventHandler, path = "/"): Promise<Response> {
  const app = createApp();
  app.use("/", cacheHeadersMiddleware);
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(new Request(`http://localhost${path}`));
}

async function requestTrendingGames(
  config: {
    igdbClientId?: string;
    igdbClientSecret?: string;
  },
  getTrendingGames = routeMocks.getTrendingGames,
): Promise<Response> {
  const app = createApp();
  app.use("/", cacheHeadersMiddleware);
  app.use(
    "/",
    defineEventHandler((event) =>
      getTrendingGamesResponse(event, "fr-FR", config, {
        getTrendingGames,
      }),
    ),
  );
  return toWebHandler(app)(new Request("http://localhost/"));
}

function expectNoStore(response: Response): void {
  expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
  expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
}

function expectPublic(
  response: Response,
  profile: "discovery" | "static",
): void {
  expect(response.headers.get("cache-control")).toBe(
    getPublicCacheControl(profile),
  );
  expect(response.headers.get("cloudflare-cdn-cache-control")).toBe(
    getCloudflareCacheControl(profile),
  );
}

describe("provider-only endpoint response caching", () => {
  it.each(["movies", "shows"])(
    "caches successful trending %s responses",
    async (name) => {
      routeMocks.getTrending.mockResolvedValue({
        results: [
          { id: 1, adult: false, backdrop_path: null, poster_path: null },
        ],
      });

      const handler =
        name === "movies" ? trendingMoviesHandler : trendingShowsHandler;
      const response = await request(handler, "/?lang=fr-FR");

      expect(response.status).toBe(200);
      expectPublic(response, "discovery");
    },
  );

  it.each(["movies", "shows"])(
    "keeps malformed trending %s fallback no-store",
    async (name) => {
      routeMocks.getTrending.mockResolvedValue({ results: "invalid" });

      const handler =
        name === "movies" ? trendingMoviesHandler : trendingShowsHandler;
      const response = await request(handler, "/?lang=fr-FR");

      expect(response.status).toBe(200);
      expectNoStore(response);
      await expect(response.json()).resolves.toMatchObject({ results: [] });
    },
  );

  it.each(["movies", "shows"])(
    "keeps invalid trending %s items no-store",
    async (name) => {
      routeMocks.getTrending.mockResolvedValue({
        results: [{ id: "invalid" }],
      });

      const handler =
        name === "movies" ? trendingMoviesHandler : trendingShowsHandler;
      const response = await request(handler, "/?lang=fr-FR");

      expect(response.status).toBe(200);
      expectNoStore(response);
      await expect(response.json()).resolves.toMatchObject({ results: [] });
    },
  );

  it("keeps unsupported trending languages no-store", async () => {
    const response = await request(trendingMoviesHandler, "/?lang=zz-ZZ");

    expect(response.status).toBe(400);
    expectNoStore(response);
    expect(routeMocks.getTrending).not.toHaveBeenCalled();
  });

  it.each(["movies", "shows"])(
    "keeps failed trending %s requests no-store",
    async (name) => {
      routeMocks.getTrending.mockRejectedValue(new Error("provider failed"));

      const handler =
        name === "movies" ? trendingMoviesHandler : trendingShowsHandler;
      const response = await request(handler, "/?lang=fr-FR");

      expect(response.status).toBe(500);
      expectNoStore(response);
    },
  );

  it("keeps the missing-credentials games fallback no-store", async () => {
    const response = await requestTrendingGames({
      igdbClientId: "",
      igdbClientSecret: "",
    });

    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual([]);
  });

  it("caches successful trending games and keeps provider failures no-store", async () => {
    const config = {
      igdbClientId: "client",
      igdbClientSecret: "secret",
    };
    routeMocks.getTrendingGames.mockResolvedValue({
      games: [],
      degraded: false,
    });

    const success = await requestTrendingGames(config);
    expect(routeMocks.getTrendingGames).toHaveBeenCalledTimes(1);
    expectPublic(success, "discovery");

    routeMocks.getTrendingGames.mockRejectedValue(new Error("provider failed"));
    const failure = await requestTrendingGames(config);
    expect(failure.status).toBe(200);
    expectNoStore(failure);

    routeMocks.getTrendingGames.mockResolvedValue({
      games: [null],
      degraded: false,
    });
    const invalid = await requestTrendingGames(config);
    expect(invalid.status).toBe(200);
    expectNoStore(invalid);
    await expect(invalid.json()).resolves.toEqual([]);
  });

  it("keeps base IGDB games no-store when localization lookup fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://id.twitch.tv/oauth2/token") {
        return new Response(
          JSON.stringify({ access_token: "token", expires_in: 7200 }),
        );
      }
      if (url.endsWith("/popularity_primitives")) {
        return new Response(
          JSON.stringify([{ game_id: 42, popularity_type: 1, value: 100 }]),
        );
      }
      if (url.endsWith("/games")) {
        return new Response(JSON.stringify([{ id: 42, name: "Base Name" }]));
      }
      if (url.endsWith("/game_localizations")) {
        return new Response("localization unavailable", { status: 503 });
      }
      throw new Error(`Unexpected IGDB request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("useRuntimeConfig", () => ({
      igdbClientId: "client",
      igdbClientSecret: "secret",
    }));

    const client = new IgdbClient(new SimpleCache(() => null));
    const response = await requestTrendingGames(
      { igdbClientId: "client", igdbClientSecret: "secret" },
      (limit, language) => client.getTrendingGames(limit, language),
    );

    expect(response.status).toBe(200);
    expectNoStore(response);
    await expect(response.json()).resolves.toEqual([
      { id: 42, name: "Base Name", media_type: "video_game" },
    ]);
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/popularity_primitives"),
        expect.stringContaining("/games"),
        expect.stringContaining("/game_localizations"),
      ]),
    );
  });

  it("caches successful provider credits and keeps invalid or failed requests no-store", async () => {
    routeMocks.fetchMediaCredits.mockResolvedValue({ cast: [] });

    const success = await request(
      mediaCreditsHandler,
      "/?media_type=movie&media_id=42",
    );
    expectPublic(success, "static");

    const invalid = await request(
      mediaCreditsHandler,
      "/?media_type=video_game&media_id=42",
    );
    expect(invalid.status).toBe(400);
    expectNoStore(invalid);

    routeMocks.fetchMediaCredits.mockResolvedValue({ cast: "invalid" });
    const invalidPayload = await request(
      mediaCreditsHandler,
      "/?media_type=movie&media_id=42",
    );
    expect(invalidPayload.status).toBe(502);
    expectNoStore(invalidPayload);

    routeMocks.fetchMediaCredits.mockRejectedValue(
      new Error("provider failed"),
    );
    const failure = await request(
      mediaCreditsHandler,
      "/?media_type=movie&media_id=42",
    );
    expect(failure.status).toBe(500);
    expectNoStore(failure);
  });
});
