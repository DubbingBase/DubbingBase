import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TMDBClient } from "../api/tmdb";
import { MediaService } from "./media";

const serviceMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: serviceMocks.useSupabaseAdmin,
}));

type VoiceActorWorkFixture = {
  id: number;
  actor_id: number | null;
  performance: string;
  character_name: string | null;
  note: string | null;
  dubbing_projects: { content_id: number; content_type: "movie" | "tv" };
};

const duplicateMovieWorks: VoiceActorWorkFixture[] = [
  {
    id: 101,
    actor_id: 42,
    performance: "First role",
    character_name: null,
    note: null,
    dubbing_projects: { content_id: 900, content_type: "movie" },
  },
  {
    id: 102,
    actor_id: 42,
    performance: "Second role",
    character_name: null,
    note: null,
    dubbing_projects: { content_id: 900, content_type: "movie" },
  },
];

function createSupabaseMock(work: VoiceActorWorkFixture[] = duplicateMovieWorks) {
  const voiceActor = {
    id: 71,
    firstname: "",
    lastname: "",
    tmdb_id: null,
    profile_picture: null,
    work,
  };
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    single: async () => ({ data: voiceActor, error: null }),
  };

  return { from: vi.fn(() => builder) };
}

describe("MediaService voice actor media indexing", () => {
  beforeEach(() => {
    vi.stubGlobal("useRuntimeConfig", () => ({ tmdbApiKey: "test-key" }));
    serviceMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reuses each media cast index and preserves the first matching TMDB credit", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 900,
            credits: {
              cast: [
                {
                  id: 42,
                  name: "First match",
                  character: "One",
                  profile_path: "/first.jpg",
                },
                {
                  id: 42,
                  name: "Duplicate match",
                  character: "Two",
                  profile_path: "/second.jpg",
                },
              ],
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new MediaService(new TMDBClient());
    const result = await service.getVoiceActorWithWorkAndMedia(71);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.enhancedWorks.map((work) => work.data.actor)).toEqual([
      {
        id: 42,
        name: "First match",
        character: "One",
        profile_picture: "https://image.tmdb.org/t/p/w500/first.jpg",
      },
      {
        id: 42,
        name: "First match",
        character: "One",
        profile_picture: "https://image.tmdb.org/t/p/w500/first.jpg",
      },
    ]);
  });

  it("omits regular credits when loading show details", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(new URL(String(input)));
        return new Response(JSON.stringify({ id: 88 }));
      }),
    );

    const service = new MediaService(new TMDBClient());
    const result = await service.getMediaWithVoiceActors("tv", 88);

    expect(urls).toHaveLength(1);
    expect(urls[0]?.searchParams.get("append_to_response")).toBe("external_ids");
    expect(result.media.credits).toEqual({});
  });

  it("keeps regular credits for movie cast pages", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(new URL(String(input)));
        return new Response(
          JSON.stringify({
            id: 89,
            credits: { cast: [{ id: 1 }], crew: [{ id: 3, name: "Crew member" }] },
          }),
        );
      }),
    );

    const service = new MediaService(new TMDBClient());
    const result = await service.getMediaWithVoiceActors("movie", 89);

    expect(urls[0]?.searchParams.get("append_to_response")).toBe("credits,external_ids");
    expect(result.media.credits).toHaveProperty("crew", [{ id: 3, name: "Crew member" }]);
  });

  it("omits unused movie crew from compact media page responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: 89,
              credits: {
                cast: [{ id: 1, character: "Role" }],
                crew: [{ id: 3, name: "Crew member" }],
              },
            }),
          ),
      ),
    );

    const result = await new MediaService(new TMDBClient()).getMediaWithVoiceActors("movie", 89, {
      includeCreditsCrew: false,
    });

    expect(result.media.credits).toEqual({
      cast: [{ id: 1, character: "Role", profile_path: null }],
    });
  });

  it("skips unused appended data for season media pages", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(new URL(String(input)));
        return new Response(JSON.stringify({ id: 90, season_number: 1, episodes: [] }));
      }),
    );

    const service = new MediaService(new TMDBClient());
    const result = await service.getMediaWithVoiceActorsExtended("season", 90, 1, undefined, {
      includeCredits: false,
    });

    expect(urls).toHaveLength(1);
    expect(urls[0]?.searchParams.has("append_to_response")).toBe(false);
    expect(result.media?.credits).toEqual({});
  });

  it("keeps appended season data for the default full response", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(new URL(String(input)));
        return new Response(JSON.stringify({ id: 91, season_number: 1, credits: { cast: [] } }));
      }),
    );

    const service = new MediaService(new TMDBClient());
    await service.getMediaWithVoiceActorsExtended("season", 91, 1);

    expect(urls[0]?.searchParams.get("append_to_response")).toBe("credits,external_ids");
  });

  it("skips loading and transforming a movie collection for compact media pages", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: 89,
            belongs_to_collection: { id: 900 },
            credits: { cast: [] },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const service = new MediaService(new TMDBClient());
    const result = await service.getMediaWithVoiceActors("movie", 89, {
      includeCollection: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.collection).toBeNull();
  });

  it("keeps cast indexes separate for movie and TV works with the same TMDB id", async () => {
    const works: VoiceActorWorkFixture[] = [
      {
        id: 201,
        actor_id: 42,
        performance: "Movie role",
        character_name: null,
        note: null,
        dubbing_projects: { content_id: 900, content_type: "movie" },
      },
      {
        id: 202,
        actor_id: 42,
        performance: "TV role",
        character_name: null,
        note: null,
        dubbing_projects: { content_id: 900, content_type: "tv" },
      },
    ];
    serviceMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock(works));
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input));
        urls.push(url);
        const mediaType = url.pathname.split("/")[2];
        return new Response(
          JSON.stringify({
            id: 900,
            credits: {
              cast: [
                {
                  id: 42,
                  name: mediaType === "movie" ? "Movie actor" : "TV actor",
                  character: "Character",
                  profile_path: null,
                },
              ],
            },
          }),
        );
      }),
    );

    const result = await new MediaService(new TMDBClient()).getVoiceActorWithWorkAndMedia(71);

    expect(urls.map((url) => url.pathname)).toEqual(["/3/movie/900", "/3/tv/900"]);
    expect(result.enhancedWorks.map((work) => work.data.actor.name)).toEqual([
      "Movie actor",
      "TV actor",
    ]);
  });

  it("handles absent or malformed TMDB credits without inventing cast matches", async () => {
    const malformedCredits: unknown[] = [
      {},
      { credits: null },
      { credits: { cast: "not-a-cast-array" } },
      { credits: { cast: [{ id: "42", name: "String id", profile_path: null }] } },
    ];

    for (const [index, media] of malformedCredits.entries()) {
      const work: VoiceActorWorkFixture = {
        id: 300 + index,
        actor_id: 42,
        performance: "Role",
        character_name: null,
        note: null,
        dubbing_projects: { content_id: 900 + index, content_type: "movie" },
      };
      serviceMocks.useSupabaseAdmin.mockReturnValue(createSupabaseMock([work]));
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(media))),
      );

      const result = await new MediaService(new TMDBClient()).getVoiceActorWithWorkAndMedia(71);

      expect(result.enhancedWorks[0]?.data.actor).toMatchObject({
        id: 42,
        name: "",
        character: "",
      });
    }
  });
});
