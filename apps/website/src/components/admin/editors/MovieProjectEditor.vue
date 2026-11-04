<template>
  <div
    class="admin-project-editor mx-auto max-w-6xl space-y-4 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-8"
    :inert="isSaving"
    :aria-busy="isSaving"
  >
    <AdminEditorHero
      :title="mediaTitle || $t('projectEditor.createMovieProject')"
      :eyebrow="
        isEditMode ? $t('projectEditor.editMovieProject') : $t('projectEditor.createMovieProject')
      "
      :poster-url="posterUrl"
      :back-to="tmdbMovieId ? localePath(`/movie/${tmdbMovieId}`) : localePath('/')"
      :back-label="
        (tmdbMovieId ? $t('projectEditor.backToMovie') : $t('projectEditor.backHome')).replace(
          /^←\s*/,
          '',
        )
      "
      :chips="heroChips"
    >
      <!-- Language switcher: one chip per dubbing project of this movie -->
      <nav
        v-if="tmdbMovieId"
        class="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5"
        :aria-label="$t('projectEditor.dubbingLanguage')"
      >
        <NuxtLink
          v-for="project in movieDubbingProjects"
          :key="project.id"
          :to="localePath(`/movie/${tmdbMovieId}/projects/${project.id}/edit`)"
          class="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors"
          :class="
            project.id === Number(projectIdParam)
              ? 'theme-primary-bg theme-primary-border'
              : 'theme-surface-overlay theme-text-secondary theme-border theme-hover-surface-muted'
          "
        >
          {{ getDisplayLanguage(project.language) }}
          <span v-if="project.studios?.name" class="text-xs opacity-75">{{
            project.studios.name
          }}</span>
        </NuxtLink>
        <NuxtLink
          :to="localePath(`/movie/${tmdbMovieId}/projects/new`)"
          class="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-dashed px-4 text-sm font-medium transition-colors"
          :class="
            projectIdParam === 'new'
              ? 'theme-status-info theme-status-info-text'
              : 'theme-text-muted theme-border theme-hover-surface-muted theme-hover-text'
          "
        >
          <PlusIcon class="h-4 w-4" aria-hidden="true" />
          {{ $t("projectEditor.addLanguage") }}
        </NuxtLink>
      </nav>
    </AdminEditorHero>

    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center gap-4 py-24 theme-text-muted"
    >
      <Loader2Icon class="h-8 w-8 animate-spin theme-status-info-text" />
      <span class="text-sm">{{ $t("projectEditor.loadingData") }}</span>
    </div>

    <div
      v-else-if="loadError"
      role="alert"
      class="rounded-xl border border-[var(--app-color-danger-border)] theme-status-danger p-6 text-sm theme-status-danger-text"
    >
      {{ loadError }}
    </div>

    <template v-else>
      <AdminEditorTabs
        v-model="section"
        :items="sections"
        :nav-label="$t('projectEditor.sectionNav')"
      />

      <!-- Sections stay mounted (v-show) so unsaved edits are never lost when switching. -->
      <form
        id="movie-project-form"
        novalidate
        class="min-w-0 space-y-4 sm:space-y-6"
        @submit.prevent="saveMovieProject"
      >
        <!-- Cast first: the main job of this editor is assigning voices -->
        <div v-show="section === 'cast'">
          <AdminProjectCastWorkspace
            v-model:selected-key="selectedCastKey"
            :rows="castView"
            @add="addCastRow"
            @remove="removeCastRow"
          >
            <template #detail>
              <div v-if="selectedRow" :key="selectedRow.key" class="space-y-5">
                <AdminFormField :label="$t('projectEditor.voiceActor')">
                  <AdminAsyncAutocomplete
                    v-model="selectedRow.voice_actor_id"
                    :options="initialVoiceActorOptions"
                    :search-fn="lookups.searchVoiceActors"
                    placeholder="Search Voice Actor..."
                    :allow-create="true"
                    :display-fn="lookups.voiceActorLabel"
                    @create="
                      (q: string) =>
                        openCreateVaDialog(q, (id: number) => (selectedRow!.voice_actor_id = id))
                    "
                  >
                    <template #option="{ option }"
                      ><span class="flex items-center gap-2"
                        ><AdminCastAvatar :name="option.name" :src="option.image ?? null" />{{
                          option.name
                        }}</span
                      ></template
                    >
                  </AdminAsyncAutocomplete>
                </AdminFormField>

                <fieldset class="space-y-1.5">
                  <legend class="text-xs font-semibold theme-text-secondary">
                    {{ $t("projectEditor.performanceType") }}
                  </legend>
                  <div class="-mx-1 flex flex-wrap gap-2 px-1" role="radiogroup">
                    <button
                      v-for="option in performanceOptions"
                      :key="option.value"
                      type="button"
                      role="radio"
                      :aria-checked="selectedRow.performance === option.value"
                      class="min-h-10 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
                      :class="
                        selectedRow.performance === option.value
                          ? 'theme-status-info theme-status-info-text border-[var(--app-color-focus)]'
                          : 'theme-border theme-surface-overlay theme-text-secondary theme-hover-surface-muted'
                      "
                      @click="selectedRow.performance = option.value"
                    >
                      {{ option.label }}
                    </button>
                  </div>
                </fieldset>

                <AdminFormField :label="$t('projectEditor.castNote')" for-id="cast-detail-note">
                  <input
                    id="cast-detail-note"
                    v-model="selectedRow.note"
                    type="text"
                    enterkeyhint="done"
                    class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
                  />
                </AdminFormField>

                <label
                  class="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border theme-border theme-surface-overlay px-4 text-sm theme-text-secondary"
                >
                  <span class="flex items-center gap-2">
                    <StarIcon class="h-4 w-4 text-[var(--app-color-rating)]" aria-hidden="true" />
                    {{ $t("projectEditor.highlightCharacter") }}
                  </span>
                  <input
                    v-model="selectedRow.highlight"
                    type="checkbox"
                    class="h-5 w-5 rounded accent-[var(--app-color-primary)]"
                  />
                </label>

                <details class="group rounded-xl border theme-border">
                  <summary
                    class="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold theme-text-secondary [&::-webkit-details-marker]:hidden"
                  >
                    {{ $t("projectEditor.castAdvanced") }}
                    <ChevronDownIcon
                      class="h-4 w-4 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <div class="space-y-5 border-t theme-border p-4">
                    <AdminFormField
                      :label="$t('projectEditor.castCharacterName')"
                      for-id="cast-detail-character"
                    >
                      <input
                        id="cast-detail-character"
                        v-model="selectedRow.character_name"
                        type="text"
                        class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
                      />
                    </AdminFormField>
                    <AdminFormField :label="$t('projectEditor.originalActorCharacter')">
                      <AdminAsyncAutocomplete
                        v-model="selectedRow.actor_id"
                        :options="initialTmdbCastOptions"
                        :search-fn="searchActors"
                        placeholder="Search TMDB Cast..."
                        :allow-create="true"
                        :display-fn="
                          (id: string | number) => getActorName(id) || selectedRow!.character_name
                        "
                        @update:model-value="
                          (val: string | number | null) => handleActorSelect(selectedRow!, val)
                        "
                        @create="(query: string) => handleActorCreate(selectedRow!, query)"
                      >
                        <template #option="{ option }"
                          ><span class="flex items-center gap-2"
                            ><AdminCastAvatar
                              :name="option.name"
                              :src="tmdbProfileUrl(option.profile_path)"
                            />{{ getActorName(option.id) }}</span
                          ></template
                        >
                      </AdminAsyncAutocomplete>
                    </AdminFormField>
                  </div>
                </details>
              </div>
            </template>
          </AdminProjectCastWorkspace>
        </div>

        <AdminFormCard
          v-show="section === 'overview'"
          :title="$t('admin.movieEditor.mediaInfo')"
          :description="$t('admin.movieEditor.tmdbLinked')"
        >
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <AdminFormField :label="$t('projectEditor.tmdbMovieId')" for-id="movie-project-tmdb-id">
              <input
                id="movie-project-tmdb-id"
                v-model.number="contentId"
                type="number"
                inputmode="numeric"
                required
                :disabled="!!tmdbMovieId"
                placeholder="e.g. 1020"
                class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </AdminFormField>
            <AdminFormField
              :label="$t('admin.movieEditor.mediaTitle')"
              for-id="movie-project-title"
            >
              <input
                id="movie-project-title"
                v-model="mediaTitle"
                type="text"
                required
                readonly
                class="h-11 w-full cursor-not-allowed rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text opacity-60"
              />
            </AdminFormField>
          </div>
        </AdminFormCard>

        <AdminFormCard v-show="section === 'settings'" :title="$t('projectEditor.sectionSettings')">
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <AdminFormField
              :label="$t('projectEditor.dubbingLanguage')"
              for-id="movie-project-dubbing-language"
            >
              <AdminLanguageSelect
                id="movie-project-dubbing-language"
                v-model="dubbingLanguage"
                required
              />
            </AdminFormField>
            <AdminFormField :label="$t('common.status')" for-id="movie-project-status">
              <select
                id="movie-project-status"
                v-model="status"
                class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
              >
                <option value="validated">{{ $t("admin.movieEditor.validated") }}</option>
                <option value="pending">{{ $t("admin.movieEditor.pending") }}</option>
                <option value="draft">{{ $t("admin.movieEditor.draft") }}</option>
              </select>
            </AdminFormField>
          </div>
        </AdminFormCard>

        <AdminFormCard
          v-show="section === 'crew'"
          :title="$t('admin.movieEditor.technicalDubbingTeam')"
          :description="$t('admin.movieEditor.crewAttributes')"
        >
          <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
            <AdminFormField :label="$t('details.dubbingStudio')">
              <AdminAsyncAutocomplete
                v-model="selectedStudioId"
                :options="initialStudioOptions"
                :search-fn="lookups.searchStudios"
                placeholder="Search studio..."
                :allow-create="true"
                :display-fn="lookups.studioLabel"
                @create="
                  (q: string) => openCreateStudioDialog(q, (id: number) => (selectedStudioId = id))
                "
              />
            </AdminFormField>

            <AdminFormField v-for="field in crewFields" :key="field.key" :label="field.label">
              <AdminAsyncAutocomplete
                :model-value="crewRefs[field.key].value"
                :options="initialVoiceActorOptions"
                :search-fn="lookups.searchVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="lookups.voiceActorLabel"
                @update:model-value="(val: string | number | null) => setCrewMember(field.key, val)"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => setCrewMember(field.key, id))
                "
              />
            </AdminFormField>
          </div>
        </AdminFormCard>
      </form>
    </template>

    <!-- Inline Create Studio Dialog -->
    <AdminCreateStudioDialog
      v-model:open="isCreateStudioOpen"
      :initial-name="newStudioName"
      :create="lookups.createStudio"
      @created="onStudioCreated"
    />

    <!-- Inline Create Voice Actor Dialog -->
    <AdminCreateVoiceActorDialog
      v-model:open="isCreateVaOpen"
      :initial-query="newVaQuery"
      @created="onVoiceActorCreated"
    />

    <!-- Toast -->
    <div
      v-if="toast.show"
      class="fixed inset-x-4 bottom-24 z-[95] flex max-w-sm flex-col gap-2 rounded-xl border p-4 text-sm shadow-2xl theme-surface-overlay theme-border theme-text sm:inset-x-auto sm:right-6"
      role="status"
    >
      <span>{{ toast.message }}</span>
      <a
        v-if="toast.link"
        :href="toast.link"
        target="_blank"
        class="theme-status-info-text hover:underline"
        >{{ $t("projectEditor.viewDetails") }}</a
      >
    </div>

    <AdminEditorSaveBar
      v-if="!isLoading && !loadError"
      :status="form.status.value"
      :is-dirty="form.isDirty.value"
      :error-message="form.errorMessage.value"
      :save-label="$t('projectEditor.saveMovieProject')"
      form-id="movie-project-form"
      @discard="form.discard"
    />
    <AdminUnsavedChangesDialog
      :open="form.isLeavePromptOpen.value"
      @stay="form.stayOnPage"
      @discard="form.discardAndLeave"
    />
  </div>
