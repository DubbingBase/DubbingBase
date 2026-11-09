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

// Movie and show are thin wrappers around the one shared TMDB editor.
const sharedEditors: Record<string, string> = {
  "MovieProjectEditor.vue": "TmdbProjectEditor.vue",
  "ShowProjectEditor.vue": "TmdbProjectEditor.vue",
};
const readSource = (relativePath: string): string =>
  readFileSync(resolve(import.meta.dirname, relativePath), "utf8");
// Layout, crew/settings cards and pickers shared by every editor.
const sharedParts = [
  "../ProjectEditorLayout.vue",
  "../ProjectCrewCard.vue",
  "../ProjectSettingsCard.vue",
  "../CastVoiceActorField.vue",
  "../SimpleCastRoleDetail.vue",
  "../../../composables/useSimpleCastWorkspace.ts",
]
  .map(readSource)
  .join("\n");
const editorSource = (name: string): string =>
  readSource(sharedEditors[name] ?? name) + sharedParts;

// Editors that render their cast through the shared workspace delegate row keys and removal to it.
const workspaceSource = readFileSync(
  resolve(import.meta.dirname, "../ProjectCastWorkspace.vue"),
  "utf8",
);
const castSource = (name: string): string => editorSource(name) + workspaceSource;

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

      expect(source).toMatch(/work\(\*, voice_actors\(firstname, lastname(, profile_picture)?\)\)/);
      expect(source).toContain("works = proj.work || []");
      expect(source).toContain("loadError");
    },
  );

  it.each(["MovieProjectEditor.vue", "ShowProjectEditor.vue", "GameProjectEditor.vue"])(
    "normalizes status, locks save refresh, and clears omitted crew in %s",
    (name) => {
      const source = editorSource(name);

      expect(source).toContain(':inert="form.isSaving.value"');
      expect(source).toContain("await refreshProject();");
      expect(source).toContain(
        "status.value = getEditableDubbingProjectStatus(data.project.status);",
      );

      // Roles absent from the reloaded crew are cleared by the shared crew state (unit tested).
      expect(source).toContain("crewState.load(data.crew ?? [])");
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
    expect(source).toMatch(/removeCastRow\(row\.key\)|emit\('remove', (?:selected)?[rR]ow\.key\)/);
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
