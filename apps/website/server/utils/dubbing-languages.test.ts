import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DUBBING_LANGUAGE_OPTIONS,
  displayDubbingLanguage,
  isDubbingLanguage,
  validateDubbingLanguage,
} from "@app/shared-logic";
import { requireDubbingLanguage } from "./dubbing-language";
import {
  extractMediaDubbingCredits,
  extractGameDubbingCredits,
} from "./services/media-preparation";

describe("dubbing language validation", () => {
  it.each(["fr-FR", "fr-CA", "ko-KR"])("accepts supported region %s", (code) => {
    expect(isDubbingLanguage(code)).toBe(true);
    expect(validateDubbingLanguage(code)).toBe(code);
    expect(requireDubbingLanguage(code)).toBe(code);
  });
  it.each(["zz-ZZ", "fr", "fr_fr", "FR-fr", "fr-FRA", "fr-FR ", null, undefined])(
    "rejects unsupported region %s at the server boundary",
    (value) => {
      expect(isDubbingLanguage(value)).toBe(false);
      expect(() => requireDubbingLanguage(value)).toThrow();
      expect(() => validateDubbingLanguage(value)).toThrow();
    },
  );

  it("keeps the SQL-supported regions aligned with the shared TypeScript list", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "../../packages/database/supabase/migrations/20260926130158_map_legacy_dubbing_project_regions.sql",
      ),
      "utf8",
    );
    const helper = migration.match(
      /CREATE OR REPLACE FUNCTION public\.is_valid_dubbing_language\(p_language text\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/i,
    )?.[1];
    expect(helper).toBeDefined();
    const sqlLanguages = [...(helper ?? "").matchAll(/'([a-z]{2,3}-[A-Z]{2})'/g)].map(
      (match) => match[1],
    );
    expect(sqlLanguages).toEqual([...DUBBING_LANGUAGE_OPTIONS]);
  });
});

describe("displayDubbingLanguage", () => {
  it("keeps displaying names in the requested locale", () => {
    expect(displayDubbingLanguage("fr-FR", "en")).toBe("French (France)");
    expect(displayDubbingLanguage("fr-FR", "fr")).toBe("Français (France)");
  });

  it("preserves every supported language label", () => {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    for (const code of DUBBING_LANGUAGE_OPTIONS) {
      const name = displayNames.of(code);
      const expected = name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
      expect(displayDubbingLanguage(code, "en")).toBe(expected);
    }
  });

  it("returns the language code when the locale is invalid", () => {
    expect(displayDubbingLanguage("fr-FR", "en_US")).toBe("fr-FR");
  });

  it("preserves the existing capitalization fallback for unknown language codes", () => {
    expect(displayDubbingLanguage("zz-ZZ", "en")).toBe("Zz (Unknown Region)");
  });
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
      error: "Regional dubbing language is required for extraction",
    });
    expect(game).toMatchObject({
      ok: false,
      creditsAdded: 0,
      error: "Regional dubbing language is required for extraction",
    });
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});
