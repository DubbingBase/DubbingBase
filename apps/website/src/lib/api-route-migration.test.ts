import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const websiteRoot = resolve(import.meta.dirname, "../..");

const readWebsiteSource = (relativePath: string): string =>
  readFileSync(resolve(websiteRoot, relativePath), "utf8");

describe("canonical GET API consumers", () => {
  it("uses query params for the admin voice actor spreadsheet", () => {
    const source = readWebsiteSource(
      "src/pages/admin/voice-actor-spreadsheet.vue",
    );

    expect(source).toMatch(
      /['"]\/api\/list-voice-actors['"][\s\S]{0,300}params:\s*\{\s*limit:\s*limit\.value,\s*offset:/,
    );
    expect(source).not.toMatch(
      /['"]\/api\/list-voice-actors['"][\s\S]{0,300}method:\s*['"]POST['"]/,
    );
  });

  it("uses query params for the admin voice actor search", () => {
    const source = readWebsiteSource("src/pages/admin/user-va-profiles.vue");

    expect(source).toMatch(
      /['"]\/api\/search-voice-actors['"][\s\S]{0,300}params:\s*\{\s*query,\s*limit:\s*10\s*\}/,
    );
    expect(source).not.toMatch(
      /['"]\/api\/search-voice-actors['"][\s\S]{0,300}method:\s*['"]POST['"]/,
    );
  });

  it("loads movie and show editor metadata through dynamic-id GET routes", () => {
    const movieEditor = readWebsiteSource(
      "src/components/admin/editors/MovieProjectEditor.vue",
    );
    const showEditor = readWebsiteSource(
      "src/components/admin/editors/ShowProjectEditor.vue",
    );

    expect(movieEditor).toContain("`/api/movie/${tmdbMovieId.value}`");
    expect(movieEditor).not.toContain('"/api/movie",');
    expect(showEditor).toContain("`/api/show/${tmdbShowId.value}`");
    expect(showEditor).not.toContain('"/api/show",');
  });
});

describe("retired legacy API route files", () => {
  it.each([
    "server/api/list-voice-actors.post.ts",
    "server/api/search-voice-actors.post.ts",
    "server/api/movie/index.get.ts",
    "server/api/movie/index.post.ts",
    "server/api/show/index.get.ts",
    "server/api/show/index.post.ts",
  ])("does not keep the legacy %s handler", (relativePath) => {
    expect(existsSync(resolve(websiteRoot, relativePath))).toBe(false);
  });

  it("keeps bulk voice actor work counts on POST", () => {
    expect(
      existsSync(
        resolve(websiteRoot, "server/api/count-voice-actor-works.post.ts"),
      ),
    ).toBe(true);
  });
});
