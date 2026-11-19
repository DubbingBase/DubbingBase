import { createApp, createError, defineEventHandler, getHeader, getQuery, toWebHandler } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../index", () => ({ useTmdbClient: vi.fn() }));
vi.mock("../services/media", () => ({
  MediaService: class {
    async getMediaWithVoiceActors() {
      return { media: { title: "Film", poster_path: "/poster.jpg" } };
    }

    async getVoiceActorWithWorkAndMedia() {
      return {
        voiceActor: {
          firstname: "Ada",
          lastname: "Test",
          profile_picture: "storage:voice_actor_profile_pictures/ada.jpg",
        },
        enhancedWorks: [],
      };
    }
  },
}));

afterEach(() => vi.unstubAllGlobals());

describe("career grid images", () => {
  it.each([
    ["movie", "https://image.tmdb.org/t/p/w780/poster.jpg"],
    [
      "actor",
      "https://mock.supabase.co/storage/v1/object/public/voice_actor_profile_pictures/ada.jpg",
    ],
  ])("resolves %s image references on the server", async (type, url) => {
    vi.stubGlobal("defineEventHandler", defineEventHandler);
    vi.stubGlobal("getQuery", getQuery);
    vi.stubGlobal("getHeader", getHeader);
    vi.stubGlobal("createError", createError);
    vi.stubGlobal("useRuntimeConfig", () => ({ supabaseUrl: "https://mock.supabase.co" }));
    const fetchImage = vi.fn(() => Promise.resolve(new Response("fixture")));
    vi.stubGlobal("fetch", fetchImage);
    const { default: careerGrid } = await import("../../api/career-grid.get");
    const app = createApp();
    app.use(careerGrid);

    const response = await toWebHandler(app)(
      new Request(`http://localhost/api/career-grid?type=${type}&id=1`),
    );

    expect(response.status).toBe(200);
    expect(fetchImage).toHaveBeenCalledWith(url);
    expect(await response.text()).toContain("Zml4dHVyZQ==");
  });
});
