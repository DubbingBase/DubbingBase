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

// Editors that render their cast through the shared workspace delegate row keys and removal to it.
const workspaceSource = readFileSync(
  resolve(import.meta.dirname, "../ProjectCastWorkspace.vue"),
  "utf8",
);
const castSource = (name: string): string =>
  name === "MovieProjectEditor.vue" ? editorSource(name) + workspaceSource : editorSource(name);

describe("admin project editors", () => {
  it.each(editorNames)("uses Nuxt's registered controls in %s", (name) => {
    const source = editorSource(name);

    expect(source).toContain("<AdminAsyncAutocomplete");
    expect(source).not.toContain("<AsyncAutocomplete");
    expect(source).toContain("<AdminLanguageSelect");
    expect(source).not.toContain("<LanguageSelect");
  });

  it.each(["MovieProjectEditor.vue", "ShowProjectEditor.vue", "GameProjectEditor.vue"])(
    "loads stored voice-cast assignments through the dubbing project in %s",
    (name) => {
      const source = editorSource(name);

      expect(source).toContain("work(*, voice_actors(firstname, lastname))");
      expect(source).toContain("works = proj.work || []");
      expect(source).toContain("loadError");
    },
  );

  it.each(["MovieProjectEditor.vue", "ShowProjectEditor.vue", "GameProjectEditor.vue"])(
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

  it("serializes game cast through the refresh-safe role mapper", () => {
    const source = editorSource("GameProjectEditor.vue");

    expect(source).toContain("serializeGameProjectCastRows(castRows.value)");
  });

  it.each(editorNames)("uses stable row keys, never array indexes, in %s", (name) => {
    const source = castSource(name);

    expect(source).not.toMatch(/:key="index"/);
    expect(source).toContain(':key="row.key"');
    expect(source).toContain("createEditorRowKey()");
    expect(source).toMatch(/removeCastRow\(row\.key\)|emit\('remove', row\.key\)/);
    expect(source).not.toMatch(/removeCastRow\(index\)/);
  });

  it.each(editorNames)("keeps row removal visible and labelled in %s", (name) => {
    const source = castSource(name);

    expect(source).not.toContain("opacity-0 group-hover:opacity-100");
    expect(source).toContain("projectEditor.removeCastRow");
    expect(source).toContain('data-testid="remove-cast-row"');
  });

  it.each(editorNames)(
    "maps selected ids to labels and owns lookup state per autocomplete in %s",
    (name) => {
      const source = editorSource(name);

      // The autocomplete passes ids to displayFn; (opt) => opt.name contracts are gone.
      expect(source).toContain(':display-fn="lookups.voiceActorLabel"');
      expect(source).toContain(':display-fn="lookups.studioLabel"');
      expect(source).toContain(':search-fn="lookups.searchVoiceActors"');
      expect(source).toContain(':search-fn="lookups.searchStudios"');
      expect(source).not.toMatch(/opt\?*\.name/);
      expect(source).not.toContain("isSearchingVoiceActors");
      expect(source).not.toContain("voiceActorOptions.value =");
    },
  );

  it.each(editorNames)("uses non-native dialogs for inline creation in %s", (name) => {
    const source = editorSource(name);

    expect(source).not.toMatch(/\bprompt\(/);
    expect(source).not.toMatch(/\balert\(/);
    expect(source).toContain("<AdminCreateStudioDialog");
    expect(source).toContain("<AdminCreateVoiceActorDialog");
  });

  it.each(editorNames)(
    "wires the sticky save bar, save state machine and leave guard in %s",
    (name) => {
      const source = editorSource(name);

      expect(source).toContain("<AdminEditorSaveBar");
      expect(source).toContain("<AdminUnsavedChangesDialog");
      expect(source).toContain("useEditorFormState(");
      expect(source).toContain("form.beginSave()");
      expect(source).toContain("form.saveSucceeded()");
      expect(source).toContain("form.saveFailed(");
      expect(source).toContain("form.markClean()");
      // A failed save must not mark the form clean or discard input.
      const failedIndex = source.indexOf("form.saveFailed(");
      const catchIndex = source.lastIndexOf("catch", failedIndex);
      expect(source.slice(catchIndex, failedIndex)).not.toContain("saveSucceeded");
    },
  );
});
