import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TMDBClient } from "../api/tmdb";
import { MediaService } from "./media";

const serviceMocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
}));

vi.mock("../db/client", () => ({
  useSupabaseAdmin: serviceMocks.useSupabaseAdmin,
}));

function createSupabaseMock() {
  const voiceActor = {
    id: 71,
    firstname: "",
    lastname: "",
    tmdb_id: null,
    profile_picture: null,
    work: [
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
    ],
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
    expect(urls[0]?.searchParams.get("append_to_response")).toBe(
      "external_ids",
    );
    expect(result.media.credits).toEqual({});
  });

  it("keeps regular credits for movie cast pages", async () => {
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(new URL(String(input)));
        return new Response(
          JSON.stringify({ id: 89, credits: { cast: [{ id: 1 }] } }),
        );
      }),
    );

    const service = new MediaService(new TMDBClient());
    await service.getMediaWithVoiceActors("movie", 89);

    expect(urls[0]?.searchParams.get("append_to_response")).toBe(
      "credits,external_ids",
    );
  });
});
