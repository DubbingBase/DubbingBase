<template>
  <AdminProjectEditorLayout
    v-model:section="section"
    :title="mediaTitle || $t(config.i18n.create)"
    :eyebrow="isEditMode ? $t(config.i18n.edit) : $t(config.i18n.create)"
    :poster-url="posterUrl"
    :back-to="tmdbId ? localePath(`${config.basePath}/${tmdbId}`) : localePath('/')"
    :back-label="tmdbId ? $t(config.i18n.back) : $t('projectEditor.backHome')"
    :chips="heroChips"
    :projects-base-path="tmdbId ? `${config.basePath}/${tmdbId}` : null"
    :projects="tmdbDubbingProjects"
    :project-id-param="projectIdParam"
    :language-label="getDisplayLanguage"
    :form-id="config.formId"
    :save-label="$t(config.i18n.save)"
    :form="form"
    :is-loading="isLoading"
    :load-error="loadError"
    :cast-count="castRows.length"
    @submit="saveProject"
  >
    <template #cast>
      <AdminProjectCastWorkspace
        v-model:selected-key="selectedCastKey"
        :rows="castView"
        @add="addCastRow"
        @remove="removeCastRow"
        @character-image-error="reportCharacterImageError"
      >
        <template #detail>
          <div v-if="selectedRow" :key="selectedRow.key" class="space-y-5">
            <div class="grid gap-5 lg:grid-cols-2">
              <section
                class="space-y-4 rounded-xl border theme-border p-4"
                :aria-label="$t('projectEditor.castOriginalActor')"
              >
                <h3 class="text-xs font-bold uppercase tracking-wider theme-text-muted">
                  {{ $t("projectEditor.castOriginalActor") }}
                </h3>
                <AdminFormField :label="$t('projectEditor.originalActorCharacter')">
                  <AdminAsyncAutocomplete
                    v-model="selectedRow.actor_id"
                    :options="initialTmdbCastOptions"
                    :search-fn="searchActors"
                    :placeholder="$t('projectEditor.searchTmdbCast')"
                    :allow-create="true"
                    :display-fn="
                      (id: string | number) => getActorName(id) || selectedRow!.character_name
                    "
                    @update:model-value="
                      (val: string | number | null) => handleActorSelect(selectedRow!, val)
                    "
                    @create="(query: string) => handleActorCreate(selectedRow!, query)"
                  >
                    <template #leading>
                      <AdminCastAvatar
                        size="xs"
                        :name="castViewFor(selectedRow.key)?.originalActorName ?? ''"
                        :src="castViewFor(selectedRow.key)?.originalActorImage ?? null"
                      />
                    </template>
                    <template #option="{ option }"
                      ><span class="flex items-center gap-2"
                        ><AdminCastAvatar
                          size="sm"
                          :name="option.name"
                          :src="tmdbProfileUrl(option.profile_path)"
                        />{{ getActorName(option.id) }}</span
                      ></template
                    >
                  </AdminAsyncAutocomplete>
                </AdminFormField>
                <AdminFormField
                  :label="$t('projectEditor.castCharacterName')"
                  for-id="cast-detail-character"
                >
                  <div class="relative">
                    <div class="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2">
                      <AdminCastAvatar
                        size="xs"
                        :name="characterNameFor(selectedRow)"
                        :src="castViewFor(selectedRow.key)?.characterImage ?? null"
                      />
                    </div>
                    <output
                      id="cast-detail-character"
                      class="flex h-11 w-full items-center truncate rounded-xl border theme-border theme-surface-muted pl-12 pr-4 text-base sm:text-sm theme-text"
                      >{{ characterNameFor(selectedRow) }}</output
                    >
                  </div>
                </AdminFormField>
              </section>

              <section
                class="space-y-4 rounded-xl border theme-border p-4"
                :aria-label="$t('projectEditor.castVoiceActor')"
              >
                <h3 class="text-xs font-bold uppercase tracking-wider theme-text-muted">
                  {{ $t("projectEditor.castVoiceActor") }}
                </h3>
                <AdminCastVoiceActorField
                  v-model="selectedRow.voice_actor_id"
                  :options="initialVoiceActorOptions"
                  :lookups="lookups"
                  @create="
                    (query: string) =>
                      openCreateVaDialog(query, (id: number) => (selectedRow!.voice_actor_id = id))
                  "
                />

                <AdminCastPerformanceField v-model="selectedRow.performance" />
              </section>
            </div>

            <AdminCastNoteHighlight
              v-model:note="selectedRow.note"
              v-model:highlight="selectedRow.highlight"
            />
          </div>
        </template>
      </AdminProjectCastWorkspace>
    </template>

    <template #overview>
      <AdminFormCard
        :title="$t('admin.movieEditor.mediaInfo')"
        :description="$t('admin.movieEditor.tmdbLinked')"
      >
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <AdminFormField :label="$t(config.i18n.tmdbId)" :for-id="config.idInputId">
            <input
              :id="config.idInputId"
              v-model.number="contentId"
              type="number"
              inputmode="numeric"
              required
              :disabled="!!tmdbId"
              class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </AdminFormField>
          <AdminFormField :label="$t('admin.movieEditor.mediaTitle')" :for-id="config.titleInputId">
            <input
              :id="config.titleInputId"
              v-model="mediaTitle"
              type="text"
              required
              readonly
              class="h-11 w-full cursor-not-allowed rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text opacity-60"
            />
          </AdminFormField>
        </div>
      </AdminFormCard>
    </template>

    <template #settings>
      <AdminProjectSettingsCard
        v-model:language="dubbingLanguage"
        v-model:status="status"
        :id-prefix="config.idPrefix"
      />
    </template>

    <template #crew>
      <AdminProjectCrewCard
        v-model:studio-id="selectedStudioId"
        :title="$t('admin.movieEditor.technicalDubbingTeam')"
        :description="$t('admin.movieEditor.crewAttributes')"
        :studio-label="$t('details.dubbingStudio')"
        :fields="crewState.fields.value"
        :crew="crewState.values.value"
        :studio-options="initialStudioOptions"
        :voice-actor-options="initialVoiceActorOptions"
        :lookups="lookups"
        @update:crew="crewState.set"
        @create-studio="openCreateStudioDialog"
        @create-voice-actor="openCreateVaDialog"
      />
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

    <AdminEditorToast :toast="toast" />
  </AdminProjectEditorLayout>
