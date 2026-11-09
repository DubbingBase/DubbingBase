import { describe, expect, it } from "vitest";
import {
  getTmdbLocale,
  projectSearchResult,
  rankSearchResults,
  type SearchItem,
} from "./search-ranking";

describe("search ranking", () => {
  it("keeps every exact match above popular partial matches", () => {
    const results = rankSearchResults(
      [
        { id: 9, media_type: "movie", title: "The Example Film", popularity: 100_000 },
        { id: 2, media_type: "movie", title: "Example", popularity: 1 },
        { id: 1, media_type: "person", name: "Example", popularity: 0 },
      ],
      "Example",
      0,
    );

    expect(results.map(({ media_type, id }) => `${media_type}:${id}`)).toEqual([
      "movie:2",
      "person:1",
      "movie:9",
    ]);
  });

  it("matches case and accents while preserving meaningful query punctuation", () => {
    const results = rankSearchResults(
      [
        { id: 1, media_type: "movie", title: "Amélie" },
        { id: 2, media_type: "movie", title: "C++" },
        { id: 3, media_type: "movie", title: "C#" },
        { id: 4, media_type: "movie", title: "C" },
      ],
      "c++",
      0,
    );

    expect(results.map(({ id }) => id)).toEqual([2, 1, 3, 4]);
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
    expect(rankSearchResults([{ id: 4, title: "AMÉLIE" }], "Amelie", 0)[0]?.score).toBe(3000);
  });

  it("preserves Japanese voicing marks when distinguishing exact titles", () => {
    const results = rankSearchResults(
      [
        { id: 1, media_type: "movie", title: "カール", popularity: 100_000 },
        { id: 2, media_type: "movie", title: "ガール", popularity: 0 },
      ],
      "ガール",
      0,
    );

    expect(results.map(({ id }) => id)).toEqual([2, 1]);
  });

  it("produces the same type and ID order regardless of candidate arrival order", () => {
    const candidates: SearchItem[] = [
      { id: 20, media_type: "movie", title: "Example" },
      { id: 2, media_type: "person", name: "Example" },
      { id: 10, media_type: "movie", title: "Example" },
    ];
    const ids = (items: SearchItem[]) =>
      rankSearchResults(items, "Example", 0).map((item) => item.id);

    expect(ids(candidates)).toEqual([10, 20, 2]);
    expect(ids([...candidates].reverse())).toEqual(ids(candidates));
  });

  it("maps supported locales and defaults to English for TMDB", () => {
    expect(["en", "fr", "es", "ja", "unknown"].map(getTmdbLocale)).toEqual([
      "en-US",
      "fr-FR",
      "es-ES",
      "ja-JP",
      "en-US",
    ]);
  });

  it("keeps the search-page response projection stable", () => {
    const item: SearchItem = {
      id: 7,
      media_type: "video_game",
      name: "Example game",
      score: 3000,
      first_release_date: 1_700_000_000,
      cover: { url: "https://images.example/cover.jpg", image_id: "private-provider-field" },
      internal_provider_data: "omitted",
    };

    expect(projectSearchResult(item)).toEqual({
      id: 7,
      media_type: "video_game",
      title: undefined,
      name: "Example game",
      voice_actor_name: undefined,
      firstname: undefined,
      lastname: undefined,
      profile_path: undefined,
      poster_path: undefined,
      popularity: undefined,
      score: 3000,
      release_date: undefined,
      first_air_date: undefined,
      first_release_date: 1_700_000_000,
      original_title: undefined,
      original_name: undefined,
      studio_names: undefined,
      cover: { url: "https://images.example/cover.jpg" },
      author_name: undefined,
      brand: undefined,
      manufacturer: undefined,
      product_line: undefined,
      overview: undefined,
    });
  });

  // Fixtures recorded from TMDB / OpenLibrary on 2026-11-08 (movie 406994 = Better Watch Out).
  const betterWatchOut: SearchItem = {
    id: 406994,
    media_type: "movie",
    title: "Better Watch Out",
    original_title: "Better Watch Out",
    release_date: "2017-10-06",
    popularity: 3.0034,
    vote_average: 6.5,
    vote_count: 1725,
  };
  const now = Date.parse("2026-11-08T00:00:00Z");

  it("uses TMDB's relevance order as a graded floor without displacing real exact titles", () => {
    const results = rankSearchResults(
      [
        { id: 1079890, media_type: "movie", title: "Watch Out", release_date: "2023-01-01" },
        {
          id: 74864,
          media_type: "movie",
          title: "Watch Out",
          release_date: "2008-01-01",
          vote_count: 6,
        },
        { ...betterWatchOut, provider_rank: 0 },
        {
          id: 109693,
          media_type: "tv",
          name: "Watch Out Boss",
          first_air_date: "2018-01-01",
          provider_rank: 1,
        },
        {
          id: 1715068,
          media_type: "movie",
          title: "Watch Out, Kid",
          release_date: "2026-01-01",
          provider_rank: 5,
        },
      ],
      "Watch Out",
      now,
    );

    expect(results.map(({ id }) => id)).toEqual([406994, 1079890, 74864, 109693, 1715068]);
    expect(results.every((item) => !("provider_rank" in item))).toBe(true);
  });

  it("caps TMDB hits with no local text match below real exact titles", () => {
    const results = rankSearchResults(
      [
        {
          id: 1,
          media_type: "movie",
          title: "The Birthday Gift",
          vote_count: 26,
          provider_rank: 0,
        },
        { id: 2, media_type: "movie", title: "The Gift", vote_count: 3650, provider_rank: 2 },
        { id: 3, media_type: "audiobook", title: "Unrelated book" },
      ],
      "The Gift",
      now,
    );

    expect(results.map(({ id }) => id)).toEqual([2, 1, 3]);
    expect(results[1]?.score).toBeLessThan(2000);
  });

  it("falls back to local title tiers when no provider order is available", () => {
    const [result] = rankSearchResults([betterWatchOut], "Watch Out", now);
    expect(result?.score).toBeGreaterThan(1000);
    expect(result?.score).toBeLessThan(2000);
  });

  it("ranks the established movie above unrated exact-title books without a media-type rule", () => {
    const book = (id: number, year: number): SearchItem => ({
      id,
      media_type: "audiobook",
      title: "Better Watch Out",
      release_date: `${year}-01-01`,
    });
    const books = [book(42453480, 2024), book(36848566, 2023), book(5805908, 1997)];

    const ranked = rankSearchResults([...books, betterWatchOut], "Better Watch Out", now);
    expect(ranked[0]?.id).toBe(406994);
    expect((ranked[0]?.score ?? 0) - (ranked[1]?.score ?? 0)).toBeGreaterThan(8);

    // A book with real rating evidence is not penalised for being a book.
    const ratedBook: SearchItem = { ...book(1, 2025), popularity: 400, vote_count: 50_000 };
    expect(rankSearchResults([betterWatchOut, ratedBook], "Better Watch Out", now)[0]?.id).toBe(1);
  });
});
