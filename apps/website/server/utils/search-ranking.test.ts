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

describe("search ranking with TMDB relevance order", () => {
  const now = Date.parse("2026-11-08T00:00:00Z");
  const movie = (id: number, title: string, extra: SearchItem = {}): SearchItem => ({
    id,
    media_type: "movie",
    title,
    release_date: "2010-01-01",
    ...extra,
  });
  const order = (items: SearchItem[], query: string) =>
    rankSearchResults(items, query, now).map(({ id }) => id);

  it("never lets a TMDB hit without a local match outrank a real exact title, at any position", () => {
    for (let rank = 0; rank < 40; rank += 1) {
      const results = rankSearchResults(
        [
          movie(1, "The Birthday Gift", {
            vote_count: 50_000,
            popularity: 500,
            provider_rank: rank,
          }),
          movie(2, "The Gift", { provider_rank: 39 }),
        ],
        "The Gift",
        now,
      );
      expect(results[0]?.id).toBe(2);
    }
  });

  it("scores a lower TMDB position at least as high as a later one for identical items", () => {
    const scores = Array.from({ length: 40 }, (_, rank) => {
      const [item] = rankSearchResults(
        [movie(1, "Better Watch Out", { provider_rank: rank })],
        "Watch Out",
        now,
      );
      return item?.score ?? 0;
    });
    for (let n = 1; n < scores.length; n += 1) {
      expect(scores[n - 1]).toBeGreaterThanOrEqual(scores[n] ?? 0);
    }
    expect(scores[39]).toBeGreaterThanOrEqual(1000);
  });

  it("does not change the order of items that carry no provider rank", () => {
    const items = [
      movie(3, "Example"),
      movie(1, "Example Two"),
      movie(2, "Example", { vote_count: 9 }),
    ];
    const withRank = items.map((item) => ({ ...item, provider_rank: undefined }));
    expect(order(withRank, "Example")).toEqual(order(items, "Example"));
  });

  it("ignores invalid provider ranks instead of producing NaN scores", () => {
    for (const provider_rank of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -5,
    ]) {
      const [item] = rankSearchResults(
        [movie(1, "Better Watch Out", { provider_rank })],
        "Watch Out",
        now,
      );
      expect(Number.isFinite(item?.score)).toBe(true);
      expect(item?.score).toBeLessThan(3050);
    }
  });

  it("only floors movie and TV hits, not people or other providers", () => {
    const results = rankSearchResults(
      [
        { id: 1, media_type: "person", name: "Yushin Okami", provider_rank: 0 },
        { id: 2, media_type: "audiobook", title: "Okami", provider_rank: 0 },
        movie(3, "Okami"),
      ],
      "Ōkami",
      now,
    );
    expect(results.map(({ id }) => id)).toEqual([2, 3, 1]);
    expect(results.find(({ id }) => id === 1)?.score).toBeLessThan(2000);
  });

  it("keeps exact titles above a TMDB-first substring hit for very short queries", () => {
    expect(
      order(
        [
          {
            id: 1,
            media_type: "tv",
            name: "The IT Crowd",
            popularity: 60,
            vote_count: 2000,
            provider_rank: 0,
          },
          movie(2, "It", { provider_rank: 1 }),
          movie(3, "It", { release_date: "1990-01-01" }),
        ],
        "It",
      ),
    ).toEqual([2, 3, 1]);
  });

  it("is independent of candidate arrival order, including rank ties and equal scores", () => {
    const items: SearchItem[] = [
      movie(5, "Better Watch Out", { provider_rank: 0 }),
      movie(4, "Watch Out", { provider_rank: 3 }),
      movie(3, "Watch Out", { provider_rank: 3 }),
      { id: 3, media_type: "tv", name: "Watch Out", provider_rank: 3 },
      { id: 9, media_type: "audiobook", title: "Watch Out" },
    ];
    const permutations = (list: SearchItem[]): SearchItem[][] =>
      list.length <= 1
        ? [list]
        : list.flatMap((item, index) =>
            permutations([...list.slice(0, index), ...list.slice(index + 1)]).map((rest) => [
              item,
              ...rest,
            ]),
          );
    const expected = rankSearchResults(items, "Watch Out", now).map(
      ({ media_type, id }) => `${media_type}:${id}`,
    );
    for (const candidate of permutations(items)) {
      expect(
        rankSearchResults(candidate, "Watch Out", now).map(
          ({ media_type, id }) => `${media_type}:${id}`,
        ),
      ).toEqual(expected);
    }
  });

  it("does not mutate inputs and never returns the internal rank", () => {
    const input = movie(1, "Better Watch Out", { provider_rank: 0 });
    const snapshot = structuredClone(input);
    const [result] = rankSearchResults([input], "Watch Out", now);
    expect(input).toEqual(snapshot);
    expect(result).not.toHaveProperty("provider_rank");
    expect(result).toHaveProperty("score");
  });

  it.each([
    [
      "千と千尋の神隠し",
      { id: 1, media_type: "movie", title: "Spirited Away", original_title: "千と千尋の神隠し" },
    ],
    [
      "Что? Где? Когда?",
      { id: 1, media_type: "tv", name: "What? Where? When?", original_name: "Что? Где? Когда?" },
    ],
    ["M*A*S*H", { id: 1, media_type: "tv", name: "M*A*S*H" }],
    ["WALL·E", { id: 1, media_type: "movie", title: "WALL·E" }],
    ["올드보이", { id: 1, media_type: "movie", title: "Oldboy", original_title: "올드보이" }],
    [
      "Léon",
      { id: 1, media_type: "movie", title: "Leon: The Professional", original_title: "Léon" },
    ],
  ])("matches exotic title %s through original or punctuated names", (query, item) => {
    const results = rankSearchResults(
      [
        { id: 2, media_type: "audiobook", title: "Unrelated" },
        { ...item, provider_rank: 0 },
      ],
      query,
      now,
    );
    expect(results[0]?.id).toBe(1);
    expect(results[0]?.score).toBeGreaterThanOrEqual(3000);
  });

  it("survives empty, emoji and very long queries without throwing", () => {
    const items = [movie(1, "Example", { provider_rank: 0 })];
    for (const query of ["", " ", "🎬", "a".repeat(100), "()[]*+?\\^$|"]) {
      expect(() => rankSearchResults(items, query, now)).not.toThrow();
      expect(Number.isFinite(rankSearchResults(items, query, now)[0]?.score)).toBe(true);
    }
  });
});