</template>

<script setup lang="ts">
import {
  createCharacterMatcher,
  validateDubbingLanguage,
  type MediaDetailCharacterProfilePicture,
} from "@app/shared-logic";
import { ref, onMounted, computed, nextTick, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ChevronDownIcon, Loader2Icon, PlusIcon, StarIcon } from "lucide-vue-next";
import {
  createDubbingProjectSaveClient,
  getDubbingProjectSaveErrorMessage,
  getEditableDubbingProjectStatus,
  type DubbingProjectCastSaveRow,
  type DubbingProjectSaveResponse,
  type WorkExpectedValues,
} from "~/utils/dubbing-project-save";
import { useAdminLookups, type AdminLookupOption } from "~/composables/useAdminLookups";
import { createEditorRowKey, useEditorFormState } from "~/composables/useEditorFormState";
import type {
  EditorProjectCrew,
  EditorProjectRecord,
  EditorProjectTab,
  EditorProjectWork,
  EditorTmdbCastMember,
} from "~/utils/admin-project-editor-types";
import { firstRouteParam } from "~/utils/route-param";
import { pickOriginalCastSeed, type CastWorkspaceRow } from "~/utils/cast-workspace";

useKeyboardInset();
const supabase = useSupabaseClient();
const saveDubbingProject = createDubbingProjectSaveClient((body) =>
  $fetch<DubbingProjectSaveResponse>("/api/save-dubbing-project", {
    method: "POST",
    body,
  }),
);
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const { t } = useI18n();

