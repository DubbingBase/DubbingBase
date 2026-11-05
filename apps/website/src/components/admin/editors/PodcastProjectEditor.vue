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
          <RadioIcon class="w-6 h-6 theme-status-info-text" />
          {{
            isEditMode
              ? "Modifier le projet de podcast / fiction audio"
              : "Créer un projet de podcast / fiction audio"
          }}
        </h3>
        <p class="text-sm theme-text-muted mt-1">
          {{
            isEditMode
              ? `Mise à jour du projet #${projectIdParam}`
              : "Informations podcast, studio, réalisation et casting vocal."
          }}
        </p>
      </div>
      <NuxtLink
        :to="parsedPodcastId ? localePath(`/podcast/${parsedPodcastId}`) : localePath('/')"
        class="text-xs font-semibold px-4 py-2.5 theme-surface-muted theme-hover-surface-muted theme-text-secondary theme-hover-text rounded-xl border theme-border transition-colors flex items-center space-x-2"
      >
        <span>{{ parsedPodcastId ? "← Retour au podcast" : "← Accueil" }}</span>
      </NuxtLink>
    </div>

    <!-- Navigation Tabs -->
    <div v-if="parsedPodcastId" class="flex flex-wrap gap-2 pb-2 border-b theme-border">
      <NuxtLink
        v-for="project in podcastDubbingProjects"
        :key="project.id"
        :to="localePath(`/podcast/${parsedPodcastId}/projects/${project.id}/edit`)"
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
        :to="localePath(`/podcast/${parsedPodcastId}/projects/new`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-dashed"
        :class="
          projectIdParam === 'new'
            ? 'theme-status-info theme-status-info-text border'
            : 'theme-surface-overlay theme-text-muted theme-border theme-hover-surface-muted theme-hover-text'
        "
        >{{ $t("common.addLanguage") }}</NuxtLink
      >
    </div>

    <!-- Loading overlay -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 gap-4 theme-text-muted"
    >
      <Loader2Icon class="w-8 h-8 animate-spin theme-status-info-text" />
      <span class="text-sm">{{ $t("common.loadingProjectData") }}</span>
    </div>

    <form v-else id="podcast-project-form" @submit.prevent="savePodcastProject" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Media Metadata Card (Left Column) -->
        <div
          class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-5 h-fit shadow-xl"
        >
          <h4
            class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
          >
            <span>{{ $t("podcastEditor.podcastInfo") }}</span>
            <span class="text-xs theme-status-info-text font-normal">{{
              $t("podcastEditor.itunesRss")
            }}</span>
          </h4>

          <!-- Cover Preview -->
          <div class="flex justify-center">
            <div
              class="relative h-48 w-48 rounded-xl overflow-hidden border theme-border theme-input flex items-center justify-center theme-text-muted shadow-md"
            >
              <NuxtImg
                format="webp"
                v-if="posterUrl"
                :src="posterUrl"
                class="h-full w-full object-cover"
                alt="Cover"
              />
              <div v-else class="text-center p-3 theme-text-secondary">
                <RadioIcon class="h-10 w-10 mx-auto mb-1 opacity-50" />
                <span class="text-[10px]">{{ $t("podcastEditor.noThumbnail") }}</span>
              </div>
            </div>
          </div>

          <!-- Content ID / iTunes ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("podcastEditor.itunesCollectionId")
            }}</label>
            <div class="flex space-x-2">
              <input
                v-model.number="contentId"
                type="number"
                required
                :disabled="!!parsedPodcastId"
                placeholder="Ex: 1478201201"
                class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                @click="fetchPodcastMetadata"
                :disabled="isFetchingMetadata || !contentId"
                class="px-3 py-2 theme-surface-muted theme-hover-surface-muted disabled:opacity-50 theme-text text-xs font-semibold rounded-xl border theme-border whitespace-nowrap"
              >
                <Loader2Icon v-if="isFetchingMetadata" class="w-4 h-4 animate-spin" />
                <span v-else>{{ $t("common.fetch") }}</span>
              </button>
            </div>
          </div>

          <!-- Title -->
          <div class="space-y-1">
            <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
              $t("podcastEditor.podcastTitle")
            }}</label>
            <input
              v-model="mediaTitle"
              type="text"
              required
              class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm"
            />
          </div>

          <!-- Language -->
          <div class="space-y-1">
            <label
              for="podcast-project-dubbing-language"
              class="text-xs font-semibold theme-text-muted uppercase tracking-wider"
              >{{ $t("common.language") }}</label
            >
            <AdminLanguageSelect
              id="podcast-project-dubbing-language"
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
              <option value="validated">{{ $t("common.validated") }}</option>
              <option value="pending">
                {{ $t("common.pendingValidation") }}
              </option>
              <option value="draft">{{ $t("common.draft") }}</option>
            </select>
          </div>
        </div>

        <!-- Technical Crew Form (Right 2 Columns) -->
        <div
          class="lg:col-span-2 theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl"
        >
          <h4
            class="text-sm font-bold theme-text uppercase tracking-wider border-b theme-border pb-3 flex items-center justify-between"
          >
            <span>{{ $t("podcastEditor.technicalStudio") }}</span>
            <span class="text-xs theme-text-muted">{{ $t("podcastEditor.soundProduction") }}</span>
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Studio -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("podcastEditor.studioProducer")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="selectedStudioId"
                :options="initialStudioOptions"
                :search-fn="lookups.searchStudios"
                placeholder="Rechercher un studio (ex: Binge Audio, Radio France...)"
                :allow-create="true"
                :display-fn="lookups.studioLabel"
                @create="
                  (q: string) => openCreateStudioDialog(q, (id: number) => (selectedStudioId = id))
                "
              />
            </div>

            <!-- Direction Artistique -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("podcastEditor.directionArtistic")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="artisticDirectorId"
                :options="initialVoiceActorOptions"
                :search-fn="lookups.searchVoiceActors"
                placeholder="Rechercher un réalisateur/D.A..."
                :allow-create="true"
                :display-fn="lookups.voiceActorLabel"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => (artisticDirectorId = id))
                "
              />
            </div>

            <!-- Prise de son -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("podcastEditor.recordingSoundDesigner")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="recordingId"
                :options="initialVoiceActorOptions"
                :search-fn="lookups.searchVoiceActors"
                placeholder="Rechercher..."
                :allow-create="true"
                :display-fn="lookups.voiceActorLabel"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (recordingId = id))"
              />
            </div>

            <!-- Mixage -->
            <div class="space-y-1">
              <label class="text-xs font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("podcastEditor.mixingAudio")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="mixingId"
                :options="initialVoiceActorOptions"
                :search-fn="lookups.searchVoiceActors"
                placeholder="Rechercher..."
                :allow-create="true"
                :display-fn="lookups.voiceActorLabel"
                @create="(q: string) => openCreateVaDialog(q, (id: number) => (mixingId = id))"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Cast Roster Section -->
      <div class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl">
        <div
          class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b theme-border pb-4"
        >
          <div>
            <h4 class="text-sm font-bold theme-text uppercase tracking-wider">
              {{ $t("podcastEditor.voiceDistribution") }}
            </h4>
            <p class="text-xs theme-text-muted mt-0.5">
              {{ $t("podcastEditor.associateActors") }}
            </p>
          </div>
          <button
            type="button"
            @click="addNewCastRow"
            class="px-4 py-2 theme-primary-bg hover:bg-[var(--app-color-primary-hover)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <span>{{ $t("common.addVoice") }}</span>
          </button>
        </div>

        <div v-if="castList.length === 0" class="text-center py-8 theme-text-muted text-sm">
          {{ $t("podcastEditor.noRoleRecorded") }}
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="(row, index) in castList"
            :key="row.key"
            class="grid grid-cols-1 md:grid-cols-12 gap-3 p-4 theme-input rounded-xl border theme-border items-end"
          >
            <!-- Voice Actor -->
            <div class="md:col-span-4 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("common.actor")
              }}</label>
              <AdminAsyncAutocomplete
                v-model="row.voice_actor_id"
                :options="initialVoiceActorOptions"
                :search-fn="lookups.searchVoiceActors"
                placeholder="Rechercher un comédien..."
                :allow-create="true"
                :display-fn="lookups.voiceActorLabel"
                @create="
                  (q: string) => openCreateVaDialog(q, (id: number) => (row.voice_actor_id = id))
                "
              />
            </div>

            <!-- Role / Character Name -->
            <div class="md:col-span-2 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("common.characterRole")
              }}</label>
              <input
                v-model="row.character_name"
                type="text"
                placeholder="Ex: Protagoniste, Narrateur..."
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <div class="md:col-span-2 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("projectEditor.castNote")
              }}</label>
              <input
                v-model="row.note"
                type="text"
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <!-- Performance Type -->
            <div class="md:col-span-3 space-y-1">
              <label class="text-[10px] font-semibold theme-text-muted uppercase tracking-wider">{{
                $t("common.performanceType")
              }}</label>
              <input
                v-model="row.performance"
                type="text"
                placeholder="Ex: Voix principale, Invité..."
                class="w-full px-3 py-2 theme-surface-overlay border theme-border rounded-xl theme-text text-xs theme-placeholder focus:outline-none focus:ring-1 focus:ring-[var(--app-color-focus)]"
              />
            </div>

            <!-- Remove Button -->
            <div class="md:col-span-1 flex justify-end">
              <button
                type="button"
                @click="removeCastRow(row.key)"
                class="p-2 theme-text-muted hover:text-[var(--app-color-danger-text)] transition-colors rounded-lg min-h-11 min-w-11 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
                :aria-label="$t('projectEditor.removeCastRow', { index: index + 1 })"
                :title="$t('projectEditor.removeCastRow', { index: index + 1 })"
                data-testid="remove-cast-row"
              >
                <Trash2Icon class="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>

    <AdminEditorSaveBar
      v-if="!isLoading"
      :status="form.status.value"
      :is-dirty="form.isDirty.value"
      :error-message="form.errorMessage.value"
      :save-label="isEditMode ? 'Enregistrer les modifications' : 'Créer le projet'"
      form-id="podcast-project-form"
      @discard="form.discard"
    />
    <AdminCreateStudioDialog
      v-model:open="isCreateStudioOpen"
      :initial-name="newStudioName"
      :create="lookups.createStudio"
      @created="onStudioCreated"
    />
    <AdminCreateVoiceActorDialog
      v-model:open="isCreateVaOpen"
      :initial-query="newVaQuery"
      status="active"
      @created="onVoiceActorCreated"
    />
    <AdminUnsavedChangesDialog
      :open="form.isLeavePromptOpen.value"
      @stay="form.stayOnPage"
      @discard="form.discardAndLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { validateDubbingLanguage, displayDubbingLanguage } from "@app/shared-logic";
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Radio as RadioIcon, Loader2 as Loader2Icon, Trash2 as Trash2Icon } from "lucide-vue-next";
import {
  createDubbingProjectSaveClient,
  getEditableDubbingProjectStatus,
  type DubbingProjectStatus,
  getDubbingProjectSaveErrorMessage,
  type DubbingProjectCastSaveRow,
  type DubbingProjectSaveResponse,
} from "~/utils/dubbing-project-save";
import {
  formatVoiceActorName,
  useAdminLookups,
  type AdminLookupOption,
} from "~/composables/useAdminLookups";
import { createEditorRowKey, useEditorFormState } from "~/composables/useEditorFormState";
import type { EditorCastRowBase, EditorProjectTab } from "~/utils/admin-project-editor-types";
import { firstRouteParam } from "~/utils/route-param";

