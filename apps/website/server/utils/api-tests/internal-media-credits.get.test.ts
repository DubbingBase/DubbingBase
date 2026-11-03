import {
  createApp,
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeader,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  fetchMediaCredits: vi.fn(),
  useTmdbClient: vi.fn(),
  useIgdbClient: vi.fn(),
}));

vi.mock("../../utils", () => ({
  useTmdbClient: routeMocks.useTmdbClient,
  useIgdbClient: routeMocks.useIgdbClient,
}));
vi.mock("../../utils/api/igdb", () => ({ buildIgdbImageUrl: vi.fn() }));
vi.mock("../../utils/game-characters", () => ({ loadGameCharacterCatalog: vi.fn() }));

let handler: typeof import("../../api/internal-media-credits.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("getRequestHeader", getRequestHeader);
  handler = (await import("../../api/internal-media-credits.get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.fetchMediaCredits.mockResolvedValue({ cast: [] });
  routeMocks.useTmdbClient.mockReturnValue({ fetchMediaCredits: routeMocks.fetchMediaCredits });
});

afterAll(() => vi.unstubAllGlobals());

async function getCredits(acceptLanguage?: string): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return toWebHandler(app)(
    new Request("http://localhost/?media_type=movie&media_id=42", {
      headers: acceptLanguage ? { "accept-language": acceptLanguage } : {},
    }),
  );
}

describe("GET /api/internal-media-credits", () => {
  it("uses the supported locale from Accept-Language for TMDB credits", async () => {
    const response = await getCredits("ja-JP,ja;q=0.9,en;q=0.8");

    expect(response.status).toBe(200);
    expect(routeMocks.fetchMediaCredits).toHaveBeenCalledWith("movie", 42, "ja-JP");
  });

  it("uses the application default when Accept-Language is unsupported", async () => {
    const response = await getCredits("de-DE,de;q=0.9");

    expect(response.status).toBe(200);
    expect(routeMocks.fetchMediaCredits).toHaveBeenCalledWith("movie", 42, "en-US");
  });
});
