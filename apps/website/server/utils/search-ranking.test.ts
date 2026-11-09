import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIA_TYPE_WEIGHT,
  MEDIA_TYPE_WEIGHTS,
  RRF_K,
  getTmdbLocale,
  projectSearchResult,
  rankSearchResults,
  type SearchItem,
} from "./search-ranking";

const item = (media_type: string, id: number, provider_rank?: number, extra: SearchItem = {}) =>
  ({ id, media_type, title: `${media_type} ${id}`, provider_rank, ...extra }) satisfies SearchItem;
const keys = (items: SearchItem[]) => items.map(({ media_type, id }) => `${media_type}:${id}`);

describe("media type weights", () => {
  it("orders voice actors > movies = shows > games > people > books = ads = the rest", () => {
    const w = (type: string) => MEDIA_TYPE_WEIGHTS[type] ?? DEFAULT_MEDIA_TYPE_WEIGHT;
    expect(w("voice_actor")).toBeGreaterThan(w("movie"));
    expect(w("movie")).toBe(w("tv"));
    expect(w("tv")).toBeGreaterThan(w("video_game"));
    expect(w("video_game")).toBeGreaterThan(w("person"));
    expect(w("person")).toBeGreaterThan(w("audiobook"));
    expect(new Set(["audiobook", "advertisement", "podcast", "toy", "unknown"].map(w)).size).toBe(
      1,
    );
  });
});

describe("search ranking (weighted reciprocal rank fusion)", () => {
  it("keeps each provider's own order within a media type", () => {
    const results = rankSearchResults([
      item("movie", 3, 2),
      item("movie", 1, 0),
      item("movie", 2, 1),
    ]);
    expect(keys(results)).toEqual(["movie:1", "movie:2", "movie:3"]);
  });

  it("scores weight / (k + position)", () => {
    const [movie, book] = rankSearchResults([item("audiobook", 2, 3), item("movie", 1, 0)]);
    expect(movie?.score).toBeCloseTo(MEDIA_TYPE_WEIGHTS.movie! / RRF_K);
    expect(book?.score).toBeCloseTo(DEFAULT_MEDIA_TYPE_WEIGHT / (RRF_K + 3));
  });

  it("interleaves provider lists by position and weight, not by provider", () => {
    const results = rankSearchResults([
      item("movie", 1, 0),
      item("movie", 2, 1),
      item("movie", 3, 2),
      item("video_game", 10, 0),
      item("audiobook", 20, 0),
      item("person", 30, 0),
      item("voice_actor", 40, 0),
    ]);
    expect(keys(results)).toEqual([
      "voice_actor:40", // 1.5 / 5   = 0.300
      "movie:1", //        1   / 5   = 0.200
      "movie:2", //        1   / 6   = 0.167
      "video_game:10", //  0.8 / 5   = 0.160
      "movie:3", //        1   / 7   = 0.143
      "person:30", //      0.6 / 5   = 0.120
      "audiobook:20", //   0.4 / 5   = 0.080
    ]);
  });

  it("gives books, ads, podcasts and toys the same weight so their own positions decide", () => {
    const results = rankSearchResults([
      item("toy", 4, 1),
      item("podcast", 3, 0),
      item("advertisement", 2, 1),
      item("audiobook", 1, 0),
    ]);
    expect(keys(results)).toEqual(["audiobook:1", "podcast:3", "advertisement:2", "toy:4"]);
  });

  it("breaks ties by popularity, then media type, then numeric ID", () => {
    const results = rankSearchResults([
      item("movie", 10, 0),
      item("movie", 9, 0),
      item("movie", 2, 0, { popularity: 5 }),
      item("tv", 1, 0),
    ]);
    expect(keys(results)).toEqual(["movie:2", "movie:9", "movie:10", "tv:1"]);
  });

  it("produces the same order for every arrival order of the candidates", () => {
    const items = [
      item("movie", 1, 0),
      item("tv", 1, 0),
      item("movie", 2, 1, { popularity: 3 }),
      item("person", 7, 1),
      item("audiobook", 5, 0),
      item("audiobook", 6, 0),
    ];
    const permutations = (list: SearchItem[]): SearchItem[][] =>
      list.length <= 1
        ? [list]
        : list.flatMap((entry, index) =>
            permutations([...list.slice(0, index), ...list.slice(index + 1)]).map((rest) => [
              entry,
              ...rest,
            ]),
          );
    const expected = keys(rankSearchResults(items));
    for (const candidate of permutations(items)) {
      expect(keys(rankSearchResults(candidate))).toEqual(expected);
    }
  });

  it("is monotonic: a later position never scores higher for the same media type", () => {
    for (const type of ["movie", "tv", "person", "video_game", "audiobook", "voice_actor"]) {
      const scores = Array.from(
        { length: 40 },
        (_, rank) => rankSearchResults([item(type, 1, rank)])[0]?.score ?? 0,
      );
      for (let n = 1; n < scores.length; n += 1) {
        expect(scores[n - 1]).toBeGreaterThan(scores[n] ?? 0);
      }
    }
  });

  it("ranks items without a valid provider position last instead of producing NaN", () => {
    const results = rankSearchResults([
      item("movie", 1, Number.NaN),
      item("movie", 2, Number.POSITIVE_INFINITY),
      item("movie", 3),
      item("audiobook", 4, 30),
      item("movie", 5, -2),
    ]);
    expect(results.map(({ score }) => Number.isFinite(score))).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(keys(results).slice(0, 2)).toEqual(["movie:5", "audiobook:4"]);
    expect(results.slice(2).every(({ score }) => score === 0)).toBe(true);
  });

  it("does not look at titles: text, language and script never change the order", () => {
    const titles = ["千と千尋の神隠し", "Что? Где? Когда?", "M*A*S*H", "🎬", "", "a".repeat(500)];
    const results = rankSearchResults(
      titles.map((title, index) => ({
        id: index,
        media_type: "movie",
        title,
        provider_rank: index,
      })),
    );
    expect(results.map(({ id }) => id)).toEqual(titles.map((_, index) => index));
  });

  it("handles empty input, null entries and does not mutate or leak internals", () => {
    expect(rankSearchResults([])).toEqual([]);
    const input = item("movie", 1, 0);
    const snapshot = structuredClone(input);
    const nullable: Array<SearchItem | null> = [null, input];
    const [result] = rankSearchResults(
      nullable.filter((entry): entry is SearchItem => entry !== null),
    );
    expect(input).toEqual(snapshot);
    expect(result).not.toHaveProperty("provider_rank");
    expect(result).toHaveProperty("score");
  });

  it("surfaces Better Watch Out for Watch Out when TMDB ranks it first (recorded 2026-11-08)", () => {
    const results = rankSearchResults([
      item("movie", 406994, 0, { title: "Better Watch Out" }),
      item("tv", 109693, 1, { name: "Watch Out Boss" }),
      item("movie", 322957, 2, { title: "Watch Out" }),
      item("audiobook", 99, 0, { title: "The Essential Dykes to Watch Out For" }),
    ]);
    expect(results[0]?.id).toBe(406994);
    expect(keys(results)).toContain("audiobook:99");
  });
});

describe("search locale and projection", () => {
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
    const entry: SearchItem = {
      id: 7,
      media_type: "video_game",
      name: "Example game",
      score: 0.16,
      first_release_date: 1_700_000_000,
      cover: { url: "https://images.example/cover.jpg", image_id: "private-provider-field" },
      internal_provider_data: "omitted",
    };

    expect(projectSearchResult(entry)).toEqual({
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
      score: 0.16,
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
