import {
  createApp,
  createError,
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParam,
  toWebHandler,
} from "h3";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPersonWithCredits: vi.fn(),
  fetchMediaSummary: vi.fn(),
  getWorkByActor: vi.fn(),
}));

vi.mock("./index", () => ({ useTmdbClient: () => mocks }));
vi.mock("./db/queries", () => ({ getWorkByActor: mocks.getWorkByActor }));

let handler: typeof import("../api/actor/[id].get").default;

beforeAll(async () => {
  vi.stubGlobal("defineEventHandler", defineEventHandler);
  vi.stubGlobal("getRouterParam", getRouterParam);
  vi.stubGlobal("getHeader", getHeader);
  vi.stubGlobal("getQuery", getQuery);
  vi.stubGlobal("createError", createError);
  handler = (await import("../api/actor/[id].get")).default;
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPersonWithCredits.mockResolvedValue({
    id: 31,
    name: "Actor",
    biography: "Biography",
    birthday: "1970-01-01",
    deathday: null,
    place_of_birth: "City",
    profile_path: "/actor.png",
    known_for_department: "Acting",
    external_ids: { imdb_id: "provider-id" },
    movie_credits: {
      cast: [
        {
          id: 10,
          title: "Movie",
          character: "Lead",
          poster_path: "/movie.png",
          release_date: "2020-01-01",
          overview: "Unused synopsis",
        },
        {
          id: 11,
          title: "Other movie",
          character: "Other role",
          poster_path: null,
          release_date: "2021-01-01",
        },
      ],
      crew: [{ id: 90, job: "Producer" }],
    },
    tv_credits: {
      cast: [
        {
          id: 20,
          name: "Show",
          character: "Guest",
          poster_path: "/show.png",
          first_air_date: "2022-01-01",
        },
      ],
      crew: [],
    },
  });
  mocks.getWorkByActor.mockResolvedValue([
    {
      id: 1,
      performance: "Lead",
      suggestions: "Editorial metadata",
      dubbing_projects: { id: 100, content_id: 10, content_type: "movie", language: "fr-FR" },
      voice_actors: {
        id: 5,
        firstname: "Voice",
        lastname: "One",
        profile_picture: "https://example.com/voice.png",
        bio: "Unused bio",
      },
    },
    {
      id: 2,
      performance: "Guest",
      suggestions: "Other metadata",
      dubbing_projects: { id: 101, content_id: 20, content_type: "tv", language: "es-ES" },
      voice_actors: null,
    },
  ]);
  mocks.fetchMediaSummary.mockImplementation(async (id: number) => ({
    id,
    title: `Media ${id}`,
    original_title: `Original ${id}`,
    poster_path: null,
    release_date: "2020-01-01",
    overview: "Media overview",
  }));
});

async function request(projection?: string) {
  const app = createApp();
  app.use(
    defineEventHandler((event) => {
      event.context.params = { id: "31" };
      return handler(event);
    }),
  );
  return await toWebHandler(app)(
    new Request(`http://localhost/api/actor/31${projection ? `?projection=${projection}` : ""}`),
  );
}