</template>

<script setup lang="ts">
import { validateDubbingLanguage } from "@app/shared-logic";
import { useCharacterImages } from "../../../composables/useCharacterImages";
import { ref, onMounted, computed, nextTick, watch, type Ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  createDubbingProjectSaveClient,
  getDubbingProjectSaveErrorMessage,
  getEditableDubbingProjectStatus,
  type DubbingProjectStatus,
  type DubbingProjectCastSaveRow,
  type DubbingProjectSaveResponse,
} from "~/utils/dubbing-project-save";
import { useAdminLookups, type AdminLookupOption } from "~/composables/useAdminLookups";
import { createEditorRowKey, useEditorFormState } from "~/composables/useEditorFormState";
import type {
  EditorCastRowBase,
  EditorProjectCrew,
  EditorProjectRecord,
  EditorProjectTab,
  EditorProjectWork,
  EditorTmdbCastMember,
} from "~/utils/admin-project-editor-types";
import {
  TMDB_EDITOR_KINDS,
  extractCastRoles,
  fetchTmdbMediaSummary,
  type TmdbEditorKind,
  type TmdbMediaSummary,
} from "~/utils/tmdb-project-editor";
import type { EditorSection } from "~/components/admin/ProjectEditorLayout.vue";
import { useFullCrewState } from "~/composables/useFullCrewState";
import { useDisplayLanguage } from "~/composables/useDisplayLanguage";
import { useEditorToast } from "~/composables/useEditorToast";
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

