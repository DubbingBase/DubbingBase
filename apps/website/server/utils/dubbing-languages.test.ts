import { describe, expect, it, vi } from "vitest";
import { isDubbingLanguage, validateDubbingLanguage } from "@app/shared-logic";
import { requireDubbingLanguage } from "./dubbing-language";
import {
  extractMediaDubbingCredits,
  extractGameDubbingCredits,
} from "./services/media-preparation";

describe("dubbing language validation", () => {
  it.each(["fr-FR", "gsw-CH", "yue-HK", "zz-ZZ"])("accepts regional format %s", (code) => {
    expect(isDubbingLanguage(code)).toBe(true);
    expect(validateDubbingLanguage(code)).toBe(code);
    expect(requireDubbingLanguage(code)).toBe(code);
  });
  it.each(["fr", "fr_fr", "FR-fr", "fr-FRA", "fr-FR ", null, undefined])(
    "rejects %s at the server boundary",
    (value) => {
      expect(isDubbingLanguage(value)).toBe(false);
      expect(() => requireDubbingLanguage(value)).toThrow();
      expect(() => validateDubbingLanguage(value)).toThrow();
    },
  );
});

it("does not fetch, call an LLM, or create credits for source-only extraction", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  try {
    const movie = await extractMediaDubbingCredits({
      tmdbId: 1,
      type: "movie",
      wikipediaLanguage: "fr",
      pageId: 2,
      sectionIndexes: [1],
    });
    const game = await extractGameDubbingCredits({
      igdbId: 1,
      wikipediaLanguage: "de",
      pageId: 2,
      sectionIndexes: [1],
    });
    expect(movie).toMatchObject({
      ok: false,
      creditsAdded: 0,
      error: "Regional dubbing language requires review",
    });
    expect(game).toMatchObject({
      ok: false,
      creditsAdded: 0,
      error: "Regional dubbing language requires review",
    });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