const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const supabase = useSupabaseClient();
const saveDubbingProject = createDubbingProjectSaveClient((body) =>
  $fetch<DubbingProjectSaveResponse>("/api/save-dubbing-project", {
    method: "POST",
    body,
  }),
);

const podcastIdParam = computed(() => firstRouteParam(route.params.podcastId) ?? "");
const projectIdParam = computed(() => firstRouteParam(route.params.projectId) ?? "");

const isEditMode = computed(() => projectIdParam.value && projectIdParam.value !== "new");

const parsedPodcastId = computed(() => {
  const num = parseInt(podcastIdParam.value, 10);
  return isNaN(num) ? null : num;
});

const contentId = ref<number | null>(parsedPodcastId.value);
const mediaTitle = ref("");
const posterUrl = ref<string | null>(null);
const dubbingLanguage = ref("");
const status = ref<DubbingProjectStatus>("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);
const artisticDirectorId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);

type CastRow = EditorCastRowBase;

const castList = ref<CastRow[]>([]);
const podcastDubbingProjects = ref<EditorProjectTab[]>([]);
const isLoading = ref(true);
const isFetchingMetadata = ref(false);

// Each autocomplete owns its search results; labels are cached by id.
const lookups = useAdminLookups();
const initialStudioOptions = ref<AdminLookupOption[]>([]);
const initialVoiceActorOptions = ref<AdminLookupOption[]>([]);