const movieIdParam = firstRouteParam(route.params.movieId);
const projectIdParam = firstRouteParam(route.params.projectId);

const isEditMode = computed(() => !!projectIdParam && projectIdParam !== "new");
const tmdbMovieId = computed(() =>
  movieIdParam && movieIdParam !== "new" ? Number(movieIdParam) : null,
);

const movieDubbingProjects = ref<EditorProjectTab[]>([]);

// Form state
const contentId = ref<number | null>(null);
const mediaTitle = ref("");
const contentType = ref("movie");
const dubbingLanguage = ref("");
const posterUrl = ref("");
const status = ref<"validated" | "pending" | "draft">("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);

// Crew state
const artisticDirectorId = ref<number | null>(null);
const adaptationId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);
const projectManagerId = ref<number | null>(null);
const creativeSupervisionId = ref<number | null>(null);

// Autocomplete State: each autocomplete owns its search results; labels are cached by id.
const lookups = useAdminLookups();
const initialStudioOptions = ref<AdminLookupOption[]>([]);
const initialVoiceActorOptions = ref<AdminLookupOption[]>([]);

// Dialog State
const isCreateStudioOpen = ref(false);
const newStudioName = ref("");
const isCreateVaOpen = ref(false);
const newVaQuery = ref("");
let pendingStudioSelect: ((id: number) => void) | null = null;
let pendingVaSelect: ((id: number) => void) | null = null;

