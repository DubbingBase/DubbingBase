import { describe, expect, it } from "vitest";
import { validateCheckPayload, validateExtractPayload } from "./queue-payload";

describe("validateExtractPayload", () => {
  const valid = {
    tmdb_id: 31641,
    media_type: "movie",
    wikipedia_language: "es",
    dubbing_language: "es-ES",
    page_id: 4620806,
    section_indexes: [2],
  };

  it("accepts a well-formed payload", () => {
    const res = validateExtractPayload(valid);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value).toMatchObject({
        tmdbId: 31641,
        mediaType: "movie",
        wikipediaLanguage: "es",
        dubbingLanguage: "es-ES",
        pageId: 4620806,
        sectionIndexes: [2],
      });
    }
  });

  it("coerces string ids and drops unusable section entries", () => {
    const res = validateExtractPayload({
      ...valid,
      tmdb_id: "31641",
      page_id: "4620806",
      section_indexes: ["2", "x", -1],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.sectionIndexes).toEqual([2]);
  });

  it("rejects unknown media types, bad ids, and empty sections", () => {
    expect(validateExtractPayload({ ...valid, media_type: "song" }).ok).toBe(
      false,
    );
    expect(validateExtractPayload({ ...valid, page_id: null }).ok).toBe(false);
    expect(validateExtractPayload({ ...valid, section_indexes: [] }).ok).toBe(
      false,
    );
    expect(
      validateExtractPayload({ ...valid, section_indexes: ["x"] }).ok,
    ).toBe(false);
    expect(validateExtractPayload({ ...valid, tmdb_id: "abc" }).ok).toBe(false);
  });
});

describe("validateCheckPayload", () => {
  it("requires an explicit Wikipedia language and rejects bad seasons", () => {
    const res = validateCheckPayload({ tmdb_id: 1, media_type: "tv" });
    expect(res.ok).toBe(false);
    expect(
      validateCheckPayload({ tmdb_id: 1, media_type: "tv", season_number: -2 })
        .ok,
    ).toBe(false);
  });
});

describe("source and target separation", () => {
  it("reads old language only as a Wikipedia source", () => {
    const payload = {
      tmdb_id: 1,
      media_type: "tv",
      language: "fr",
      page_id: 2,
      section_indexes: [1],
    };
    expect(validateCheckPayload(payload)).toMatchObject({
      ok: true,
      value: { wikipediaLanguage: "fr" },
    });
    expect(validateExtractPayload(payload)).toEqual({
      ok: false,
      reason: "Regional dubbing language requires review",
    });
    expect(
      validateExtractPayload({ ...payload, dubbing_language: "fr-FR" }).ok,
    ).toBe(true);
  });
  it.each(["fr", "de", "simple", "fr-Fr", "zz-ZZ", ""])(
    "rejects %s as a dubbing region",
    (dubbing_language) => {
      expect(
        validateExtractPayload({
          tmdb_id: 1,
          media_type: "tv",
          wikipedia_language: "simple",
          dubbing_language,
          page_id: 2,
          section_indexes: [1],
        }).ok,
      ).toBe(false);
    },
  );
  it("accepts Wikipedia edition identifiers independently", () => {
    expect(
      validateCheckPayload({
        tmdb_id: 1,
        media_type: "tv",
        wikipedia_language: "simple",
        dubbing_language: "en-US",
      }),
    ).toMatchObject({
      ok: true,
      value: { wikipediaLanguage: "simple", dubbingLanguage: "en-US" },
    });
  });
});