const isCreateStudioOpen = ref(false);
const newStudioName = ref("");
const isCreateVaOpen = ref(false);
const newVaQuery = ref("");
let pendingStudioSelect: ((id: number) => void) | null = null;
let pendingVaSelect: ((id: number) => void) | null = null;

const form = useEditorFormState({
  snapshot: () => ({
    contentId: contentId.value,
    dubbingLanguage: dubbingLanguage.value,
    status: status.value,
    selectedStudioId: selectedStudioId.value,
    artisticDirectorId: artisticDirectorId.value,
    recordingId: recordingId.value,
    mixingId: mixingId.value,
    castList: castList.value,
  }),
  restore: (saved) => {
    contentId.value = saved.contentId;
    dubbingLanguage.value = saved.dubbingLanguage;
    status.value = saved.status;
    selectedStudioId.value = saved.selectedStudioId;
    artisticDirectorId.value = saved.artisticDirectorId;
    recordingId.value = saved.recordingId;
    mixingId.value = saved.mixingId;
    castList.value = saved.castList;
  },
});
const isSaving = form.isSaving;

// Inline creation uses the shared dialogs; typed input survives failures.
function openCreateStudioDialog(name: string, cb: (id: number) => void) {
  newStudioName.value = name;
  pendingStudioSelect = cb;
  isCreateStudioOpen.value = true;
}