// Cast Rows
interface CastRow {
  /** Client-only stable identity for keyed rendering and row actions. */
  key: string;
  id?: number;
  actor_id: number | string | null;
  character_name: string;
  voice_actor_id: number | null;
  performance: string;
  note: string;
  highlight: boolean;
  expectedUpdatedAt?: string | null;
  expected?: WorkExpectedValues;
}
const castRows = ref<CastRow[]>([]);

interface TmdbMovieData {
  title: string;
  poster_path?: string | null;
  credits?: { cast?: EditorTmdbCastMember[] };
}

const TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185";

// Toast
const toast = ref({ show: false, message: "", type: "info", link: "" });
const showToast = (message: string, type = "info", link = "") => {
  toast.value = { show: true, message, type, link };
  setTimeout(() => (toast.value.show = false), 5000);
};

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return "Inconnu";
  try {
    const displayNames = new Intl.DisplayNames(["fr"], { type: "language" });
    const name = displayNames.of(langCode);
    return typeof name === "string" && name.length > 0
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch (e) {
    return langCode;
  }
};

// Hero summary chips: language, studio and publication status at a glance.
const heroChips = computed(() =>
  [
    dubbingLanguage.value ? getDisplayLanguage(dubbingLanguage.value) : "",
    selectedStudioId.value ? lookups.studioLabel(selectedStudioId.value) : "",
    t(`admin.movieEditor.${status.value}`),
  ].filter((chip) => chip.length > 0),
);

const performanceOptions = computed(() => [
  { value: "dialogues", label: t("admin.movieEditor.dialogues") },
  { value: "dialogues & chant", label: t("admin.movieEditor.dialoguesAndChant") },
  { value: "chant", label: t("admin.movieEditor.chant") },
  { value: "bruitages", label: t("projectEditor.performanceBruitages") },
  { value: "narration", label: t("projectEditor.performanceNarration") },
]);

type CrewKey =
  | "artisticDirector"
  | "adaptation"
  | "recording"
  | "editing"
  | "mixing"
  | "projectManager"
  | "creativeSupervision";
