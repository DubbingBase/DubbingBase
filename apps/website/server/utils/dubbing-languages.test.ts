import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { DUBBING_LANGUAGES, validateDubbingLanguage } from "@app/shared-logic";
import { requireDubbingLanguage } from "./dubbing-language";
import {
  extractMediaDubbingCredits,
  extractGameDubbingCredits,
} from "./services/media-preparation";

it("keeps the database seed and website registry aligned", () => {
  const migrationDirectory = resolve(
    process.cwd(),
    "../../packages/database/supabase/migrations",
  );
  const migrations = readdirSync(migrationDirectory)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => readFileSync(resolve(migrationDirectory, file), "utf8"));
  const codes = migrations.flatMap((migration) => {
    const seed = migration
      .split("INSERT INTO public.dubbing_languages(code) VALUES")[1]
      ?.split(";")[0];
    if (!seed) return [];
    return Array.from(seed.matchAll(/'([a-z]{2,3}-[A-Z]{2})'/g), (match) =>
      String(match[1]),
    );
  });
  expect([...new Set(codes)].sort()).toEqual([...DUBBING_LANGUAGES].sort());
});

describe("dubbing language validation", () => {
  it.each(DUBBING_LANGUAGES)("accepts registered regional code %s", (code) => {
    expect(validateDubbingLanguage(code)).toBe(code);
    expect(requireDubbingLanguage(code)).toBe(code);
  });
  it.each([
    "fr",
    "de",
    "simple",
    "fr-Fr",
    "FR-fr",
    "zz-ZZ",
    "fr-FR ",
    null,
    undefined,
  ])("rejects %s at the server boundary", (value) => {
    expect(() => requireDubbingLanguage(value)).toThrow();
    expect(() => validateDubbingLanguage(value)).toThrow();
  });
});

it("does not fetch, call an LLM, or create credits for source-only extraction", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  try {
    const movie = await extractMediaDubbingCredits({
      tmdbId: 1,
      type: "movie",
      language: "fr",
      pageId: 2,
      sectionIndexes: [1],
    });
    const game = await extractGameDubbingCredits({
      igdbId: 1,
      language: "de",
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