function onStudioCreated(studio: AdminLookupOption) {
  pendingStudioSelect?.(studio.id);
  pendingStudioSelect = null;
}

function openCreateVaDialog(name: string, cb: (id: number) => void) {
  newVaQuery.value = name;
  pendingVaSelect = cb;
  isCreateVaOpen.value = true;
}

function onVoiceActorCreated(voiceActor: AdminLookupOption) {
  lookups.rememberVoiceActor(voiceActor.id, voiceActor.name);
  pendingVaSelect?.(voiceActor.id);
  pendingVaSelect = null;
}

function addNewCastRow() {
  castList.value.push({
    key: createEditorRowKey(),
    voice_actor_id: null,
    character_name: "Voix",
    performance: "Rôle",
    note: "",
  });
}

function removeCastRow(key: string) {
  castList.value = castList.value.filter((row) => row.key !== key);
}

function getDisplayLanguage(langCode?: string | null): string {
  return langCode ? displayDubbingLanguage(langCode, "fr") : "";
}

async function fetchPodcastMetadata() {
  if (!contentId.value) return;
  isFetchingMetadata.value = true;
  try {
    const data = await $fetch<{
      podcast?: { title: string; cover_url?: string | null } | null;
    }>(`/api/podcast/${contentId.value}`);
    if (data?.podcast) {
      mediaTitle.value = data.podcast.title;
      posterUrl.value = data.podcast.cover_url || null;
    }
  } catch (err) {
    console.error("Failed to fetch podcast metadata:", err);
  } finally {
    isFetchingMetadata.value = false;
  }
}

