import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const editorNames = [
  "MovieProjectEditor.vue",
  "ShowProjectEditor.vue",
  "GameProjectEditor.vue",
  "AudiobookProjectEditor.vue",
  "ToyProjectEditor.vue",
  "AdvertisementProjectEditor.vue",
  "PodcastProjectEditor.vue",
];

const editorSource = (name: string): string =>
  readFileSync(resolve(import.meta.dirname, name), "utf8");

describe("admin project editors", () => {
  it.each(editorNames)("uses Nuxt's registered controls in %s", (name) => {
    const source = editorSource(name);

    expect(source).toContain("<AdminAsyncAutocomplete");
    expect(source).not.toContain("<AsyncAutocomplete");
    expect(source).toContain("<AdminLanguageSelect");
    expect(source).not.toContain("<LanguageSelect");
  });

  it.each([
    "MovieProjectEditor.vue",
    "ShowProjectEditor.vue",
    "GameProjectEditor.vue",
  ])(
    "loads stored voice-cast assignments through the dubbing project in %s",
    (name) => {
      const source = editorSource(name);

      expect(source).toContain("work(*, voice_actors(firstname, lastname))");
      expect(source).toContain("works = proj.work || []");
      expect(source).toContain("loadError");
    },
  );

  it.each([
    "MovieProjectEditor.vue",
    "ShowProjectEditor.vue",
    "GameProjectEditor.vue",
  ])(
    "normalizes status, locks save refresh, and clears omitted crew in %s",
    (name) => {
      const source = editorSource(name);

      expect(source).toContain(':inert="isSaving"');
      expect(source).toContain("await refreshProject();");
      expect(source).toContain(
        "status.value = getEditableDubbingProjectStatus(data.project.status);",
      );

      const crewFields = [
        "artisticDirectorId",
        "adaptationId",
        "recordingId",
        "editingId",
        "mixingId",
        "projectManagerId",
        "creativeSupervisionId",
      ];
      const crewRows = source.indexOf("if (data.crew)");

      for (const field of crewFields) {
        const resetIndex = source.indexOf(`${field}.value = null;`);
        expect(resetIndex).toBeGreaterThanOrEqual(0);
        expect(crewRows).toBeGreaterThan(resetIndex);
      }
    },
  );
});
