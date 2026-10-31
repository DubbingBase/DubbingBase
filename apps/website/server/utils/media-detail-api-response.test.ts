import { createApp, defineEventHandler, getHeader, getQuery, toWebHandler } from "h3";
import type { H3Event } from "h3";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  matchCastWorks,
  type CastActorReference,
  type CastWorkReference,
} from "../../src/utils/media-cast";

const apiMocks = vi.hoisted(() => ({
  getMediaWithVoiceActors: vi.fn(),
  getCharacterProfilePictures: vi.fn(),
  fetchMediaCredits: vi.fn(),
  getDubbingProjects: vi.fn(),
  getMediaPageDubbingProjects: vi.fn(),
  getDubbingProjectsForMediaEndpoint: vi.fn(),
}));

vi.mock("./index", () => ({
  useTmdbClient: () => ({ fetchMediaCredits: apiMocks.fetchMediaCredits }),
}));

vi.mock("./services/media", () => ({
  MediaService: class {
    getMediaWithVoiceActors(...args: unknown[]) {
      return apiMocks.getMediaWithVoiceActors(...args);
    }

    getCharacterProfilePictures(...args: unknown[]) {
      return apiMocks.getCharacterProfilePictures(...args);
    }
  },
}));

vi.mock("./db/queries", () => ({
  getDubbingProjectsForMediaEndpoint: apiMocks.getDubbingProjectsForMediaEndpoint,
}));

vi.mock("./urls/tmdb", () => ({ processMedia: (media: unknown) => media }));
vi.mock("./db/client", () => ({ useSupabaseAdmin: vi.fn() }));
vi.mock("./notifications/discord", () => ({
  sendDiscordAdminNotification: vi.fn(),
}));
vi.mock("./background", () => ({ scheduleBackgroundTask: vi.fn() }));

const fullMovieProject = {
  id: 7,
  content_id: 123,
  content_type: "movie",
  language: "fr-FR",
  extra: "legacy project metadata",
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
        voice_actor_name: "Voice Actor",
        tmdb_id: 88,
        bio: "Actor metadata",
      },
    },
  ],
  crew: [
    {
      id: 20,
      person_id: 6,
      job_id: 2,
      job: { id: 2, name: "Director" },
      person: {
        id: 6,
        firstname: "Staff",
        lastname: "Member",
        profile_picture: "https://example.com/staff.png",
      },
    },
  ],
};

const compactMovieProject = {
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
        voice_actor_name: "Voice Actor",
      },
    },
  ],
  crew: [],
};

const fullShowProject = { ...fullMovieProject, content_type: "tv" };

let fetchMovieData: (event: H3Event, movieId: number) => Promise<unknown>;
let fetchShowData: (event: H3Event, showId: number) => Promise<unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  apiMocks.getDubbingProjects.mockResolvedValue([fullMovieProject]);
  apiMocks.getMediaPageDubbingProjects.mockResolvedValue([compactMovieProject]);
  apiMocks.getDubbingProjectsForMediaEndpoint.mockImplementation(
    (contentId: number, contentType: string, projection: unknown) =>
      projection === "media-page"
        ? apiMocks.getMediaPageDubbingProjects(contentId, contentType)
        : apiMocks.getDubbingProjects(contentId, contentType),
  );
  apiMocks.getMediaWithVoiceActors.mockResolvedValue({
    media: {
      id: 123,
      title: "Movie",
      external_ids: {},
      credits: {
        cast: [
          {
            id: 55,
            name: "Original Actor",
            character: "Character",
            profile_path: "https://example.com/original.png",
          },
        ],
      },
    },
    collection: null,
  });
  apiMocks.getCharacterProfilePictures.mockResolvedValue({
    characters: [],
    tvdbId: null,
  });
  apiMocks.fetchMediaCredits.mockResolvedValue({
    cast: [
      {
        id: 55,
        name: "Aggregate Actor",
        original_name: "Aggregate Actor Original",
        character: "Character",
        profile_path: "https://example.com/actor.png",
        popularity: 100,
        roles: [{ character: "Character", episode_count: 4, credit_id: "provider-credit" }],
      },
    ],
    crew: [{ id: 99, jobs: [{ job: "Director", episode_count: 40 }] }],
  });
});

afterAll(() => vi.unstubAllGlobals());

