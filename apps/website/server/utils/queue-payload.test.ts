import { describe, expect, it } from "vitest";
import { validateCheckPayload, validateExtractPayload } from "./queue-payload";

describe("validateExtractPayload", () => {
  const valid = {
    tmdb_id: 31641,
    media_type: "movie",
    language: "es",
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
        language: "es",
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
  it("defaults a missing language and rejects bad seasons", () => {
    const res = validateCheckPayload({ tmdb_id: 1, media_type: "tv" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value.language).toBe("fr");
    expect(
      validateCheckPayload({ tmdb_id: 1, media_type: "tv", season_number: -2 })
        .ok,
    ).toBe(false);
  });
});