const props = defineProps<{ kind: TmdbEditorKind }>();
const config = TMDB_EDITOR_KINDS[props.kind];

const tmdbIdParam = firstRouteParam(route.params[config.routeParam]);
const projectIdParam = firstRouteParam(route.params.projectId);

const isEditMode = computed(() => !!projectIdParam && projectIdParam !== "new");
const tmdbId = computed(() => (tmdbIdParam && tmdbIdParam !== "new" ? Number(tmdbIdParam) : null));

const tmdbDubbingProjects = ref<EditorProjectTab[]>([]);

// Form state
const contentId = ref<number | null>(null);
const mediaTitle = ref("");
const contentType = ref<string>(config.contentType);
const dubbingLanguage = ref("");
const posterUrl = ref("");
const status = ref<DubbingProjectStatus>("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);

// Crew state
const crewState = useFullCrewState(t);

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
interface CastRow extends EditorCastRowBase {
  actor_id: number | string | null;
  highlight: boolean;
}
const castRows = ref<CastRow[]>([]);

const TMDB_PROFILE_BASE = "https://image.tmdb.org/t/p/w185";

const { toast, showToast } = useEditorToast();

const getDisplayLanguage = useDisplayLanguage();

// Hero summary chips: language, studio and publication status at a glance.
const heroChips = computed(() =>
  [
    dubbingLanguage.value ? getDisplayLanguage(dubbingLanguage.value) : "",
    selectedStudioId.value ? lookups.studioLabel(selectedStudioId.value) : "",
    t(`admin.movieEditor.${status.value}`),
  ].filter((chip) => chip.length > 0),
);

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
    crew: crewState.snapshot(),
    castRows: castRows.value,
  }),
  restore: (saved) => {
    contentId.value = saved.contentId;
    dubbingLanguage.value = saved.dubbingLanguage;
    status.value = saved.status;
    selectedStudioId.value = saved.selectedStudioId;
    crewState.restore(saved.crew);
    castRows.value = saved.castRows;
  },
});

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
const section = ref<EditorSection>("cast");
const selectedCastKey = ref<string | null>(null);
const selectedRow = computed(
  () => castRows.value.find((row) => row.key === selectedCastKey.value) ?? null,
);
// Saved rows may carry only the original actor; the public pages fall back to the TMDB character.
const characterNameFor = (row: {
  character_name?: string | null;
  actor_id?: string | number | null;
}) =>
  row.character_name ||
  extractCastRoles(tmdbCast.value.find((c) => c.id === row.actor_id) ?? { id: 0, name: "" }).trim();
const castView = computed<CastWorkspaceRow[]>(() =>
  castRows.value.map((row) => {
    const actor = tmdbCast.value.find((c) => c.id === row.actor_id);
    const characterName = characterNameFor(row);
    return {
      key: row.key,
      characterName,
      originalActorName: actor?.name ?? "",
      characterImage: characterImageFor(characterRequestFor(characterName))?.src ?? null,
      originalActorImage: tmdbProfileUrl(actor?.profile_path),
      voiceActorName: row.voice_actor_id ? lookups.voiceActorLabel(row.voice_actor_id) : "",
      voiceActorImage: lookups.voiceActorImage(row.voice_actor_id),
      assigned: row.voice_actor_id !== null,
      performance: row.performance,
      highlight: row.highlight,
    };
  }),
);

const castViewFor = (key: string) => castView.value.find((row) => row.key === key);

const tmdbCast = ref<EditorTmdbCastMember[]>([]);
const characterRequestFor = (characterName: string) => ({
  mediaType: config.characterMediaType,
  mediaId: tmdbId.value ?? "",
  names: [characterName],
});
// Bounded: at most two batches of lookups for very large casts.
const characterRequests = computed(() =>
  castRows.value.slice(0, 48).map((row) => characterRequestFor(characterNameFor(row))),
);
const { imageFor: characterImageFor, reportImageError } = useCharacterImages(characterRequests);
// A character image that fails in the browser is re-requested from the next source (PR #389).
const reportCharacterImageError = (key: string) => {
  const row = castRows.value.find((item) => item.key === key);
  if (row) reportImageError(characterRequestFor(characterNameFor(row)));
};
const tmdbProfileUrl = (path: string | null | undefined): string | null =>
  path ? (path.startsWith("/") ? `${TMDB_PROFILE_BASE}${path}` : path) : null;
