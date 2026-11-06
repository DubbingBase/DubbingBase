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
});
