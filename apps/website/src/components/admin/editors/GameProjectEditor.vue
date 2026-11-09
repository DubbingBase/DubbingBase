<template>
  <AdminProjectEditorLayout
    v-model:section="section"
    :title="mediaTitle || $t('projectEditor.createGameProject')"
    :eyebrow="
      isEditMode ? $t('projectEditor.editGameProject') : $t('projectEditor.createGameProject')
    "
    :poster-url="posterUrl"
    :back-to="igdbGameId ? localePath(`/game/${igdbGameId}`) : localePath('/')"
    :back-label="igdbGameId ? $t('projectEditor.backToGame') : $t('projectEditor.backHome')"
    :chips="heroChips"
    :projects-base-path="igdbGameId ? `/game/${igdbGameId}` : null"
    :projects="gameDubbingProjects"
    :project-id-param="projectIdParam"
    :language-label="getDisplayLanguage"
    form-id="game-project-form"
    :save-label="$t('projectEditor.saveGameProject')"
    :form="form"
    :is-loading="isLoading"
    :load-error="loadError"
    :cast-count="castRows.length"
    @submit="saveGameProject"
  >
    <template #cast>
      <AdminProjectCastWorkspace
        v-model:selected-key="selectedCastKey"
        :rows="castView"
        :show-original-actor="false"
        @add="addCastRow"
        @remove="removeCastRow"
      >
        <template #detail>
          <div v-if="selectedRow" :key="selectedRow.key" class="space-y-5">
            <AdminFormField :label="$t('projectEditor.character')">
              <AdminAsyncAutocomplete
                v-model="selectedRow.character_ref"
                @update:model-value="
                  (val: string | number | null) => handleCharacterSelect(selectedRow!, val)
                "
                :options="initialCharacterOptions"
                :search-fn="searchCharacters"
                :placeholder="$t('projectEditor.searchGameCharacter')"
                :allow-create="true"
                :display-fn="
                  (id: string | number) => getCharacterName(id) || selectedRow!.character_name
                "
                @create="(query: string) => handleCharacterCreate(selectedRow!, query)"
              >
                <template #leading>
                  <AdminCastAvatar
                    size="xs"
                    :name="
                      selectedRow.character_name || getCharacterName(selectedRow.character_ref)
                    "
                    :src="characterImageById(selectedRow.character_ref)"
                  />
                </template>
                <template #option="{ option }">
                  <span class="flex items-center gap-2">
                    <AdminCastAvatar
                      size="sm"
                      :name="option.name"
                      :src="igdbImageUrl(option.mug_shot?.url)"
                    />{{ option.name }}
                  </span>
                </template>
              </AdminAsyncAutocomplete>
              <button
                type="button"
                class="text-xs theme-text-muted underline-offset-2 hover:underline"
                @click="handleCharacterFreeText(selectedRow!)"
              >
                {{ $t("projectEditor.gameFreeTextRole") }}
              </button>
              <p
                v-if="characterCatalogStatus === 'unavailable'"
                role="status"
                class="text-xs theme-status-warning-text"
              >
                {{ $t("projectEditor.gameCharactersUnavailable") }}
              </p>
              <p
                v-else-if="providerCharacterCount === 0"
                role="status"
                class="text-xs theme-text-muted"
              >
                {{ $t("projectEditor.gameNoProviderCharacters") }}
              </p>
              <div
                v-if="getLocalCharacter(selectedRow!)"
                class="mt-2 space-y-2 rounded-lg border theme-border theme-surface-muted p-3"
              >
                <div
                  v-for="candidate in getIgdbCandidates(selectedRow!)"
                  :key="candidate.id"
                  class="flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <span class="theme-text-secondary">
                    {{ $t("projectEditor.gamePossibleMatch", { name: candidate.name }) }}
                  </span>
                  <button
                    type="button"
                    class="theme-status-info-text underline-offset-2 hover:underline disabled:opacity-50"
                    :disabled="isUpdatingCharacterReferences"
                    @click="
                      updateGameCharacterReferences(selectedRow!, {
                        igdb_character_id: candidate.igdb_character_id,
                      })
                    "
                  >
                    {{ $t("projectEditor.gameConfirmLink") }}
                  </button>
                </div>
                <div class="flex flex-wrap items-end gap-2">
                  <label class="min-w-48 flex-1 text-xs theme-text-secondary">
                    {{ $t("projectEditor.gameWikidataQid") }}
                    <input
                      :value="getWikidataDraft(selectedRow!)"
                      type="text"
                      inputmode="text"
                      placeholder="Q12345"
                      class="mt-1 w-full rounded-lg border theme-border theme-input px-2 py-1.5"
                      @input="setWikidataDraft(selectedRow!, $event)"
                    />
                  </label>
                  <button
                    type="button"
                    class="theme-status-info-text underline-offset-2 hover:underline disabled:opacity-50"
                    :disabled="isUpdatingCharacterReferences"
                    @click="saveWikidataReference(selectedRow!)"
                  >
                    {{ $t("projectEditor.gameSaveQid") }}
                  </button>
                  <button
                    v-if="getLocalCharacter(selectedRow!)?.igdb_character_id"
                    type="button"
                    class="theme-status-danger-text underline-offset-2 hover:underline disabled:opacity-50"
                    :disabled="isUpdatingCharacterReferences"
                    @click="
                      updateGameCharacterReferences(selectedRow!, {
                        igdb_character_id: null,
                      })
                    "
                  >
                    {{ $t("projectEditor.gameUnlinkIgdb") }}
                  </button>
                </div>
              </div>
            </AdminFormField>

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
        :description="$t('projectEditor.igdbLinked')"
      >
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <AdminTextField
            v-model="contentId"
            id="game-project-igdb-id"
            type="number"
            required
            :disabled="!!igdbGameId"
            :label="$t('projectEditor.igdbGameId')"
          />
          <AdminTextField
            v-model="mediaTitle"
            id="game-project-title"
            required
            readonly
            :label="$t('admin.movieEditor.mediaTitle')"
          />
        </div>
      </AdminFormCard>
    </template>

    <template #settings>
      <AdminProjectSettingsCard
        v-model:language="dubbingLanguage"
        v-model:status="status"
        id-prefix="game-project"
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
import { ref, onMounted, computed, nextTick, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  createDubbingProjectSaveClient,
  createStableRequestIdFactory,
  getDubbingProjectSaveErrorMessage,
  getEditableDubbingProjectStatus,
  type DubbingProjectStatus,
  serializeGameProjectCastRows,
  type GameProjectCastEditorRow,
  type DubbingProjectSaveResponse,
} from "~/utils/dubbing-project-save";
import { useAdminLookups, type AdminLookupOption } from "~/composables/useAdminLookups";
import type { Tables } from "@app/supabase/types";
import type {
  EditorProjectCrew,
  EditorProjectRecord,
  EditorProjectWork,
} from "~/utils/admin-project-editor-types";
import { useFullCrewState } from "~/composables/useFullCrewState";
import type { EditorSection } from "~/components/admin/ProjectEditorLayout.vue";
import type { CastWorkspaceRow } from "~/utils/cast-workspace";
import { useDisplayLanguage } from "~/composables/useDisplayLanguage";
import { useEditorToast } from "~/composables/useEditorToast";
import { createEditorRowKey, useEditorFormState } from "~/composables/useEditorFormState";