const crewRefs: Record<CrewKey, Ref<number | null>> = {
  artisticDirector: artisticDirectorId,
  adaptation: adaptationId,
  recording: recordingId,
  editing: editingId,
  mixing: mixingId,
  projectManager: projectManagerId,
  creativeSupervision: creativeSupervisionId,
};
const crewFields = computed<{ key: CrewKey; label: string }[]>(() => [
  { key: "artisticDirector", label: t("admin.movieEditor.artisticDirector") },
  { key: "adaptation", label: t("admin.movieEditor.adaptation") },
  { key: "recording", label: t("admin.movieEditor.soundRecording") },
  { key: "editing", label: t("admin.movieEditor.soundEditing") },
  { key: "mixing", label: t("dubbing.mixing") },
  { key: "projectManager", label: t("admin.movieEditor.projectManager") },
  { key: "creativeSupervision", label: t("admin.movieEditor.creativeSupervision") },
]);
const setCrewMember = (key: CrewKey, value: string | number | null) => {
  crewRefs[key].value = typeof value === "number" ? value : null;
};

// Mobile Chrome: resize the layout (not just the visual viewport) when the keyboard opens.
useHead({
  meta: [
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1, interactive-widget=resizes-content",
    },
  ],
});

const isLoading = ref(true);
const loadError = ref<string | null>(null);

const form = useEditorFormState({
  snapshot: () => ({
    contentId: contentId.value,
    dubbingLanguage: dubbingLanguage.value,
    status: status.value,
    selectedStudioId: selectedStudioId.value,
    crew: {
      artisticDirectorId: artisticDirectorId.value,
      adaptationId: adaptationId.value,
      recordingId: recordingId.value,
      editingId: editingId.value,
      mixingId: mixingId.value,
      projectManagerId: projectManagerId.value,
      creativeSupervisionId: creativeSupervisionId.value,
    },
    castRows: castRows.value,
  }),
  restore: (saved) => {
    contentId.value = saved.contentId;
    dubbingLanguage.value = saved.dubbingLanguage;
    status.value = saved.status;
    selectedStudioId.value = saved.selectedStudioId;
    artisticDirectorId.value = saved.crew.artisticDirectorId;
    adaptationId.value = saved.crew.adaptationId;
    recordingId.value = saved.crew.recordingId;
    editingId.value = saved.crew.editingId;
    mixingId.value = saved.crew.mixingId;
    projectManagerId.value = saved.crew.projectManagerId;
    creativeSupervisionId.value = saved.crew.creativeSupervisionId;
    castRows.value = saved.castRows;
  },
});
const isSaving = form.isSaving;

const addCastRow = () => {
  const key = createEditorRowKey();
  selectedCastKey.value = key;
  section.value = "cast";
  castRows.value.push({
    key,
    actor_id: null,
    character_name: "",
    voice_actor_id: null,
    performance: "dialogues",
    note: "",
    highlight: false,
  });
};
const removeCastRow = (key: string) => {
  castRows.value = castRows.value.filter((row) => row.key !== key);
  if (selectedCastKey.value === key) selectedCastKey.value = null;
};

// Workspace presentation state
type EditorSection = "overview" | "cast" | "crew" | "settings";
const section = ref<EditorSection>("cast");
const sections = computed<{ id: EditorSection; label: string; count: number | null }[]>(() => [
  { id: "cast", label: t("projectEditor.sectionCast"), count: castRows.value.length },
  { id: "overview", label: t("projectEditor.sectionOverview"), count: null },
  { id: "crew", label: t("projectEditor.sectionCrew"), count: null },
  { id: "settings", label: t("projectEditor.sectionSettings"), count: null },
]);
const selectedCastKey = ref<string | null>(null);
const selectedRow = computed(
  () => castRows.value.find((row) => row.key === selectedCastKey.value) ?? null,
);
const characterImageFor = (characterName: string): string | null => {
  if (!characterName) return null;
  const matches = createCharacterMatcher(characterName);
  const match = characterPictures.value.find(
    (picture) => picture.name && picture.image && matches(picture.name),
  );
  return match?.image ?? null;
};
const castView = computed<CastWorkspaceRow[]>(() =>
  castRows.value.map((row) => {
    const actor = tmdbCast.value.find((c) => c.id === row.actor_id);
    // Saved rows may carry only the original actor; the public pages fall back to the TMDB character.
    const characterName = row.character_name || actor?.character?.trim() || "";
    return {
      key: row.key,
      characterName,
      originalActorName: actor?.name ?? "",
      characterImage: characterImageFor(characterName),
      originalActorImage: tmdbProfileUrl(actor?.profile_path),
      voiceActorName: row.voice_actor_id ? lookups.voiceActorLabel(row.voice_actor_id) : "",
      voiceActorImage: lookups.voiceActorImage(row.voice_actor_id),
      assigned: row.voice_actor_id !== null,
      performance: row.performance,
      highlight: row.highlight,
    };
  }),
);

