<template>
  <div
    class="admin-project-editor max-w-6xl mx-auto space-y-6"
    :inert="isSaving"
    :aria-busy="isSaving"
  >
    <!-- Header -->
    <div
      class="theme-surface-overlay p-6 rounded-2xl border theme-border flex justify-between items-center shadow-xl"
    >
      <div>
        <h3 class="text-xl font-bold theme-text flex items-center gap-2">
          <FilmIcon class="w-6 h-6 theme-status-info-text" />
          {{
            isEditMode
              ? $t("projectEditor.editMovieProject")
              : $t("projectEditor.createMovieProject")
          }}
        </h3>
        <p class="text-sm theme-text-muted mt-1">
          {{
            isEditMode
              ? `Updating dubbing project ID #${projectIdParam}`
              : $t("projectEditor.fillInfoTmdb")
          }}
        </p>
      </div>
      <NuxtLink
        :to="tmdbMovieId ? localePath(`/movie/${tmdbMovieId}`) : localePath('/')"
        class="text-xs font-semibold px-4 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary theme-hover-text rounded-xl border theme-border transition-colors flex items-center space-x-2"
      >
        <span>{{
          tmdbMovieId ? $t("projectEditor.backToMovie") : $t("projectEditor.backHome")
        }}</span>
      </NuxtLink>
    </div>

    <!-- Navigation Tabs -->
    <div v-if="tmdbMovieId" class="flex flex-wrap gap-2 pb-2 border-b theme-border">
      <NuxtLink
        v-for="project in movieDubbingProjects"
        :key="project.id"
        :to="localePath(`/movie/${tmdbMovieId}/projects/${project.id}/edit`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="
          project.id === Number(projectIdParam)
            ? 'theme-primary-bg theme-primary-border'
            : 'theme-surface-overlay theme-text-secondary theme-border theme-hover-surface-muted'
        "
      >
        {{ getDisplayLanguage(project.language) }}
        <span v-if="project.studios?.name" class="opacity-75 text-xs ml-1"
          >({{ project.studios.name }})</span
        >
      </NuxtLink>
      <NuxtLink
        :to="localePath(`/movie/${tmdbMovieId}/projects/new`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-dashed"
        :class="
          projectIdParam === 'new'
            ? 'theme-status-info theme-status-info-text border'
            : 'theme-surface-overlay theme-text-muted theme-border theme-hover-surface-muted theme-hover-text'
        "
        >{{ $t("projectEditor.addLanguage") }}</NuxtLink
      >
    </div>

    <!-- Main Workspace -->
    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 gap-4 theme-text-muted"
    >
      <Loader2Icon class="w-8 h-8 animate-spin theme-status-info-text" />
      <span class="text-sm">{{ $t("projectEditor.loadingData") }}</span>
    </div>

    <div
      v-else-if="loadError"
      role="alert"
      class="rounded-xl border border-[var(--app-color-danger-border)] theme-status-danger p-6 text-sm theme-status-danger-text"
    >
      {{ loadError }}
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)] gap-6">
      <nav
        :aria-label="$t('projectEditor.sectionNav')"
        class="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible lg:sticky lg:top-4 h-fit"
        data-testid="editor-sections"
      >
        <button
          v-for="item in sections"
          :key="item.id"
          type="button"
          class="px-4 py-2.5 min-h-10 rounded-xl text-sm font-medium text-left whitespace-nowrap transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
          :class="
            section === item.id
              ? 'theme-status-info theme-status-info-text border-[var(--app-color-focus)]'
              : 'theme-surface-overlay theme-text-secondary theme-border theme-hover-surface-muted'
          "
          :aria-current="section === item.id ? 'page' : undefined"
          :data-testid="`section-${item.id}`"
          @click="section = item.id"
        >
          {{ item.label }}
          <span v-if="item.count !== null" class="ml-1 text-xs opacity-75">({{ item.count }})</span>
        </button>
      </nav>

      <!-- Sections stay mounted (v-show) so unsaved edits are never lost when switching. -->
      <form
        id="movie-project-form"
        novalidate
        @submit.prevent="saveMovieProject"
        class="space-y-6 min-w-0"
      >
        <div class="space-y-6">
          <!-- Media Metadata Card -->
          <div
            v-show="section === 'overview'"
            class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-5 h-fit shadow-xl"
          >
            <h4
              class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
            >
              <span>{{ $t("admin.movieEditor.mediaInfo") }}</span>
              <span class="text-xs theme-status-info-text font-normal">{{
                $t("admin.movieEditor.tmdbLinked")
              }}</span>
            </h4>

            <!-- Poster Preview -->
            <div class="flex justify-center">
              <div
                class="relative h-48 w-32 rounded-xl overflow-hidden border theme-border theme-input flex items-center justify-center theme-text-muted shadow-md"
              >
                <NuxtImg
                  format="webp"
                  v-if="posterUrl"
                  :src="posterUrl"
                  class="h-full w-full object-cover"
                  alt="Poster"
                />
                <div v-else class="text-center p-3 theme-text-secondary">
                  <ImageIcon class="h-10 w-10 mx-auto mb-1 opacity-50" />
                  <span class="text-[10px]">{{ $t("projectEditor.noPoster") }}</span>
                </div>
              </div>
            </div>

            <!-- Content ID / TMDB ID -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("projectEditor.tmdbMovieId")
              }}</label>
              <div class="flex space-x-2">
                <input
                  v-model.number="contentId"
                  type="number"
                  required
                  :disabled="!!tmdbMovieId"
                  placeholder="e.g. 1020"
                  class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <!-- Media Name / Title -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("admin.movieEditor.mediaTitle")
              }}</label>
              <input
                v-model="mediaTitle"
                type="text"
                required
                readonly
                class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm opacity-50 cursor-not-allowed"
              />
            </div>
          </div>

          <!-- Settings Card -->
          <div
            v-show="section === 'settings'"
            class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-5 h-fit shadow-xl"
          >
            <!-- Language -->
            <div class="space-y-1">
              <label
                for="movie-project-dubbing-language"
                class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
                >{{ $t("projectEditor.dubbingLanguage") }}</label
              >
              <AdminLanguageSelect
                id="movie-project-dubbing-language"
                v-model="dubbingLanguage"
                required
              />
            </div>

            <!-- Status -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("common.status")
              }}</label>
              <select
                v-model="status"
                class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
              >
                <option value="validated">
                  {{ $t("admin.movieEditor.validated") }}
                </option>
                <option value="pending">
                  {{ $t("admin.movieEditor.pending") }}
                </option>
                <option value="draft">
                  {{ $t("admin.movieEditor.draft") }}
                </option>
              </select>
            </div>
          </div>

          <!-- Technical Crew Form (Right 2 Columns) -->
          <div
            v-show="section === 'crew'"
            class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl"
          >
            <h4
              class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
            >
              <span>{{ $t("admin.movieEditor.technicalDubbingTeam") }}</span>
              <span class="text-xs theme-text-muted">{{
                $t("admin.movieEditor.crewAttributes")
              }}</span>
            </h4>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
              <!-- Studio -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("details.dubbingStudio")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="selectedStudioId"
                  :options="initialStudioOptions"
                  :search-fn="lookups.searchStudios"
                  placeholder="Search studio..."
                  :allow-create="true"
                  :display-fn="lookups.studioLabel"
                  @create="
                    (q: string) =>
                      openCreateStudioDialog(q, (id: number) => (selectedStudioId = id))
                  "
                />
              </div>

              <!-- Artistic Director -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("admin.movieEditor.artisticDirector")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="artisticDirectorId"
                  :options="initialVoiceActorOptions"
                  :search-fn="lookups.searchVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="lookups.voiceActorLabel"
                  @create="
                    (q: string) => openCreateVaDialog(q, (id: number) => (artisticDirectorId = id))
                  "
                />
              </div>

              <!-- Adaptation -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("admin.movieEditor.adaptation")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="adaptationId"
                  :options="initialVoiceActorOptions"
                  :search-fn="lookups.searchVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="lookups.voiceActorLabel"
                  @create="
                    (q: string) => openCreateVaDialog(q, (id: number) => (adaptationId = id))
                  "
                />
              </div>

              <!-- Recording -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("admin.movieEditor.soundRecording")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="recordingId"
                  :options="initialVoiceActorOptions"
                  :search-fn="lookups.searchVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="lookups.voiceActorLabel"
                  @create="(q: string) => openCreateVaDialog(q, (id: number) => (recordingId = id))"
                />
              </div>

              <!-- Editing -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("admin.movieEditor.soundEditing")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="editingId"
                  :options="initialVoiceActorOptions"
                  :search-fn="lookups.searchVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="lookups.voiceActorLabel"
                  @create="(q: string) => openCreateVaDialog(q, (id: number) => (editingId = id))"
                />
              </div>

              <!-- Mixing -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("dubbing.mixing")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="mixingId"
                  :options="initialVoiceActorOptions"
                  :search-fn="lookups.searchVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="lookups.voiceActorLabel"
                  @create="(q: string) => openCreateVaDialog(q, (id: number) => (mixingId = id))"
                />
              </div>

              <!-- Project Manager -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("admin.movieEditor.projectManager")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="projectManagerId"
                  :options="initialVoiceActorOptions"
                  :search-fn="lookups.searchVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="lookups.voiceActorLabel"
                  @create="
                    (q: string) => openCreateVaDialog(q, (id: number) => (projectManagerId = id))
                  "
                />
              </div>

              <!-- Creative Supervision -->
              <div class="space-y-1">
                <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                  $t("admin.movieEditor.creativeSupervision")
                }}</label>
                <AdminAsyncAutocomplete
                  v-model="creativeSupervisionId"
                  :options="initialVoiceActorOptions"
                  :search-fn="lookups.searchVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="lookups.voiceActorLabel"
                  @create="
                    (q: string) =>
                      openCreateVaDialog(q, (id: number) => (creativeSupervisionId = id))
                  "
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Cast / Voice Actors workspace -->
        <div v-show="section === 'cast'">
          <AdminProjectCastWorkspace
            v-model:selected-key="selectedCastKey"
            :rows="castView"
            @add="addCastRow"
            @remove="removeCastRow"
          >
            <template #detail>
              <div v-if="selectedRow" :key="selectedRow.key" class="space-y-4">
                <div class="space-y-1">
                  <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                    $t("projectEditor.originalActorCharacter")
                  }}</label>
                  <AdminAsyncAutocomplete
                    v-model="selectedRow.actor_id"
                    @update:model-value="
                      (val: string | number | null) => handleActorSelect(selectedRow!, val)
                    "
                    :options="initialTmdbCastOptions"
                    :search-fn="searchActors"
                    placeholder="Search TMDB Cast..."
                    :allow-create="true"
                    :display-fn="
                      (id: string | number) => getActorName(id) || selectedRow!.character_name
                    "
                    @create="(query: string) => handleActorCreate(selectedRow!, query)"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                    $t("projectEditor.voiceActor")
                  }}</label>
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
                  />
                </div>
                <div class="space-y-1">
                  <label
                    for="cast-detail-performance"
                    class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
                    >{{ $t("projectEditor.performanceType") }}</label
                  >
                  <select
                    id="cast-detail-performance"
                    v-model="selectedRow.performance"
                    class="w-full px-4 py-2 theme-surface-overlay border theme-border rounded-lg theme-text focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
                  >
                    <option value="dialogues">
                      {{ $t("admin.movieEditor.dialogues") }}
                    </option>
                    <option value="dialogues & chant">
                      {{ $t("admin.movieEditor.dialoguesAndChant") }}
                    </option>
                    <option value="chant">
                      {{ $t("admin.movieEditor.chant") }}
                    </option>
                    <option value="bruitages">
                      {{ $t("projectEditor.performanceBruitages") }}
                    </option>
                    <option value="narration">
                      {{ $t("projectEditor.performanceNarration") }}
                    </option>
                  </select>
                </div>
                <div class="space-y-1">
                  <label
                    for="cast-detail-note"
                    class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
                    >{{ $t("projectEditor.castNote") }}</label
                  >
                  <input
                    id="cast-detail-note"
                    v-model="selectedRow.note"
                    type="text"
                    class="w-full px-4 py-2 theme-surface-overlay border theme-border rounded-lg theme-text focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
                  />
                </div>
                <label class="flex items-center gap-2 text-xs theme-text-secondary">
                  <input
                    type="checkbox"
                    v-model="selectedRow.highlight"
                    class="w-4 h-4 theme-surface-overlay theme-border rounded text-blue-500 focus:ring-[var(--app-color-focus)]"
                  />
                  {{ $t("projectEditor.highlightCharacter") }}
                </label>
              </div>
            </template>
          </AdminProjectCastWorkspace>
        </div>
      </form>
    </div>

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
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex flex-col gap-2 theme-surface-overlay theme-border theme-text"
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
import { validateDubbingLanguage } from "@app/shared-logic";
import { ref, onMounted, computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FilmIcon, Loader2Icon, ImageIcon, XIcon } from "lucide-vue-next";
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
import type { CastWorkspaceRow } from "~/utils/cast-workspace";

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
  { id: "overview", label: t("projectEditor.sectionOverview"), count: null },
  {
    id: "cast",
    label: t("projectEditor.sectionCast"),
    count: castRows.value.length,
  },
  { id: "crew", label: t("projectEditor.sectionCrew"), count: null },
  { id: "settings", label: t("projectEditor.sectionSettings"), count: null },
]);
const selectedCastKey = ref<string | null>(null);
const selectedRow = computed(
  () => castRows.value.find((row) => row.key === selectedCastKey.value) ?? null,
);
const castView = computed<CastWorkspaceRow[]>(() =>
  castRows.value.map((row) => {
    const actor = tmdbCast.value.find((c) => c.id === row.actor_id);
    return {
      key: row.key,
      characterName: row.character_name,
      originalActorName: actor?.name ?? "",
      originalActorImage: actor?.profile_path
        ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
        : null,
      voiceActorName: row.voice_actor_id ? lookups.voiceActorLabel(row.voice_actor_id) : "",
      voiceActorImage: null,
      performance: row.performance,
      highlight: row.highlight,
    };
  }),
);