onMounted(async () => {
  try {
    if (parsedPodcastId.value) {
      await fetchPodcastMetadata();

      const { data: projects } = await supabase
        .from("dubbing_projects")
        .select("*, studios(id, name)")
        .eq("content_id", parsedPodcastId.value)
        .eq("content_type", "podcast");

      podcastDubbingProjects.value = projects || [];
    }

    if (isEditMode.value) {
      const projectId = Number(projectIdParam.value);
      const { data: project } = await supabase
        .from("dubbing_projects")
        .select(
          "*, studios(id, name), work(*, voice_actors(id, firstname, lastname, profile_picture))",
        )
        .eq("id", projectId)
        .single();

      if (project) {
        dubbingLanguage.value = project.language || "";
        status.value = getEditableDubbingProjectStatus(project.status);
        selectedStudioId.value = project.studio_id;
        projectUpdatedAt.value = project.updated_at;
        if (project.studios) {
          initialStudioOptions.value = [project.studios];
          lookups.rememberStudio(project.studios.id, project.studios.name);
        }

        const { data: crew } = await supabase
          .from("dubbing_project_crew")
          .select("*, voice_actors(id, firstname, lastname), jobs(name)")
          .eq("dubbing_project_id", projectId);

        if (crew) {
          for (const member of crew) {
            const va = member.voice_actors;
            if (va) {
              lookups.rememberVoiceActor(va.id, formatVoiceActorName(va));
              initialVoiceActorOptions.value.push({
                id: va.id,
                name: formatVoiceActorName(va),
              });
            }
            if (member.job_id === 1) artisticDirectorId.value = member.person_id;
            if (member.job_id === 3) recordingId.value = member.person_id;
            if (member.job_id === 5) mixingId.value = member.person_id;
          }
        }

        if (project.work) {
          castList.value = project.work.map((w) => {
            if (w.voice_actors) {
              lookups.rememberVoiceActor(w.voice_actors.id, formatVoiceActorName(w.voice_actors));
            }
            return {
              key: createEditorRowKey(),
              id: w.id,
              voice_actor_id: w.voice_actor_id,
              character_name: w.character_name || "Voix",
              performance: w.performance || "",
              note: w.note || "",
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
      }
    }
  } catch (err) {
    console.error("Error loading podcast project:", err);
  } finally {
    isLoading.value = false;
    form.markClean();
  }
});

async function savePodcastProject() {
  if (!contentId.value) return;
  form.beginSave();

  try {
    const currentProjectId = isEditMode.value ? Number(projectIdParam.value) : null;
    const crew: Array<{ job_id: number; person_id: number }> = [];
    if (artisticDirectorId.value !== null)
      crew.push({ job_id: 1, person_id: artisticDirectorId.value });
    if (recordingId.value !== null) crew.push({ job_id: 3, person_id: recordingId.value });
    if (mixingId.value !== null) crew.push({ job_id: 5, person_id: mixingId.value });

    const cast: DubbingProjectCastSaveRow[] = castList.value.flatMap((row) => {
      if (!row.voice_actor_id) return [];
      if (
        row.id !== undefined &&
        (row.expected === undefined || row.expectedUpdatedAt === undefined)
      ) {
        throw new Error("Reload this project before saving its cast.");
      }
      return [
        {
          ...(row.id === undefined
            ? {}
            : {
                id: row.id,
                expected_updated_at: row.expectedUpdatedAt,
                expected: row.expected,
              }),
          voice_actor_id: row.voice_actor_id,
          character_name: row.character_name,
          performance: row.performance,
          note: row.note || null,
        },
      ];
    });

    const result = await saveDubbingProject({
      project_id: currentProjectId,
      expected_updated_at: currentProjectId === null ? null : projectUpdatedAt.value,
      project: {
        content_id: contentId.value,
        content_type: "podcast",
        language: validateDubbingLanguage(dubbingLanguage.value),
        status: status.value,
        studio_id: selectedStudioId.value,
      },
      crew,
      cast,
    });
    projectUpdatedAt.value = result.updatedAt;

    form.saveSucceeded();
    await router.push(localePath(`/podcast/${contentId.value}`));
  } catch (err) {
    console.error("Failed to save podcast project:", err);
    form.saveFailed(getDubbingProjectSaveErrorMessage(err));
  }
}
</script>