describe("actor page API projection", () => {
  it("preserves the full default API including provider credits and editorial metadata", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      actor: {
        external_ids: { imdb_id: "provider-id" },
        movie_credits: { crew: [{ id: 90 }] },
        credits: { cast: [{ overview: "Unused synopsis" }, {}, {}] },
        voice_roles: [
          { suggestions: "Editorial metadata", voice_actors: [{ bio: "Unused bio" }] },
          {},
        ],
      },
    });
  });

  it("preserves complete display, search and language data while omitting duplicate and unused fields", async () => {
    const response = await request("actor-page");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      actor: {
        id: 31,
        name: "Actor",
        biography: "Biography",
        birthday: "1970-01-01",
        deathday: null,
        place_of_birth: "City",
        profile_path: "https://image.tmdb.org/t/p/w500/actor.png",
        known_for_department: "Acting",
        credits: {
          cast: [
            {
              id: 10,
              title: "Movie",
              character: "Lead",
              poster_path: "https://image.tmdb.org/t/p/w500/movie.png",
              release_date: "2020-01-01",
              media_type: "movie",
            },
            {
              id: 11,
              title: "Other movie",
              character: "Other role",
              poster_path: null,
              release_date: "2021-01-01",
              media_type: "movie",
            },
            {
              id: 20,
              name: "Show",
              character: "Guest",
              poster_path: "https://image.tmdb.org/t/p/w500/show.png",
              first_air_date: "2022-01-01",
              media_type: "tv",
            },
          ],
        },
        voice_roles: expectedRoles(),
      },
      voiceActors: expectedRoles(),
    });
  });

  it("retains the full response for unrecognized projections", async () => {
    const response = await request("other");
    expect(await response.json()).toHaveProperty("actor.movie_credits.crew.0.id", 90);
  });

  it("reuses complete person-credit summaries without fetching each dubbed title", async () => {
    mocks.getPersonWithCredits.mockResolvedValueOnce({
      id: 31,
      name: "Actor",
      movie_credits: {
        cast: [
          {
            id: 10,
            title: "Movie",
            original_title: "Original movie",
            release_date: "2020-01-01",
            overview: "Movie synopsis",
            poster_path: "/movie.png",
          },
          {
            id: 20,
            title: "Different movie",
            original_title: "Different movie",
            release_date: "2021-01-01",
            overview: "Other synopsis",
            poster_path: null,
          },
        ],
      },
      tv_credits: {
        cast: [
          {
            id: 20,
            name: "Show",
            original_name: "Original show",
            first_air_date: "2022-01-01",
            overview: "Show synopsis",
            poster_path: "/show.png",
          },
        ],
      },
    });
    const response = await request("actor-page");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      actor: {
        voice_roles: [
          {
            id: 1,
            mediaDetails: {
              id: 10,
              title: "Movie",
              original_title: "Original movie",
              poster_path: "https://image.tmdb.org/t/p/w500/movie.png",
              overview: "Movie synopsis",
            },
          },
          {
            id: 2,
            mediaDetails: {
              id: 20,
              title: "Show",
              original_title: "Original show",
              release_date: "2022-01-01",
              overview: "Show synopsis",
            },
          },
        ],
      },
    });
    expect(mocks.fetchMediaSummary).not.toHaveBeenCalled();
    expect(mocks.getPersonWithCredits).toHaveBeenCalledTimes(1);
  });

  it("fetches missing or incomplete summaries once per title while retaining every role", async () => {
    mocks.getPersonWithCredits.mockResolvedValueOnce({
      id: 31,
      name: "Actor",
      movie_credits: {
        cast: [
          {
            id: 10,
            title: "Movie",
            original_title: "Original movie",
            release_date: "2020-01-01",
            overview: "Movie synopsis",
            poster_path: null,
          },
        ],
      },
      tv_credits: { cast: [{ id: 20, name: "Incomplete show" }] },
    });
    mocks.getWorkByActor.mockResolvedValueOnce([
      {
        id: 1,
        performance: "Lead",
        dubbing_projects: { content_id: 10, content_type: "movie", language: "fr-FR" },
        voice_actors: null,
      },
      {
        id: 2,
        performance: "Guest",
        dubbing_projects: { content_id: 20, content_type: "tv", language: "fr-FR" },
        voice_actors: null,
      },
      {
        id: 3,
        performance: "Other voice",
        dubbing_projects: { content_id: 20, content_type: "tv", language: "es-ES" },
        voice_actors: null,
      },
      {
        id: 4,
        performance: "Missing title",
        dubbing_projects: { content_id: 30, content_type: "movie", language: "fr-FR" },
        voice_actors: null,
      },
    ]);
    const response = await request("actor-page");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      actor: {
        voice_roles: [
          { id: 1, mediaDetails: { title: "Movie" } },
          { id: 2, mediaDetails: { title: "Media 20" } },
          { id: 3, mediaDetails: { title: "Media 20" } },
          { id: 4, mediaDetails: { title: "Media 30" } },
        ],
      },
    });
    expect(mocks.fetchMediaSummary).toHaveBeenCalledTimes(2);
    expect(mocks.fetchMediaSummary).toHaveBeenCalledWith(20, "tv", undefined);
    expect(mocks.fetchMediaSummary).toHaveBeenCalledWith(30, "movie", undefined);
  });
});

function expectedRoles() {
  return [
    {
      id: 1,
      performance: "Lead",
      dubbing_projects: { language: "fr-FR" },
      voice_actors: [
        {
          id: 5,
          firstname: "Voice",
          lastname: "One",
          profile_picture: "https://example.com/voice.png",
        },
      ],
      mediaDetails: {
        id: 10,
        title: "Media 10",
        original_title: "Original 10",
        poster_path: null,
        release_date: "2020-01-01",
        media_type: "movie",
        overview: "Media overview",
      },
    },
    {
      id: 2,
      performance: "Guest",
      dubbing_projects: { language: "es-ES" },
      voice_actors: [],
      mediaDetails: {
        id: 20,
        title: "Media 20",
        original_title: "Original 20",
        poster_path: null,
        release_date: "2020-01-01",
        media_type: "tv",
        overview: "Media overview",
      },
    },
  ];
}
