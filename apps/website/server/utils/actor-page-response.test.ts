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