const tmdbCast = ref<EditorTmdbCastMember[]>([]);
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
    let projects: EditorProjectTab[] = [];
    let project: EditorProjectRecord | null = null;
    let studioName: string | null = null;
    let crew: EditorProjectCrew[] = [];
    let works: EditorProjectWork[] = [];

    if (tmdbMovieId.value) {
      // TMDB metadata
      try {
        const data = await $fetch<{ movie?: TmdbMovieData | null }>(
          `/api/movie/${tmdbMovieId.value}`,
        );
        if (data && data.movie) {
          tmdbData = data.movie;
        }
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
        .select("*, studios(name), work(*, voice_actors(firstname, lastname))")
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
      .select("id, firstname, lastname")
      .limit(10);
    const initialVoiceActors = (vaData || []).map((va) => ({
      id: va.id,
      name: `${va.firstname || ""} ${va.lastname || ""}`.trim(),
    }));

    return {
      tmdbData,
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
        castRows.value = data.works.map((w) => {
          if (w.voice_actors) {
            const name =
              `${w.voice_actors.firstname || ""} ${w.voice_actors.lastname || ""}`.trim();
            lookups.rememberVoiceActor(w.voice_actor_id, name);
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
      }

      if (data.initialStudios) {
        initialStudioOptions.value = data.initialStudios;
        data.initialStudios.forEach((d) => lookups.rememberStudio(d.id, d.name));
      }

      if (data.initialVoiceActors) {
        initialVoiceActorOptions.value = data.initialVoiceActors;
        data.initialVoiceActors.forEach((f) => lookups.rememberVoiceActor(f.id, f.name));
      }

      isLoading.value = false;
      form.markClean();
    }
  },
  { immediate: true },
);
</script>
