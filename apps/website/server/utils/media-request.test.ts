import { describe, expect, it } from "vitest";
import {
  parseEpisodeQuery,
  parseSeasonQuery,
  withMediaServiceTimeout,
} from "./media-request";
import { withTimeout } from "./with-timeout";

describe("media service requests", () => {
  it("returns 504 when the media service never settles", async () => {
    const hangingRequest = new Promise<never>(() => undefined);

    await expect(
      withMediaServiceTimeout(() => hangingRequest, "TMDB season request", 5),
    ).rejects.toMatchObject({ statusCode: 504 });
  });

  it("returns 504 when the Supabase dependency never settles", async () => {
    const hangingQuery = new Promise<never>(() => undefined);

    await expect(
      withTimeout(hangingQuery, 5, "Supabase dubbing projects query"),
    ).rejects.toMatchObject({ statusCode: 504 });
  });

  it("preserves upstream not-found responses as 404", async () => {
    await expect(
      withMediaServiceTimeout(
        () => Promise.reject(new Error("TMDB API error: 404")),
        "TMDB season request",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      withMediaServiceTimeout(
        () => Promise.reject(new Error("TMDB API error: 404")),
        "TMDB episode request",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("maps upstream errors and timeouts to gateway errors", async () => {
    await expect(
      withMediaServiceTimeout(
        () => Promise.reject(new Error("TMDB API error: 503")),
        "TMDB season request",
      ),
    ).rejects.toMatchObject({ statusCode: 502 });

    await expect(
      withMediaServiceTimeout(
        () => Promise.reject(new Error("TMDB API timeout: tv/108978/season/1")),
        "TMDB season request",
      ),
    ).rejects.toMatchObject({ statusCode: 504 });
  });

  it("accepts Specials season zero while requiring positive media IDs and episode numbers", () => {
    expect(parseSeasonQuery({ id: "108978", season_number: "0" })).toEqual({
      id: 108978,
      seasonNumber: 0,
    });
    expect(
      parseEpisodeQuery({
        id: "108978",
        season_number: "0",
        episode_number: "1",
      }),
    ).toEqual({ id: 108978, seasonNumber: 0, episodeNumber: 1 });
    expect(() => parseSeasonQuery({ id: "0", season_number: "0" })).toThrow();
    expect(() =>
      parseEpisodeQuery({
        id: "108978",
        season_number: "0",
        episode_number: "0",
      }),
    ).toThrow();
  });
});