const tmdbCast = ref<EditorTmdbCastMember[]>([]);
const characterPictures = ref<MediaDetailCharacterProfilePicture[]>([]);
const tmdbProfileUrl = (path: string | null | undefined): string | null =>
  path ? (path.startsWith("/") ? `${TMDB_PROFILE_BASE}${path}` : path) : null;
const initialTmdbCastOptions = computed(() => tmdbCast.value.slice(0, 50));

const searchActors = (query: string) => {
  if (!query) return tmdbCast.value.slice(0, 50);
  return tmdbCast.value
    .filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        (c.character && c.character.toLowerCase().includes(query.toLowerCase())),
    )
    .slice(0, 50);
};

const getActorName = (id: number | string | null) => {
  if (!id) return "";
  const actor = tmdbCast.value.find((c) => c.id === id);
  if (!actor) return "";
  return actor.character ? `${actor.name} (${actor.character})` : actor.name;
};

const handleActorSelect = (row: CastRow, val: string | number | null) => {
  const actor = tmdbCast.value.find((c) => c.id === val);
  if (actor) {
    row.character_name = actor.character || "";
  }
};

const handleActorCreate = (row: CastRow, query: string) => {
  const fakeId = `custom_${Date.now()}_${Math.random()}`;
  tmdbCast.value.push({ id: fakeId, name: query, character: query });
  row.actor_id = fakeId; // UI-only id for a custom character
  row.character_name = query;
};

// Inline Creation
const openCreateStudioDialog = (query: string, callback?: (id: number) => void) => {
  newStudioName.value = query;
  pendingStudioSelect = callback || null;
  isCreateStudioOpen.value = true;
};

const onStudioCreated = (studio: AdminLookupOption) => {
  pendingStudioSelect?.(studio.id);
  pendingStudioSelect = null;
  showToast(`Created ${studio.name}`, "success", `/studio/${studio.id}`);
};

const openCreateVaDialog = (query: string, callback?: (id: number) => void) => {
  newVaQuery.value = query;
  pendingVaSelect = callback || null;
  isCreateVaOpen.value = true;
};

const onVoiceActorCreated = (voiceActor: AdminLookupOption) => {
  lookups.rememberVoiceActor(voiceActor.id, voiceActor.name);
  pendingVaSelect?.(voiceActor.id);
  pendingVaSelect = null;
  showToast(`Created ${voiceActor.name}`, "success");
};