async function requestRouteData(
  handler: (event: H3Event) => Promise<unknown>,
  search = "",
): Promise<unknown> {
  const response = await requestRouteResponse(handler, search);
  return await response.json();
}

async function requestRouteResponse(
  handler: (event: H3Event) => Promise<unknown>,
  search = "",
): Promise<Response> {
  const app = createApp();
  app.use(
    "/",
    defineEventHandler((event) => handler(event)),
  );
  return await toWebHandler(app)(new Request(`http://localhost/${search}`));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCastActorReference(value: unknown): value is CastActorReference {
  return isRecord(value) && typeof value.id === "number";
}

function isCastWorkReference(value: unknown): value is CastWorkReference {
  return (
    isRecord(value) &&
    typeof value.id === "number" &&
    (value.actor_id === null ||
      typeof value.actor_id === "number" ||
      typeof value.actor_id === "string")
  );
}

describe("movie and show detail API payload compatibility", () => {
  beforeEach(async () => {
    const movieModule = await import("../api/movie/[id].get");
    const showModule = await import("../api/show/[id].get");
    fetchMovieData = movieModule.fetchMovieData;
    fetchShowData = showModule.fetchShowData;
  });

  it("keeps the full movie response contract by default", async () => {
    const response: unknown = await requestRouteData((event) => fetchMovieData(event, 123));

    expect(response).toMatchObject({
      movie: {
        id: 123,
        credits: { cast: [{ id: 55, name: "Original Actor" }] },
      },
      dubbingProjects: [
        {
          id: 7,
          content_id: 123,
          extra: "legacy project metadata",
          studio_data: { id: 3, name: "Studio" },
          works: [
            {
              id: 12,
              actor_id: 55,
              voice_actor: {
                id: 5,
                tmdb_id: 88,
                bio: "Actor metadata",
              },
            },
          ],
          crew: [{ id: 20, person_id: 6, job_id: 2 }],
        },
      ],
    });
    expect(apiMocks.getDubbingProjectsForMediaEndpoint).toHaveBeenCalledWith(
      123,
      "movie",
      undefined,
    );
    expect(apiMocks.getDubbingProjects).toHaveBeenCalledWith(123, "movie");
  });

  it("returns 404 for a missing movie and a gateway error for TMDB failures", async () => {
    apiMocks.getMediaWithVoiceActors.mockRejectedValueOnce(new Error("TMDB API error: 404"));
    const missing = await requestRouteResponse((event) => fetchMovieData(event, 123));
    expect(missing.status).toBe(404);

    apiMocks.getMediaWithVoiceActors.mockRejectedValueOnce(new Error("TMDB API error: 503"));
    const upstreamFailure = await requestRouteResponse((event) => fetchMovieData(event, 123));
    expect(upstreamFailure.status).toBe(502);
  });

  it("returns 404 for a missing show and a gateway error for TMDB failures", async () => {
    apiMocks.getMediaWithVoiceActors.mockRejectedValueOnce(new Error("TMDB API error: 404"));
    const missing = await requestRouteResponse((event) => fetchShowData(event, 123));
    expect(missing.status).toBe(404);

    apiMocks.getMediaWithVoiceActors.mockRejectedValueOnce(new Error("TMDB API error: 503"));
    const upstreamFailure = await requestRouteResponse((event) => fetchShowData(event, 123));
    expect(upstreamFailure.status).toBe(502);
  });

  it("keeps page cast, studio and voice-actor rendering fields in the compact movie response", async () => {
    const response: unknown = await requestRouteData(
      (event) => fetchMovieData(event, 123),
      "?projection=media-page",
    );

    expect(response).toMatchObject({
      movie: { credits: { cast: [{ id: 55, character: "Character" }] } },
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
      ],
    });

    if (
      !isRecord(response) ||
      !isRecord(response.movie) ||
      !isRecord(response.movie.credits) ||
      !Array.isArray(response.movie.credits.cast) ||
      !Array.isArray(response.dubbingProjects)
    ) {
      throw new Error("Movie response is missing cast or dubbing projects");
    }
    const castActor = response.movie.credits.cast[0];
    const project = response.dubbingProjects[0];
    if (!isRecord(castActor) || !isRecord(project) || !Array.isArray(project.works)) {
      throw new Error("Movie response contains an invalid cast or project shape");
    }
    const work = project.works[0];
    if (!isCastActorReference(castActor) || !isCastWorkReference(work)) {
      throw new Error("Movie response has no renderable TMDB cast and dubbing work");
    }

    const matches = matchCastWorks([castActor], [work]);
    expect(matches.matches[0]?.works[0]?.voice_actor?.profile_picture).toBe(
      "https://example.com/voice.png",
    );
    expect(work).toMatchObject({ actor_id: 55, voice_actor: { id: 5 } });
    expect(apiMocks.getMediaWithVoiceActors).toHaveBeenCalledWith("movie", 123, {
      includeCollection: false,
      includeCreditsCrew: false,
      projection: "media-page",
    });
    expect(apiMocks.getMediaPageDubbingProjects).toHaveBeenCalledWith(123, "movie");
    expect(apiMocks.getDubbingProjects).not.toHaveBeenCalled();
  });

  it("returns show aggregate credits and keeps the full project contract by default", async () => {
    apiMocks.getDubbingProjects.mockResolvedValue([fullShowProject]);
    apiMocks.getMediaWithVoiceActors.mockResolvedValue({
      media: { id: 123, name: "Show", external_ids: {}, credits: {} },
      collection: null,
    });

    const response: unknown = await requestRouteData((event) => fetchShowData(event, 123));

    expect(response).toMatchObject({
      serie: { id: 123, name: "Show", credits: {} },
      aggregateCredits: {
        cast: [
          {
            id: 55,
            name: "Aggregate Actor",
            original_name: "Aggregate Actor Original",
            roles: [{ character: "Character", episode_count: 4 }],
            popularity: 100,
          },
        ],
        crew: [{ id: 99 }],
      },
      dubbingProjects: [
        {
          id: 7,
          content_id: 123,
          content_type: "tv",
          extra: "legacy project metadata",
          crew: [{ id: 20 }],
        },
      ],
    });
    expect(apiMocks.fetchMediaCredits).toHaveBeenCalledTimes(1);
    expect(apiMocks.fetchMediaCredits).toHaveBeenCalledWith("tv", 123, "fr-FR");
    expect(apiMocks.getDubbingProjects).toHaveBeenCalledWith(123, "tv");
  });

  it("keeps aggregate credits on show responses using the compact page projection", async () => {
    apiMocks.getMediaWithVoiceActors.mockResolvedValue({
      media: { id: 123, name: "Show", external_ids: {}, credits: {} },
      collection: null,
    });

    const response: unknown = await requestRouteData(
      (event) => fetchShowData(event, 123),
      "?projection=media-page",
    );

    expect(response).toMatchObject({
      serie: { id: 123, name: "Show", credits: {} },
      aggregateCredits: {
        cast: [{ id: 55, name: "Aggregate Actor" }],
      },
      dubbingProjects: [
        {
          id: 7,
          language: "fr-FR",
          studio_data: { id: 3, name: "Studio" },
          works: [{ id: 12, actor_id: 55, voice_actor: { id: 5 } }],
          crew: [],
        },
      ],
    });
    expect(apiMocks.fetchMediaCredits).toHaveBeenCalledTimes(1);
    expect(apiMocks.getDubbingProjectsForMediaEndpoint).toHaveBeenCalledWith(
      123,
      "tv",
      "media-page",
    );
    expect(apiMocks.getMediaPageDubbingProjects).toHaveBeenCalledWith(123, "tv");
    expect(response).toMatchObject({
      aggregateCredits: {
        cast: [
          {
            id: 55,
            name: "Aggregate Actor",
            profile_path: "https://example.com/actor.png",
            character: "Character",
            roles: [{ character: "Character", episode_count: 4 }],
          },
        ],
      },
    });
    if (!isRecord(response) || !isRecord(response.aggregateCredits)) {
      throw new Error("Show response is missing aggregate credits");
    }
    expect(response.aggregateCredits).not.toHaveProperty("crew");
    expect(response.aggregateCredits).not.toHaveProperty("cast.0.popularity");
    expect(response.aggregateCredits).not.toHaveProperty("cast.0.original_name");
    expect(response.aggregateCredits).not.toHaveProperty("cast.0.roles.0.credit_id");
  });
});
