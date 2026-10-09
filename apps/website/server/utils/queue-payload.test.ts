import { describe, expect, it } from "vitest";
import {
  queueRequester,
  queueRequesterRpcArgs,
  validateCheckPayload,
  validateDiscoveryPayload,
  validateExtractPayload,
} from "./queue-payload";

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
    expect(validateExtractPayload({ ...valid, media_type: "song" }).ok).toBe(false);
    expect(validateExtractPayload({ ...valid, page_id: null }).ok).toBe(false);
    expect(validateExtractPayload({ ...valid, section_indexes: [] }).ok).toBe(false);
    expect(validateExtractPayload({ ...valid, section_indexes: ["x"] }).ok).toBe(false);
    expect(validateExtractPayload({ ...valid, tmdb_id: "abc" }).ok).toBe(false);
  });
});

describe("validateCheckPayload", () => {
  it("requires an explicit Wikipedia language and rejects bad seasons", () => {
    const res = validateCheckPayload({ tmdb_id: 1, media_type: "tv" });
    expect(res.ok).toBe(false);
    expect(validateCheckPayload({ tmdb_id: 1, media_type: "tv", season_number: -2 }).ok).toBe(
      false,
    );
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
      reason: "Regional dubbing language is required for extraction",
    });
    expect(validateExtractPayload({ ...payload, dubbing_language: "fr-FR" }).ok).toBe(true);
  });
  it.each(["fr", "de", "en", "fr-Fr", "fr-FRA", ""])(
    "rejects %s as a dubbing region",
    (dubbing_language) => {
      expect(
        validateExtractPayload({
          tmdb_id: 1,
          media_type: "tv",
          wikipedia_language: "en",
          dubbing_language,
          page_id: 2,
          section_indexes: [1],
        }).ok,
      ).toBe(false);
    },
  );

  it.each(["fr", "FR-fr", "fr-Fr", "fr-FRA"])(
    "rejects non-regional target %s",
    (dubbing_language) => {
      expect(
        validateExtractPayload({
          tmdb_id: 1,
          media_type: "movie",
          wikipedia_language: "en",
          dubbing_language,
          page_id: 1,
          section_indexes: [1],
        }).ok,
      ).toBe(false);
    },
  );

  it("accepts a supported regional code", () => {
    expect(
      validateExtractPayload({
        tmdb_id: 1,
        media_type: "movie",
        wikipedia_language: "en",
        dubbing_language: "fr-BE",
        page_id: 1,
        section_indexes: [1],
      }).ok,
    ).toBe(true);
  });

  it("rejects a structurally regional but unsupported code", () => {
    expect(
      validateExtractPayload({
        tmdb_id: 1,
        media_type: "movie",
        wikipedia_language: "en",
        dubbing_language: "zz-ZZ",
        page_id: 1,
        section_indexes: [1],
      }).ok,
    ).toBe(false);
  });

  it("requires a regional target before the extract stage", () => {
    expect(
      validateExtractPayload({
        tmdb_id: 1,
        media_type: "movie",
        wikipedia_language: "en",
        page_id: 1,
        section_indexes: [1],
      }),
    ).toEqual({
      ok: false,
      reason: "Regional dubbing language is required for extraction",
    });
  });
  it("accepts Wikipedia edition identifiers independently", () => {
    expect(
      validateCheckPayload({
        tmdb_id: 1,
        media_type: "tv",
        wikipedia_language: "en",
        dubbing_language: "en-US",
      }),
    ).toMatchObject({
      ok: true,
      value: { wikipediaLanguage: "en", dubbingLanguage: "en-US" },
    });
  });

  it("rejects Simple Wikipedia as a source identifier", () => {
    expect(
      validateDiscoveryPayload({
        tmdb_id: 1,
        media_type: "movie",
        wikipedia_language: "simple",
      }),
    ).toEqual({ ok: false, reason: "invalid wikipedia_language" });
    expect(
      validateCheckPayload({
        tmdb_id: 1,
        media_type: "movie",
        wikipedia_language: "simple",
      }),
    ).toEqual({ ok: false, reason: "invalid wikipedia_language" });
  });

  it("allows source-only discovery and preserves an explicit target when present", () => {
    expect(validateDiscoveryPayload({ tmdb_id: 1, media_type: "movie" })).toMatchObject({
      ok: true,
      value: { tmdbId: 1, mediaType: "movie" },
    });
    expect(
      validateDiscoveryPayload({
        tmdb_id: 1,
        media_type: "movie",
        wikipedia_language: "en",
        dubbing_language: "en-US",
      }),
    ).toMatchObject({
      ok: true,
      value: { wikipediaLanguage: "en", dubbingLanguage: "en-US" },
    });
  });

  it("treats different regional targets as distinct work for one source", () => {
    const france = validateCheckPayload({
      tmdb_id: 1,
      media_type: "movie",
      wikipedia_language: "fr",
      dubbing_language: "fr-FR",
    });
    const canada = validateCheckPayload({
      tmdb_id: 1,
      media_type: "movie",
      wikipedia_language: "fr",
      dubbing_language: "fr-CA",
    });

    expect(france).toMatchObject({
      ok: true,
      value: { wikipediaLanguage: "fr", dubbingLanguage: "fr-FR" },
    });
    expect(canada).toMatchObject({
      ok: true,
      value: { wikipediaLanguage: "fr", dubbingLanguage: "fr-CA" },
    });
  });
});

describe("queue requester provenance", () => {
  const requester = "11111111-1111-4111-8111-111111111111";

  it("preserves only a valid UUID and keeps missing or malformed requesters null", () => {
    expect(queueRequester(requester)).toBe(requester);
    expect(queueRequester(null)).toBeNull();
    expect(queueRequester(undefined)).toBeNull();
    expect(queueRequester("worker-user")).toBeNull();
    expect(queueRequester("11111111-1111-4111-8111-11111111111x")).toBeNull();
    expect(queueRequesterRpcArgs(requester)).toEqual({
      p_requested_by: requester,
    });
    expect(queueRequesterRpcArgs(null)).toEqual({});
    expect(queueRequesterRpcArgs("worker-user")).toEqual({});
  });

  it("carries the requester through discovery, check, and extract validation", () => {
    const payload = {
      tmdb_id: 12,
      media_type: "movie",
      wikipedia_language: "en",
      dubbing_language: "en-US",
      requested_by: requester,
      page_id: 2,
      section_indexes: [1],
    };

    expect(validateDiscoveryPayload(payload)).toMatchObject({
      ok: true,
      value: { requestedBy: requester },
    });
    expect(validateCheckPayload(payload)).toMatchObject({
      ok: true,
      value: { requestedBy: requester },
    });
    expect(validateExtractPayload(payload)).toMatchObject({
      ok: true,
      value: { requestedBy: requester },
    });
  });

  it("normalizes an invalid requester to null rather than inventing one", () => {
    expect(
      validateDiscoveryPayload({
        tmdb_id: 12,
        media_type: "movie",
        requested_by: "queue-worker",
      }),
    ).toMatchObject({ ok: true, value: { requestedBy: null } });
  });
});
