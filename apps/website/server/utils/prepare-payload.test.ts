import { describe, expect, it, vi } from "vitest";
import {
  prepareGameFromPayload,
  validatePrepareGamePayload,
  validatePrepareMediaPayload,
} from "./prepare-payload";

describe("prepare_game request contract", () => {
  it("requires a Wikipedia source language", () => {
    expect(
      validatePrepareGamePayload({ igdbId: 42, dubbing_language: "fr-FR" }),
    ).toEqual({
      ok: false,
      reason: "A valid Wikipedia source language is required",
    });
  });

  it("rejects invalid Wikipedia identifiers", () => {
    expect(
      validatePrepareGamePayload({
        igdbId: 42,
        wikipedia_language: "FR-fr",
        dubbing_language: "fr-FR",
      }).ok,
    ).toBe(false);
  });

  it("requires a registered regional dubbing target", () => {
    expect(
      validatePrepareGamePayload({ igdbId: 42, wikipedia_language: "simple" }),
    ).toEqual({
      ok: false,
      reason: "A registered regional dubbing language is required",
    });
    expect(
      validatePrepareGamePayload({
        igdbId: 42,
        wikipedia_language: "simple",
        dubbing_language: "fr",
      }).ok,
    ).toBe(false);
  });

  it("keeps the Wikipedia source and dubbing target distinct", () => {
    expect(
      validatePrepareGamePayload({
        igdbId: 42,
        wikipedia_language: "simple",
        dubbing_language: "en-US",
      }),
    ).toEqual({
      ok: true,
      value: {
        igdbId: 42,
        wikipediaLanguage: "simple",
        dubbingLanguage: "en-US",
      },
    });
  });

  it("passes both distinct language values into game preparation", async () => {
    const prepare = vi.fn(async () => ({ ok: true }));
    const result = await prepareGameFromPayload(
      {
        igdbId: 42,
        wikipedia_language: "simple",
        dubbing_language: "en-US",
      },
      prepare,
    );

    expect(result).toEqual({ ok: true, value: { ok: true } });
    expect(prepare).toHaveBeenCalledWith({
      igdbId: 42,
      wikipediaLanguage: "simple",
      dubbingLanguage: "en-US",
    });
  });

  it("treats the deprecated language property only as the Wikipedia source", () => {
    expect(
      validatePrepareGamePayload({
        igdbId: 42,
        language: "simple",
        dubbing_language: "en-US",
      }),
    ).toMatchObject({
      ok: true,
      value: { wikipediaLanguage: "simple", dubbingLanguage: "en-US" },
    });
  });
});

describe("prepare_media request contract", () => {
  it("requires both source and regional target", () => {
    expect(validatePrepareMediaPayload({ tmdbId: 42, type: "movie" }).ok).toBe(
      false,
    );
    expect(
      validatePrepareMediaPayload({
        tmdbId: 42,
        type: "movie",
        wikipedia_language: "simple",
        dubbing_language: "en-US",
      }),
    ).toMatchObject({
      ok: true,
      value: {
        wikipediaLanguage: "simple",
        dubbingLanguage: "en-US",
      },
    });
  });
});
