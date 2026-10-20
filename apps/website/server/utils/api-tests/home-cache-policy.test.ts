import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  setHeader,
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
import { NO_STORE_CACHE_CONTROL } from "../cache/http";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  getTopContributors: vi.fn(),
}));

vi.mock("../../utils/db/client", () => ({
  useSupabaseAdmin: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

vi.mock("../../utils/db/queries", () => ({
  getTopContributors: mocks.getTopContributors,
}));

let recentVoiceActorsHandler: EventHandler;
let topVoiceActorsHandler: EventHandler;
let trendingVoiceActorsHandler: EventHandler;
let topContributorsHandler: EventHandler;
let homeStatsHandler: EventHandler;

type MockQueryResult = { data: unknown[]; error: null; count: number };
type MockQueryBuilder = Promise<MockQueryResult> & {
  select: () => MockQueryBuilder;
  order: () => MockQueryBuilder;
  limit: () => Promise<MockQueryResult>;
};

function createQueryBuilder(result: MockQueryResult): MockQueryBuilder {
  return Object.assign(Promise.resolve(result), {
    select: () => createQueryBuilder(result),
    order: () => createQueryBuilder(result),
    limit: () => Promise.resolve(result),
  });
}

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);

  recentVoiceActorsHandler = (
    await import("../../api/recent-voice-actors.get")
  ).default;
  topVoiceActorsHandler = (await import("../../api/top-voice-actors.get")).default;
  trendingVoiceActorsHandler = (
    await import("../../api/trending/voice-actors.get")
  ).default;
  topContributorsHandler = (
    await import("../../api/top-contributors.get")
  ).default;
  homeStatsHandler = (await import("../../api/home-stats.get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  const result: MockQueryResult = { data: [], error: null, count: 0 };
  mocks.from.mockImplementation(() => createQueryBuilder(result));
  mocks.rpc.mockResolvedValue(result);
  mocks.getTopContributors.mockResolvedValue([]);
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

describe("homepage cache policy", () => {
  it.each([
    ["recent voice actors", () => recentVoiceActorsHandler],
    ["top voice actors", () => topVoiceActorsHandler],
    ["trending voice actors", () => trendingVoiceActorsHandler],
    ["top contributors", () => topContributorsHandler],
    ["database stats", () => homeStatsHandler],
  ] as const)(
    "keeps Supabase-backed %s responses no-store",
    async (_name, getHandler) => {
      const response = await request(getHandler());

      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe(
        NO_STORE_CACHE_CONTROL,
      );
      expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
    },
  );

  it("keeps server-rendered homepage HTML no-store", async () => {
    const app = createApp();
    app.use("/", cacheHeadersMiddleware);
    app.use(
      "/",
      defineEventHandler((event) => {
        setHeader(event, "Content-Type", "text/html; charset=utf-8");
        return "<!doctype html><html><body>Home</body></html>";
      }),
    );

    const response = await toWebHandler(app)(new Request("http://localhost/"));

    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe(NO_STORE_CACHE_CONTROL);
    expect(response.headers.has("cloudflare-cdn-cache-control")).toBe(false);
  });
});
