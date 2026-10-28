import { createApp, createError, defineEventHandler, getHeader, getQuery, toWebHandler } from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getMedia: vi.fn(),
  cacheGetOrFetch: vi.fn(),
  getDubbingProjects: vi.fn(),
  getMediaPageDubbingProjects: vi.fn(),
  getDubbingProjectsForMediaEndpoint: vi.fn(),
}));

vi.mock("./index", () => ({
  useCache: () => ({ getOrFetch: routeMocks.cacheGetOrFetch }),
  useTmdbClient: () => ({}),
}));
vi.mock("./services/media", () => ({
  MediaService: class {
    getMediaWithVoiceActorsExtended(...args: unknown[]) {
      return routeMocks.getMedia(...args);
    }
  },
}));
vi.mock("./db/queries", () => ({
  getDubbingProjectsForMediaEndpoint: routeMocks.getDubbingProjectsForMediaEndpoint,
}));
vi.mock("./media-request", () => ({
  parseEpisodeQuery: () => ({ id: 42, seasonNumber: 2, episodeNumber: 3 }),
  withMediaServiceTimeout: (request: () => Promise<unknown>) => request(),
}));
vi.mock("./with-timeout", () => ({
  withTimeout: (request: Promise<unknown>) => request,
}));
vi.mock("./cache/constants", () => ({ buildCacheKey: () => "episode-test-key" }));
vi.mock("./cache", () => ({ createCacheNamespace: () => ({}) }));

let handler: typeof import("../api/episode/index.get").default;

beforeAll(async () => {
  vi.stubGlobal("createError", createError);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  handler = (await import("../api/episode/index.get")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  routeMocks.getMedia.mockResolvedValue({
    media: { id: 42, episode_number: 3, name: "Episode 3" },
  });
  routeMocks.cacheGetOrFetch.mockResolvedValue(null);
  routeMocks.getDubbingProjects.mockResolvedValue([
    {
      id: 7,
      content_id: 42,
      content_type: "tv",
      language: "fr-FR",
      studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/studio.png" },
      works: [
        {
          id: 12,
          actor_id: 55,
          character_name: "Character",
          performance: "Lead",
          note: "Voice note",
          voice_actor: {
            id: 5,
            firstname: "Voice",
            lastname: "Actor",
            profile_picture: "https://example.com/voice.png",
            tmdb_id: 88,
          },
        },
      ],
      crew: [{ id: 20, person_id: 6, job_id: 2, job: { name: "Director" } }],
    },
  ]);
  routeMocks.getMediaPageDubbingProjects.mockResolvedValue([
    {
      id: 7,
      language: "fr-FR",
      studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/studio.png" },
      works: [
        {
          id: 12,
          actor_id: 55,
          character_name: "Character",
          performance: "Lead",
          note: "Voice note",
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
});

afterAll(() => vi.unstubAllGlobals());

async function requestEpisode(search: string): Promise<unknown> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  const response = await toWebHandler(app)(
    new Request(`http://localhost/?id=42&season_number=2&episode_number=3${search}`),
  );
  return await response.json();
}

describe("GET /api/episode dubbing project response", () => {
  it("retains full project, voice-actor and crew fields for default callers", async () => {
    const response = await requestEpisode("");

    expect(response).toMatchObject({
      episode: { id: 42, episode_number: 3, name: "Episode 3" },
      dubbingProjects: [
        {
          id: 7,
          content_id: 42,
          content_type: "tv",
          language: "fr-FR",
          studio_data: { id: 3, name: "Studio" },
          works: [
            {
              id: 12,
              actor_id: 55,
              voice_actor: { id: 5, tmdb_id: 88, profile_picture: "https://example.com/voice.png" },
            },
          ],
          crew: [{ id: 20, person_id: 6, job_id: 2 }],
        },
      ],
    });
    expect(routeMocks.getDubbingProjectsForMediaEndpoint).toHaveBeenCalledWith(42, "tv", undefined);
    expect(routeMocks.getDubbingProjects).toHaveBeenCalledWith(42, "tv");
  });

  it("returns the compact studio and cast fields for an explicit media-page request", async () => {
    const response = await requestEpisode("&projection=media-page");

    expect(response).toMatchObject({
      dubbingProjects: [
        {
          id: 7,
          language: "fr-FR",
          studio_data: { id: 3, name: "Studio", logo_url: "https://example.com/studio.png" },
          works: [
            {
              id: 12,
              actor_id: 55,
              character_name: "Character",
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
      ],
    });
    expect(routeMocks.getDubbingProjectsForMediaEndpoint).toHaveBeenCalledWith(
      42,
      "tv",
      "media-page",
    );
    expect(routeMocks.getMedia).toHaveBeenCalledWith(
      "episode",
      42,
      2,
      3,
      { projection: "media-page" },
    );
    expect(routeMocks.getMediaPageDubbingProjects).toHaveBeenCalledWith(42, "tv");
    expect(routeMocks.getDubbingProjects).not.toHaveBeenCalled();
  });
});