const saveMovieProject = async () => {
  if (!contentId.value) return showToast("TMDB ID required", "error");
  if (!dubbingLanguage.value) return showToast("Language required", "error");
  form.beginSave();
  try {
    let projectId = isEditMode.value ? Number(projectIdParam) : null;
    const crew: Array<{ job_id: number; person_id: number }> = [];
    if (artisticDirectorId.value !== null)
      crew.push({ job_id: 1, person_id: artisticDirectorId.value });
    if (adaptationId.value !== null) crew.push({ job_id: 2, person_id: adaptationId.value });
    if (recordingId.value !== null) crew.push({ job_id: 3, person_id: recordingId.value });
    if (editingId.value !== null) crew.push({ job_id: 4, person_id: editingId.value });
    if (mixingId.value !== null) crew.push({ job_id: 5, person_id: mixingId.value });
    if (projectManagerId.value !== null)
      crew.push({ job_id: 6, person_id: projectManagerId.value });
    if (creativeSupervisionId.value !== null)
      crew.push({ job_id: 7, person_id: creativeSupervisionId.value });

    const cast: DubbingProjectCastSaveRow[] = castRows.value.flatMap((row) => {
      if (!row.voice_actor_id && !row.character_name) return [];
      if (
        row.id !== undefined &&
        (row.expected === undefined || row.expectedUpdatedAt === undefined)
      ) {
        throw new Error("Reload this project before saving its cast.");
      }
      const isCustom = typeof row.actor_id === "string" && row.actor_id.startsWith("custom_");
      const savedRow: DubbingProjectCastSaveRow = {
        ...(row.id === undefined
          ? {}
          : {
              id: row.id,
              expected_updated_at: row.expectedUpdatedAt,
              expected: row.expected,
            }),
        actor_id: isCustom || !row.actor_id ? null : Number(row.actor_id),
        character_name: row.character_name || null,
        voice_actor_id: row.voice_actor_id || null,
        performance: row.performance || "dialogues",
        note: row.note || null,
        highlight: row.highlight ? true : false,
      };
      return [savedRow];
    });

    const result = await saveDubbingProject({
      project_id: projectId,
      expected_updated_at: projectId === null ? null : projectUpdatedAt.value,
      project: {
        content_id: contentId.value,
        content_type: "movie",
        language: validateDubbingLanguage(dubbingLanguage.value),
        studio_id: selectedStudioId.value,
        status: status.value,
      },
      crew,
      cast,
    });
    projectId = result.projectId;
    projectUpdatedAt.value = result.updatedAt;

    if (isEditMode.value) {
      await refreshProject();
      // Let the reload watcher apply persisted values before marking them clean.
      await nextTick();
    }
    form.saveSucceeded();
    showToast("Project saved successfully!", "success");
    if (!isEditMode.value && projectId && contentId.value) {
      await router.push(localePath(`/movie/${contentId.value}/projects/${projectId}/edit`));
    }
  } catch (err: unknown) {
    const message = getDubbingProjectSaveErrorMessage(err);
    form.saveFailed(message);
    showToast(message, "error");
  }
};

const {
  data: initialData,
  error: initialDataError,
  refresh: refreshProject,
} = await useAsyncData(
  `movie-edit-${tmdbMovieId.value}-${projectIdParam}`,
  async () => {
    let tmdbData: TmdbMovieData | null = null;
    let characterPictures: MediaDetailCharacterProfilePicture[] = [];
    let projects: EditorProjectTab[] = [];
    let project: EditorProjectRecord | null = null;
    let studioName: string | null = null;
    let crew: EditorProjectCrew[] = [];
    let works: EditorProjectWork[] = [];

    if (tmdbMovieId.value) {
      // TMDB metadata
      try {
        const data = await $fetch<{
          movie?: TmdbMovieData | null;
          characterProfilePictures?: MediaDetailCharacterProfilePicture[];
        }>(`/api/movie/${tmdbMovieId.value}`);
        if (data && data.movie) {
          tmdbData = data.movie;
        }
        characterPictures = data?.characterProfilePictures ?? [];
      } catch (e) {
        console.error("Failed to fetch TMDB data.", e);
      }

      // Fetch all dubbing projects for this movie for the tabs
      const { data: pData } = await supabase
        .from("dubbing_projects")
        .select("id, language, studio_id, studios(name)")
        .eq("content_id", tmdbMovieId.value)
        .eq("content_type", "movie");
      projects = pData || [];
    }

    if (isEditMode.value) {
      const projectId = Number(projectIdParam);
      const { data: proj, error: projectError } = await supabase
        .from("dubbing_projects")
        .select("*, studios(name), work(*, voice_actors(firstname, lastname, profile_picture))")
        .eq("id", projectId)
        .single();
      if (projectError || !proj) throw projectError || new Error("Project not found");
      project = proj;
      studioName = proj.studios?.name || null;
      works = proj.work || [];

      const { data: cData, error: crewError } = await supabase
        .from("dubbing_project_crew")
        .select("job_id, person_id, voice_actors(firstname, lastname)")
        .eq("dubbing_project_id", projectId);
      if (crewError) throw crewError;
      crew = cData || [];
    }

    // Pre-fetch initial dropdown options
    const { data: studiosData } = await supabase.from("studios").select("id, name").limit(10);
    const initialStudios = studiosData || [];

    const { data: vaData } = await supabase
      .from("voice_actors")
      .select("id, firstname, lastname, profile_picture")
      .limit(10);
    const initialVoiceActors = (vaData || []).map((va) => ({
      id: va.id,
      name: `${va.firstname || ""} ${va.lastname || ""}`.trim(),
      image: va.profile_picture,
    }));

    return {
      tmdbData,
      characterPictures,
      projects,
      project,
      studioName,
      crew,
      works,
      initialStudios,
      initialVoiceActors,
    };
  },
  { getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp) },
);