const supabase = useSupabaseClient();
const saveDubbingProject = createDubbingProjectSaveClient((body) =>
  $fetch<DubbingProjectSaveResponse>("/api/save-dubbing-project", {
    method: "POST",
    body,
  }),
);
const characterReferenceRequestIds = createStableRequestIdFactory();
const gameCharacterCreateRequestIds = createStableRequestIdFactory();
const voiceActorCreateRequestIds = createStableRequestIdFactory();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const { t } = useI18n();

const gameIdParam = Array.isArray(route.params.gameId)
  ? route.params.gameId[0]
  : route.params.gameId;
const projectIdParam = Array.isArray(route.params.projectId)
  ? route.params.projectId[0]
  : route.params.projectId;

const isEditMode = computed(() => !!projectIdParam && projectIdParam !== "new");
const igdbGameId = computed(() =>
  gameIdParam && gameIdParam !== "new" ? Number(gameIdParam) : null,
);

const gameDubbingProjects = ref<GameProjectTab[]>([]);

// Form state
const contentId = ref<number | null>(null);
const mediaTitle = ref("");
const contentType = ref("video_game");
const dubbingLanguage = ref("");
const posterUrl = ref("");
const status = ref<DubbingProjectStatus>("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);

// Crew state
const crewState = useFullCrewState(t);

// Autocomplete State: each autocomplete owns its search results; labels are cached by id.
const lookups = useAdminLookups();
const initialStudioOptions = ref<SelectOption[]>([]);
const initialVoiceActorOptions = ref<SelectOption[]>([]);

// Dialog State
const isCreateStudioOpen = ref(false);
const newStudioName = ref("");
const isCreateVaOpen = ref(false);
const newVaQuery = ref("");
let pendingStudioSelect: ((id: number) => void) | null = null;
let pendingVaSelect: ((id: number) => void) | null = null;

// Cast Rows
type CastRow = GameProjectCastEditorRow;
const castRows = ref<CastRow[]>([]);

type SelectOption = AdminLookupOption;
type GameProjectTab = {
  id: number;
  language: string | null;
  studio_id: number | null;
  studios: { name: string | null } | null;
};
type GameProjectCrew = EditorProjectCrew;
type GameProjectWork = Omit<EditorProjectWork, "voice_actors"> &
  Pick<Tables<"work">, "game_character_id"> & {
    voice_actors: Pick<Tables<"voice_actors">, "firstname" | "lastname" | "profile_picture"> | null;
  };
type GameProjectRecord = Omit<EditorProjectRecord, "work"> & { work: GameProjectWork[] };
type GameApiResponse = {
  game: { name: string; cover?: { url?: string | null } | null } | null;
  characters: GameCharacterApiRow[];
  character_catalog_status: "available" | "unavailable";
};
type GameEditorData = {
  igdbData: GameApiResponse | null;
  projects: GameProjectTab[];
  project: GameProjectRecord | null;
  studioName: string | null;
  crew: GameProjectCrew[];
  works: GameProjectWork[];
  initialStudios: SelectOption[];
  initialVoiceActors: SelectOption[];
};

type GameCharacterOption = {
  id: number | string;
  name: string;
  game_character_id: string | null;
  igdb_character_id: number | null;
  wikidata_qid: string | null;
  identity_source: "igdb" | "local";
  local_name: string | null;
  local_updated_at: string | null;
  igdb_candidate_ids: number[];
  mug_shot?: { image_id: string; url?: string } | null;
};

type GameCharacterApiRow = Omit<GameCharacterOption, "id"> & {
  id: number | null;
  stable_id: string;
};

const { toast, showToast } = useEditorToast();

const getDisplayLanguage = useDisplayLanguage();

const isCreatingGameCharacter = ref(false);
const isUpdatingCharacterReferences = ref(false);
const wikidataDrafts = ref<Record<string, string>>({});
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
// Workspace presentation state
const section = ref<EditorSection>("cast");
const heroChips = computed(() =>
  [
    dubbingLanguage.value ? getDisplayLanguage(dubbingLanguage.value) : "",
    selectedStudioId.value ? lookups.studioLabel(selectedStudioId.value) : "",
    t(`admin.movieEditor.${status.value}`),
  ].filter((chip) => chip.length > 0),
);
const selectedCastKey = ref<string | null>(null);
const selectedRow = computed(
  () => castRows.value.find((row) => row.key === selectedCastKey.value) ?? null,
);

const addCastRow = () => {
  const key = createEditorRowKey();
  selectedCastKey.value = key;
  section.value = "cast";
  castRows.value.push({
    key,
    character_ref: null,
    character_id: null,
    game_character_id: null,
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

const igdbCharacters = ref<GameCharacterOption[]>([]);
const initialCharacterOptions = computed(() => igdbCharacters.value.slice(0, 50));
const characterCatalogStatus = ref<"available" | "unavailable">("available");
const providerCharacterCount = computed(
  () => igdbCharacters.value.filter((character) => character.identity_source === "igdb").length,
);
let lastCharacterQuery = "";

const searchCharacters = (query: string) => {
  lastCharacterQuery = query;
  if (!query) return igdbCharacters.value.slice(0, 50);
  return igdbCharacters.value
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50);
};

const getCharacterName = (id: number | string | null) => {
  if (!id) return "";
  const char = igdbCharacters.value.find((c) => c.id === id);
  return char ? char.name : "";
};

const handleCharacterSelect = (row: CastRow, val: number | string | null) => {
  if (val === null) {
    row.character_ref = null;
    row.character_id = null;
    row.game_character_id = null;
    row.character_name = "";
    return;
  }
  const char = igdbCharacters.value.find((c) => c.id === val);
  if (char) {
    row.character_ref = char.id;
    row.character_id = char.igdb_character_id;
    row.game_character_id = char.game_character_id;
    row.character_name = char.game_character_id ? char.local_name || char.name : char.name;
  }
};

const handleCharacterFreeText = (row: CastRow) => {
  const name = lastCharacterQuery.trim() || row.character_name.trim();
  if (!name) {
    showToast(t("projectEditor.gameEnterRoleName"), "error");
    return;
  }
  row.character_ref = `custom_${name}`;
  row.character_id = null;
  row.game_character_id = null;
  row.character_name = name;
  lastCharacterQuery = "";
};

const handleCharacterCreate = async (row: CastRow, query: string) => {
  if (isCreatingGameCharacter.value) return;
  const gameId = contentId.value ?? igdbGameId.value;
  const name = query.trim();
  if (!gameId || !name) return;

  const payload = { igdb_game_id: gameId, name };
  isCreatingGameCharacter.value = true;
  try {
    const created = await $fetch<{
      character: { id: string };
    }>("/api/game-characters", {
      method: "POST",
      body: {
        request_id: gameCharacterCreateRequestIds.forPayload(payload),
        ...payload,
      },
    });
    await reloadGameCharacterOptions();
    const local = igdbCharacters.value.find(
      (character) =>
        character.identity_source === "local" &&
        character.game_character_id === created.character.id,
    );
    if (!local) throw new Error("Created game character was not returned");

    gameCharacterCreateRequestIds.clear();
    handleCharacterSelect(row, local.id);
  } catch (error) {
    showToast(getDubbingProjectSaveErrorMessage(error), "error");
  } finally {
    isCreatingGameCharacter.value = false;
  }
};

const getLocalCharacter = (row: CastRow) =>
  row.game_character_id
    ? (igdbCharacters.value.find(
        (character) => character.game_character_id === row.game_character_id,
      ) ?? null)
    : null;

const getIgdbCandidates = (row: CastRow) => {
  const local = getLocalCharacter(row);
  if (!local) return [];
  return local.igdb_candidate_ids.flatMap((id: number) => {
    const candidate = igdbCharacters.value.find(
      (character) => character.identity_source === "igdb" && character.igdb_character_id === id,
    );
    return candidate ? [candidate] : [];
  });
};

const getWikidataDraft = (row: CastRow) => {
  if (!row.game_character_id) return "";
  return wikidataDrafts.value[row.game_character_id] ?? getLocalCharacter(row)?.wikidata_qid ?? "";
};

const setWikidataDraft = (row: CastRow, event: Event) => {
  if (!row.game_character_id || !(event.target instanceof HTMLInputElement)) return;
  wikidataDrafts.value[row.game_character_id] = event.target.value;
};

const reloadGameCharacterOptions = async () => {
  const gameId = contentId.value ?? igdbGameId.value;
  if (!gameId) return;
  const data = await $fetch<{
    characters: GameCharacterApiRow[];
    character_catalog_status: "available" | "unavailable";
  }>(`/api/game/${gameId}`);
  characterCatalogStatus.value = data.character_catalog_status;
  igdbCharacters.value = data.characters.map((character) => ({
    ...character,
    id: character.stable_id ?? `igdb_character:${character.id}`,
  }));
  for (const row of castRows.value) {
    if (!row.game_character_id) continue;
    const localCharacter = igdbCharacters.value.find(
      (character) =>
        character.identity_source === "local" &&
        character.game_character_id === row.game_character_id,
    );
    if (localCharacter) row.character_id = localCharacter.igdb_character_id;
  }
};

const updateGameCharacterReferences = async (
  row: CastRow,
  references: {
    igdb_character_id?: number | null;
    wikidata_qid?: string | null;
  },
) => {
  const local = getLocalCharacter(row);
  if (!local || !local.local_updated_at || !row.game_character_id) return;
  const payload = {
    game_character_id: row.game_character_id,
    expected_updated_at: local.local_updated_at,
    ...references,
  };
  isUpdatingCharacterReferences.value = true;
  try {
    await $fetch(`/api/game-characters/${row.game_character_id}`, {
      method: "PUT",
      body: {
        request_id: characterReferenceRequestIds.forPayload(payload),
        expected_updated_at: payload.expected_updated_at,
        ...references,
      },
    });
    characterReferenceRequestIds.clear();
    await reloadGameCharacterOptions();
    showToast(t("projectEditor.gameReferenceUpdated"), "success");
  } catch (error) {
    showToast(getDubbingProjectSaveErrorMessage(error), "error");
  } finally {
    isUpdatingCharacterReferences.value = false;
  }
};

const saveWikidataReference = async (row: CastRow) => {
  const qid = getWikidataDraft(row).trim();
  if (qid && !/^Q[1-9][0-9]*$/.test(qid)) {
    showToast(t("projectEditor.gameInvalidQid"), "error");
    return;
  }
  await updateGameCharacterReferences(row, { wikidata_qid: qid || null });
};

// IGDB mug shots are protocol-relative URLs.
const igdbImageUrl = (url: string | null | undefined): string | null =>
  url ? (url.startsWith("//") ? `https:${url}` : url) : null;
const characterImageById = (id: number | string | null): string | null =>
  igdbImageUrl(igdbCharacters.value.find((character) => character.id === id)?.mug_shot?.url);
const castView = computed<CastWorkspaceRow[]>(() =>
  castRows.value.map((row) => ({
    key: row.key,
    characterName: row.character_name || getCharacterName(row.character_ref),
    characterImage: characterImageById(row.character_ref),
    originalActorName: "",
    originalActorImage: null,
    voiceActorName: row.voice_actor_id ? lookups.voiceActorLabel(row.voice_actor_id) : "",
    voiceActorImage: lookups.voiceActorImage(row.voice_actor_id),
    assigned: row.voice_actor_id !== null,
    performance: row.performance,
    highlight: row.highlight,
  })),
);

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

const saveGameProject = async () => {
  if (!contentId.value) return showToast(t("projectEditor.igdbIdRequired"), "error");
  if (!dubbingLanguage.value) return showToast(t("projectEditor.languageRequired"), "error");
  form.beginSave();
  try {
    let projectId = isEditMode.value ? Number(projectIdParam) : null;
    const crew = crewState.toSaveRows();

    const cast = serializeGameProjectCastRows(castRows.value);

    const result = await saveDubbingProject({
      project_id: projectId,
      expected_updated_at: projectId === null ? null : projectUpdatedAt.value,
      project: {
        content_id: contentId.value,
        content_type: "video_game",
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
      await router.push(localePath(`/game/${contentId.value}/projects/${projectId}/edit`));
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
  `game-edit-${igdbGameId.value}-${projectIdParam}`,
  async () => {
    let igdbData: GameApiResponse | null = null;
    let projects: GameProjectTab[] = [];
    let project: GameProjectRecord | null = null;
    let studioName: string | null = null;
    let crew: GameProjectCrew[] = [];
    let works: GameProjectWork[] = [];

    if (igdbGameId.value) {
      // IGDB metadata
      try {
        const data = await $fetch<GameApiResponse>(`/api/game/${igdbGameId.value}`);
        if (data) {
          igdbData = data;
        }
      } catch (e) {
        console.error("Failed to fetch IGDB data.", e);
      }

      // Fetch all dubbing projects for this game for the tabs
      const { data: pData } = await supabase
        .from("dubbing_projects")
        .select("id, language, studio_id, studios(name)")
        .eq("content_id", igdbGameId.value)
        .eq("content_type", "video_game");
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
      igdbData,
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
      if (data.igdbData) {
        contentId.value = igdbGameId.value;
        characterCatalogStatus.value =
          data.igdbData.character_catalog_status === "unavailable" ? "unavailable" : "available";
        if (data.igdbData.game) {
          mediaTitle.value = data.igdbData.game.name;
          posterUrl.value = data.igdbData.game.cover?.url?.replace("t_thumb", "t_cover_big") || "";
        }
        if (data.igdbData.characters) {
          igdbCharacters.value = data.igdbData.characters.map((character: GameCharacterApiRow) => ({
            ...character,
            id: character.stable_id ?? `igdb_character:${character.id}`,
          }));
        }
      }

      gameDubbingProjects.value = data.projects;

      if (data.project) {
        contentId.value = data.project.content_id;
        contentType.value = data.project.content_type;
        dubbingLanguage.value = data.project.language || "";
        status.value = getEditableDubbingProjectStatus(data.project.status);
        selectedStudioId.value = data.project.studio_id;
        projectUpdatedAt.value = data.project.updated_at;
        if (data.studioName && data.project.studio_id !== null) {
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
        castRows.value = data.works.map((w) => {
          const linkedCharacter =
            w.game_character_id || w.character_id === null
              ? null
              : igdbCharacters.value.find(
                  (character) =>
                    character.identity_source === "local" &&
                    character.igdb_character_id === w.character_id,
                );
          const gameCharacterId = w.game_character_id ?? linkedCharacter?.game_character_id ?? null;
          if (w.voice_actors && w.voice_actor_id !== null) {
            const name =
              `${w.voice_actors.firstname || ""} ${w.voice_actors.lastname || ""}`.trim();
            lookups.rememberVoiceActor(w.voice_actor_id, name, w.voice_actors.profile_picture);
          }
          return {
            key: createEditorRowKey(),
            id: w.id,
            character_ref: gameCharacterId
              ? `game_character:${gameCharacterId}`
              : w.character_id
                ? `igdb_character:${w.character_id}`
                : null,
            character_id: w.character_id,
            game_character_id: gameCharacterId,
            character_name: w.character_name || "",
            voice_actor_id: w.voice_actor_id,
            performance: w.performance || "dialogues",
            note: w.note || "",
            highlight: w.highlight ?? false,
            expectedUpdatedAt: w.updated_at,
            expected: {
              actor_id: w.actor_id,
              character_id: w.character_id,
              game_character_id: w.game_character_id ?? null,
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
        data.initialVoiceActors.forEach((f) => lookups.rememberVoiceActor(f.id, f.name, f.image));
      }

      isLoading.value = false;
      form.markClean();
    }
  },
  { immediate: true },
);
</script>
