import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DUBBING_LANGUAGES, validateDubbingLanguage } from "@app/shared-logic";
import { requireDubbingLanguage } from "./dubbing-language";
import {
  extractMediaDubbingCredits,
  extractGameDubbingCredits,
} from "./services/media-preparation";

it("keeps the SQL language rule and TypeScript registry aligned", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "../../packages/database/supabase/migrations/20260926120000_schema_owned_dubbing_language_rule.sql",
    ),
    "utf8",
  );
  const supportedCodes = migration.match(/ARRAY\[([\s\S]*?)\]::text\[\]/)?.[1] ?? "";
  const codes = Array.from(supportedCodes.matchAll(/'([a-z]{2,3}-[A-Z]{2})'/g), (match) =>
    String(match[1]),
  );

  expect([...new Set(codes)].sort()).toEqual([...DUBBING_LANGUAGES].sort());
});

it("registers every target used by the legacy language mapping", () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      "../../packages/database/supabase/migrations/20260926130158_map_legacy_dubbing_project_regions.sql",
    ),
    "utf8",
  );
  const mappings = migration.match(/SELECT \* FROM \(VALUES([\s\S]*?)\)\s+AS languages\(/)?.[1];
  const languageRule = readFileSync(
    resolve(
      process.cwd(),
      "../../packages/database/supabase/migrations/20260926120000_schema_owned_dubbing_language_rule.sql",
    ),
    "utf8",
  );
  const supportedCodes = languageRule.match(/ARRAY\[([\s\S]*?)\]::text\[\]/)?.[1] ?? "";

  expect(mappings).toBeDefined();

  const mappingTargets = Array.from(
    (mappings ?? "").matchAll(/\(\s*'[^']+'\s*,\s*'([^']+)'\s*\)/g),
    (match) => String(match[1]),
  );
  const sqlLanguages = Array.from(supportedCodes.matchAll(/'([a-z]{2,3}-[A-Z]{2})'/g), (match) =>
    String(match[1]),
  );

  expect(mappingTargets.length).toBeGreaterThan(0);
  for (const target of mappingTargets) {
    expect(DUBBING_LANGUAGES, `TypeScript registry is missing ${target}`).toContain(target);
    expect(sqlLanguages, `Database language rule is missing ${target}`).toContain(target);
  }
});

describe("dubbing language validation", () => {
  it.each(DUBBING_LANGUAGES)("accepts registered regional code %s", (code) => {
    expect(validateDubbingLanguage(code)).toBe(code);
    expect(requireDubbingLanguage(code)).toBe(code);
  });
  it.each(["fr", "de", "simple", "fr-Fr", "FR-fr", "zz-ZZ", "fr-FR ", null, undefined])(
    "rejects %s at the server boundary",
    (value) => {
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
