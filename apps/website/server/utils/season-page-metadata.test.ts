import { createApp, createError, defineEventHandler, getHeader, getQuery, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  tmdbGet: vi.fn(),
  getSeason: vi.fn(),
  getDubbingProjects: vi.fn(),
  getMediaPageDubbingProjects: vi.fn(),
  getDubbingProjectsForMediaEndpoint: vi.fn(),
  cacheGetOrFetch: vi.fn(),
}));

vi.mock("./index", () => ({
  useCache: () => ({ getOrFetch: routeMocks.cacheGetOrFetch }),
  useTmdbClient: () => ({ get: routeMocks.tmdbGet }),
}));
vi.mock("./services/media", () => ({
  MediaService: class {
    getMediaWithVoiceActorsExtended(...args: unknown[]) {
      return routeMocks.getSeason(...args);
    }
  },
}));
vi.mock("./db/queries", () => ({
  getDubbingProjects: routeMocks.getDubbingProjects,
  getMediaPageDubbingProjects: routeMocks.getMediaPageDubbingProjects,
  getDubbingProjectsForMediaEndpoint: routeMocks.getDubbingProjectsForMediaEndpoint,
}));
vi.mock("./media-request", () => ({
  parseSeasonQuery: () => ({ id: 42, seasonNumber: 2 }),
  withMediaServiceTimeout: (request: () => Promise<unknown>) => request(),
}));
vi.mock("./with-timeout", () => ({
  withTimeout: (request: Promise<unknown>) => request,
}));
vi.mock("./cache/constants", () => ({
  buildCacheKey: () => "season-test-key",
}));
vi.mock("./cache", () => ({ createCacheNamespace: () => ({}) }));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

let handler: typeof import("../api/season/index.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../api/season/index.get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.tmdbGet.mockResolvedValue({
    id: 42,
    name: "Sample Series",
    backdrop_path: "/backdrop.jpg",
    poster_path: "/poster.jpg",
    credits: { cast: [{ name: "Not returned" }] },
  });
  routeMocks.getSeason.mockResolvedValue({
    media: { id: 42, season_number: 2, name: "Season 2" },
  });
  routeMocks.getDubbingProjects.mockResolvedValue([
    {
      id: 7,
      content_id: 42,
      content_type: "tv",
      language: "fr-FR",
      studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/logo.png" },
      works: [
        {
          id: 12,
          actor_id: 99,
          character_name: "Character",
          performance: "Role",
          note: "Note",
          voice_actor: {
            id: 5,
            firstname: "Voice",
            lastname: "Actor",
            profile_picture: "https://example.com/voice.png",
            tmdb_id: 8,
          },
        },
      ],
      crew: [{ id: 20, person_id: 5, job_id: 2, job: { name: "Director" } }],
    },
  ]);
  routeMocks.getMediaPageDubbingProjects.mockResolvedValue([
    {
      id: 7,
      language: "fr-FR",
      studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/logo.png" },
      works: [
        {
          id: 12,
          actor_id: 99,
          character_name: "Character",
          performance: "Role",
          note: "Note",
          voice_actor: {
            id: 5,
            firstname: "Voice",
            lastname: "Actor",
            profile_picture: "https://example.com/voice.png",
          },
        },
      ],
      crew: [],
    },
  ]);
  routeMocks.getDubbingProjectsForMediaEndpoint.mockImplementation(
    (id: number, type: string, projection: unknown) =>
      projection === "media-page"
        ? routeMocks.getMediaPageDubbingProjects(id, type)
        : routeMocks.getDubbingProjects(id, type),
  );
  routeMocks.cacheGetOrFetch.mockResolvedValue(null);
});

afterAll(() => vi.unstubAllGlobals());

describe("GET /api/season parent metadata", () => {
  it("returns only lightweight parent fields alongside the existing season payload", async () => {
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => handler(event)),
    );
    const response = await toWebHandler(app)(
      new Request("http://localhost/?id=42&season_number=2", {
        headers: { "accept-language": "fr-FR" },
      }),
    );
    const responseBody: unknown = await response.json();
    if (!isRecord(responseBody) || !isRecord(responseBody.serie)) {
      throw new Error("Season response did not include parent series metadata");
    }
    const body = responseBody;

    expect(body).toMatchObject({
      season: { id: 42, season_number: 2, name: "Season 2" },
      serie: {
        id: 42,
        name: "Sample Series",
        backdrop_path: "/backdrop.jpg",
        poster_path: "/poster.jpg",
      },
      dubbingProjects: [
        {
          id: 7,
          content_id: 42,
          content_type: "tv",
          language: "fr-FR",
          studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/logo.png" },
          works: [
            {
              id: 12,
              actor_id: 99,
              character_name: "Character",
              performance: "Role",
              note: "Note",
              voice_actor: {
                id: 5,
                firstname: "Voice",
                lastname: "Actor",
                profile_picture: "https://example.com/voice.png",
                tmdb_id: 8,
              },
            },
          ],
          crew: [{ id: 20, person_id: 5, job_id: 2, job: { name: "Director" } }],
        },
      ],
    });
    expect(body.serie).not.toHaveProperty("credits");
    expect(routeMocks.tmdbGet).toHaveBeenCalledTimes(1);
    expect(routeMocks.tmdbGet).toHaveBeenCalledWith("tv/42", undefined, "fr-FR");
    expect(routeMocks.getSeason).toHaveBeenCalledTimes(1);
    expect(routeMocks.getSeason).toHaveBeenCalledWith("season", 42, 2);
    expect(routeMocks.getDubbingProjectsForMediaEndpoint).toHaveBeenCalledTimes(1);
    expect(routeMocks.getDubbingProjectsForMediaEndpoint).toHaveBeenCalledWith(42, "tv", undefined);
    expect(routeMocks.getDubbingProjects).toHaveBeenCalledWith(42, "tv");
  });

  it("uses compact project fields only when the page projection is requested", async () => {
    const app = createApp();
    app.use(
      "/",
      defineEventHandler((event) => handler(event)),
    );
    const response = await toWebHandler(app)(
      new Request("http://localhost/?id=42&season_number=2&projection=media-page"),
    );
    const responseBody: unknown = await response.json();
    if (!isRecord(responseBody) || !Array.isArray(responseBody.dubbingProjects)) {
      throw new Error("Season response did not include dubbing projects");
    }

    expect(responseBody.dubbingProjects).toMatchObject([
      {
        id: 7,
        language: "fr-FR",
        studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/logo.png" },
        works: [
          {
            id: 12,
            actor_id: 99,
            character_name: "Character",
            voice_actor: {
              id: 5,
              firstname: "Voice",
              profile_picture: "https://example.com/voice.png",
            },
          },
        ],
        crew: [],
      },
    ]);
    expect(routeMocks.getDubbingProjectsForMediaEndpoint).toHaveBeenCalledWith(
      42,
      "tv",
      "media-page",
    );
    expect(routeMocks.getMediaPageDubbingProjects).toHaveBeenCalledWith(42, "tv");
    expect(routeMocks.getDubbingProjects).not.toHaveBeenCalled();
  });
});