const initialTmdbCastOptions = computed(() => tmdbCast.value.slice(0, 50));

const searchActors = (query: string) => {
  if (!query) return tmdbCast.value.slice(0, 50);
  return tmdbCast.value
    .filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        extractCastRoles(c).toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 50);
};

const getActorName = (id: number | string | null) => {
  if (!id) return "";
  const actor = tmdbCast.value.find((c) => c.id === id);
  if (!actor) return "";
  const roles = extractCastRoles(actor);
  return roles ? `${actor.name} (${roles})` : actor.name;
};

const handleActorSelect = (row: CastRow, val: string | number | null) => {
  const actor = tmdbCast.value.find((c) => c.id === val);
  if (actor) {
    row.character_name = extractCastRoles(actor);
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
  showToast(
    t("projectEditor.toastCreated", { name: studio.name }),
    "success",
    `/studio/${studio.id}`,
  );
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
  showToast(t("projectEditor.toastCreated", { name: voiceActor.name }), "success");
};

const saveProject = async () => {
  if (!contentId.value) return showToast(t("projectEditor.tmdbIdRequired"), "error");
  if (!dubbingLanguage.value) return showToast(t("projectEditor.languageRequired"), "error");
  form.beginSave();
  try {
    let projectId = isEditMode.value ? Number(projectIdParam) : null;
    const crew = crewState.toSaveRows();

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
        content_type: config.contentType,
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
    showToast(t("projectEditor.toastSaved"), "success");
    if (!isEditMode.value && projectId && contentId.value) {
      await router.push(
        localePath(`${config.basePath}/${contentId.value}/projects/${projectId}/edit`),
      );
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
  `${props.kind}-edit-${tmdbId.value}-${projectIdParam}`,
  async () => {
    let tmdbData: TmdbMediaSummary | null = null;
    let projects: EditorProjectTab[] = [];
    let project: EditorProjectRecord | null = null;
    let studioName: string | null = null;
    let crew: EditorProjectCrew[] = [];
    let works: EditorProjectWork[] = [];

    if (tmdbId.value) {
      // TMDB metadata
      try {
        tmdbData = await fetchTmdbMediaSummary(props.kind, tmdbId.value);
      } catch (e) {
        console.error("Failed to fetch TMDB data.", e);
      }

      // Fetch all dubbing projects for this work for the tabs
      const { data: pData } = await supabase
        .from("dubbing_projects")
        .select("id, language, studio_id, studios(name)")
        .eq("content_id", tmdbId.value)
        .eq("content_type", config.contentType);
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
        contentId.value = tmdbId.value;
        mediaTitle.value = data.tmdbData.title;
        let poster = data.tmdbData.posterPath;
        if (poster && poster.startsWith("/")) {
          poster = `https://image.tmdb.org/t/p/w500${poster}`;
        }
        posterUrl.value = poster || "";
        tmdbCast.value = data.tmdbData.cast;
      }

      tmdbDubbingProjects.value = data.projects;

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

      if (data.crew) {
        data.crew.forEach((c) => {
          const name =
            `${c.voice_actors?.firstname || ""} ${c.voice_actors?.lastname || ""}`.trim();
          lookups.rememberVoiceActor(c.person_id, name);
        });
      }
      crewState.load(data.crew ?? []);

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
          castRows.value = pickOriginalCastSeed(
            tmdbCast.value.map((member) => ({ ...member, character: extractCastRoles(member) })),
          ).map((member) => ({
            key: createEditorRowKey(),
            actor_id: member.id,
            character_name: member.character.trim(),
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