watch(
  [initialData, initialDataError],
  ([data, error]) => {
    if (error) {
      loadError.value = t("common.error");
      isLoading.value = false;
      return;
    }

    if (data) {
      if (data.tmdbData) {
        contentId.value = tmdbMovieId.value;
        mediaTitle.value = data.tmdbData.title;
        let poster = data.tmdbData.poster_path;
        if (poster && poster.startsWith("/")) {
          poster = `https://image.tmdb.org/t/p/w500${poster}`;
        }
        posterUrl.value = poster || "";
        if (data.tmdbData.credits?.cast) {
          tmdbCast.value = data.tmdbData.credits.cast;
        }
      }

      characterPictures.value = data.characterPictures;
      movieDubbingProjects.value = data.projects;

      if (data.project) {
        contentId.value = data.project.content_id;
        contentType.value = data.project.content_type;
        dubbingLanguage.value = data.project.language || "";
        status.value = getEditableDubbingProjectStatus(data.project.status);
        selectedStudioId.value = data.project.studio_id;
        projectUpdatedAt.value = data.project.updated_at;
        if (data.studioName) {
          lookups.rememberStudio(data.project.studio_id, data.studioName);
        }
      }

      artisticDirectorId.value = null;
      adaptationId.value = null;
      recordingId.value = null;
      editingId.value = null;
      mixingId.value = null;
      projectManagerId.value = null;
      creativeSupervisionId.value = null;
      if (data.crew) {
        data.crew.forEach((c) => {
          const name =
            `${c.voice_actors?.firstname || ""} ${c.voice_actors?.lastname || ""}`.trim();
          lookups.rememberVoiceActor(c.person_id, name);
          if (c.job_id === 1) artisticDirectorId.value = c.person_id;
          if (c.job_id === 2) adaptationId.value = c.person_id;
          if (c.job_id === 3) recordingId.value = c.person_id;
          if (c.job_id === 4) editingId.value = c.person_id;
          if (c.job_id === 5) mixingId.value = c.person_id;
          if (c.job_id === 6) projectManagerId.value = c.person_id;
          if (c.job_id === 7) creativeSupervisionId.value = c.person_id;
        });
      }

      if (data.works) {
        const selectedSavedId = selectedRow.value?.id;
        castRows.value = data.works.map((w) => {
          if (w.voice_actors) {
            const name =
              `${w.voice_actors.firstname || ""} ${w.voice_actors.lastname || ""}`.trim();
            lookups.rememberVoiceActor(w.voice_actor_id, name, w.voice_actors.profile_picture);
          }
          return {
            key: createEditorRowKey(),
            id: w.id,
            actor_id: w.actor_id,
            character_name: w.character_name || "",
            voice_actor_id: w.voice_actor_id,
            performance: w.performance || "dialogues",
            note: w.note || "",
            highlight: w.highlight ?? false,
            expectedUpdatedAt: w.updated_at,
            expected: {
              actor_id: w.actor_id,
              character_id: w.character_id,
              character_name: w.character_name,
              voice_actor_id: w.voice_actor_id,
              performance: w.performance,
              note: w.note,
              highlight: w.highlight,
              status: w.status,
            },
          };
        });
        // Row keys are regenerated on reload; keep the same saved row selected.
        selectedCastKey.value =
          castRows.value.find((row) => row.id !== undefined && row.id === selectedSavedId)?.key ??
          null;
        // No local cast yet: start from the original (TMDB) cast so only voice actors remain to assign.
        if (castRows.value.length === 0) {
          castRows.value = pickOriginalCastSeed(tmdbCast.value).map((member) => ({
            key: createEditorRowKey(),
            actor_id: member.id,
            character_name: member.character?.trim() ?? "",
            voice_actor_id: null,
            performance: "dialogues",
            note: "",
            highlight: false,
          }));
        }
      }

      if (data.initialStudios) {
        initialStudioOptions.value = data.initialStudios;
        data.initialStudios.forEach((d) => lookups.rememberStudio(d.id, d.name));
      }

      if (data.initialVoiceActors) {
        initialVoiceActorOptions.value = data.initialVoiceActors;
        data.initialVoiceActors.forEach((f) => lookups.rememberVoiceActor(f.id, f.name, f.image));
      }

      isLoading.value = false;
      form.markClean();
    }
  },
  { immediate: true },
);
</script>
