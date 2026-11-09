<template>
  <AdminProjectEditorLayout
    v-model:section="section"
    :title="
      mediaTitle ||
      (isEditMode
        ? 'Modifier le projet de jouet interactif / conteuse'
        : 'Créer un projet de jouet interactif / conteuse')
    "
    :eyebrow="
      isEditMode
        ? 'Modifier le projet de jouet interactif / conteuse'
        : 'Créer un projet de jouet interactif / conteuse'
    "
    :poster-url="coverUrl"
    :back-to="parsedToyId ? localePath(`/toy/${parsedToyId}`) : localePath('/')"
    :back-label="parsedToyId ? $t('projectEditor.backToToy') : $t('projectEditor.backHome')"
    :chips="heroChips"
    :projects-base-path="parsedToyId ? `/toy/${parsedToyId}` : null"
    :projects="toyDubbingProjects"
    :project-id-param="projectIdParam"
    :language-label="getDisplayLanguage"
    form-id="toy-project-form"
    :save-label="isEditMode ? $t('projectEditor.saveChanges') : $t('projectEditor.createProject')"
    :form="form"
    :is-loading="isLoading"
    :cast-count="castList.length"
    @submit="saveToyProject"
  >
    <template #cast>
      <AdminProjectCastWorkspace
        v-model:selected-key="selectedCastKey"
        :rows="castView"
        :show-original-actor="false"
        @add="addNewCastRow"
        @remove="removeCastRow"
      >
        <template #detail>
          <AdminSimpleCastRoleDetail
            v-if="selectedRow"
            :key="selectedRow.key"
            v-model:voice-actor-id="selectedRow.voice_actor_id"
            v-model:character-name="selectedRow.character_name"
            v-model:performance="selectedRow.performance"
            v-model:note="selectedRow.note"
            :voice-actor-options="initialVoiceActorOptions"
            :lookups="lookups"
            :role-label="$t('common.characterRole')"
            @create-voice-actor="
              (query: string) =>
                openCreateVaDialog(query, (id: number) => (selectedRow!.voice_actor_id = id))
            "
          />
        </template>
      </AdminProjectCastWorkspace>
    </template>

    <template #overview>
      <AdminFormCard
        :title="$t('toyEditor.objectInfo')"
        :description="$t('toyEditor.toyStoryteller')"
      >
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <AdminTextField
            v-if="parsedToyId"
            v-model="contentId"
            id="toy-project-content-id"
            type="number"
            required
            disabled
            :label="$t('toyEditor.toyId')"
          />
          <AdminTextField
            v-model="mediaTitle"
            id="toy-project-title"
            required
            :label="$t('toyEditor.productName')"
          />
          <AdminTextField
            v-model="manufacturer"
            id="toy-project-manufacturer"
            :maxlength="300"
            :label="$t('toy.manufacturerLabel')"
          />
          <AdminTextField
            v-model="productLine"
            id="toy-project-line"
            :maxlength="300"
            :label="$t('toy.productLine')"
          />
          <AdminTextField
            v-model="releaseYear"
            id="toy-project-year"
            type="number"
            min="1800"
            max="2200"
            :label="$t('toy.releaseYear')"
          />
          <AdminTextField
            v-model="coverUrl"
            id="toy-project-cover"
            type="url"
            :maxlength="2048"
            :label="$t('toy.coverImageLabel')"
          />
        </div>
        <AdminTextField
          v-model="description"
          id="toy-project-description"
          multiline
          :rows="4"
          :maxlength="10000"
          :label="$t('toy.description')"
        />
      </AdminFormCard>
    </template>

    <template #settings>
      <AdminProjectSettingsCard
        v-model:language="dubbingLanguage"
        v-model:status="status"
        id-prefix="toy-project"
      />
    </template>

    <template #crew>
      <AdminProjectCrewCard
        v-model:studio-id="selectedStudioId"
        :title="$t('toyEditor.manufacturerStudio')"
        :description="$t('common.production')"
        :studio-label="$t('toyEditor.studioManufacturer')"
        :fields="crewFields"
        :crew="crewValues"
        :studio-options="initialStudioOptions"
        :voice-actor-options="initialVoiceActorOptions"
        :lookups="lookups"
        @update:crew="setCrewMember"
        @create-studio="openCreateStudioDialog"
        @create-voice-actor="openCreateVaDialog"
      />
    </template>

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
  </AdminProjectEditorLayout>
</template>

<script setup lang="ts">
import { validateDubbingLanguage } from "@app/shared-logic";
import type { Toy, ToyMetadataInput } from "@app/shared-logic";
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
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
import type { EditorSection } from "~/components/admin/ProjectEditorLayout.vue";
import { useDisplayLanguage } from "~/composables/useDisplayLanguage";
import { useCrewRefs } from "~/composables/useCrewRefs";
import { useSimpleCastWorkspace } from "~/composables/useSimpleCastWorkspace";
import { firstRouteParam } from "~/utils/route-param";

const { t } = useI18n();
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
const saveToyMetadata = (body: {
  request_id: string;
  content_id: number;
  expected_updated_at: string | null;
  metadata: ToyMetadataInput;
}) =>
  $fetch<{
    toy: { updated_at?: string };
    auditLogId: string;
    replayed: boolean;
  }>("/api/save-toy-metadata", { method: "POST", body });

const toyIdParam = computed(() => firstRouteParam(route.params.toyId) ?? "");
const projectIdParam = computed(() => firstRouteParam(route.params.projectId) ?? "");

const isEditMode = computed(() => projectIdParam.value && projectIdParam.value !== "new");

const parsedToyId = computed(() => {
  const num = parseInt(toyIdParam.value, 10);
  return isNaN(num) ? null : num;
});

const contentId = ref<number | null>(parsedToyId.value);
const mediaTitle = ref("");
const manufacturer = ref("");
const productLine = ref("");
const releaseYear = ref<number | string | null>(null);
const coverUrl = ref("");
const description = ref("");
const toyMetadataUpdatedAt = ref<string | null>(null);
const loadedToyMetadata = ref<ToyMetadataInput | null>(null);
const toyMetadataLoadFailed = ref(false);
const createdToy = ref<{
  contentId: number;
  projectId: number;
  projectUpdatedAt: string;
  metadataUpdatedAt: string;
  metadata: ToyMetadataInput;
} | null>(null);
const internalMediaRequestId = ref<string | null>(null);
const dubbingLanguage = ref("");
const status = ref<DubbingProjectStatus>("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);
const artisticDirectorId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);

type CastRow = EditorCastRowBase;

const castList = ref<CastRow[]>([]);
const toyDubbingProjects = ref<EditorProjectTab[]>([]);
const isLoading = ref(true);

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
    title: mediaTitle.value,
    manufacturer: manufacturer.value,
    productLine: productLine.value,
    releaseYear: releaseYear.value,
    coverUrl: coverUrl.value,
    description: description.value,
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
    mediaTitle.value = saved.title;
    manufacturer.value = saved.manufacturer;
    productLine.value = saved.productLine;
    releaseYear.value = saved.releaseYear;
    coverUrl.value = saved.coverUrl;
    description.value = saved.description;
    castList.value = saved.castList;
  },
});
// Workspace presentation state
const section = ref<EditorSection>("cast");
const heroChips = computed(() =>
  [
    dubbingLanguage.value ? getDisplayLanguage(dubbingLanguage.value) : "",
    selectedStudioId.value ? lookups.studioLabel(selectedStudioId.value) : "",
    t(status.value === "pending" ? "common.pendingValidation" : `common.${status.value}`),
  ].filter((chip) => chip.length > 0),
);
const crewFields = computed(() => [
  {
    key: "artisticDirector",
    label: t("toyEditor.artisticDirection"),
  },
  { key: "recording", label: t("toyEditor.recording") },
  { key: "mixing", label: t("toyEditor.mixing") },
]);
const { crewValues, setCrewMember } = useCrewRefs({
  artisticDirector: artisticDirectorId,
  recording: recordingId,
  mixing: mixingId,
});

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

const {
  selectedKey: selectedCastKey,
  selectedRow,
  castView,
  addRow: addNewCastRow,
  removeRow: removeCastRow,
} = useSimpleCastWorkspace(castList, lookups, {
  characterName: "Voix / Personnage",
  performance: "Narration",
});

const getDisplayLanguage = useDisplayLanguage();

onMounted(async () => {
  try {
    if (parsedToyId.value) {
      try {
        const response = await $fetch<{ toy: Toy | null }>(
          `/api/toy-metadata/${parsedToyId.value}`,
        );
        if (response.toy) {
          mediaTitle.value = response.toy.name;
          manufacturer.value = response.toy.manufacturer || "";
          productLine.value = response.toy.product_line || "";
          releaseYear.value = response.toy.release_year ?? null;
          coverUrl.value = response.toy.cover_url || "";
          description.value = response.toy.description || "";
          toyMetadataUpdatedAt.value = response.toy.updated_at || null;
          loadedToyMetadata.value = readToyMetadataForm();
        }
      } catch (err) {
        toyMetadataLoadFailed.value = true;
        console.error("Error loading toy metadata:", err);
      }

      const { data: projects } = await supabase
        .from("dubbing_projects")
        .select("*, studios(id, name)")
        .eq("content_id", parsedToyId.value)
        .eq("content_type", "toy");

      toyDubbingProjects.value = projects || [];
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
    console.error("Error loading toy project:", err);
  } finally {
    isLoading.value = false;
    form.markClean();
  }
});

async function saveToyProject() {
  if (parsedToyId.value !== null && (contentId.value === null || contentId.value === 0)) return;
  form.beginSave();

  try {
    let savedContentId = contentId.value;
    let currentProjectId = isEditMode.value ? Number(projectIdParam.value) : null;
    let expectedProjectUpdatedAt = projectUpdatedAt.value;
    const metadata = readToyMetadataForm();

    if (parsedToyId.value === null) {
      if (!createdToy.value) {
        internalMediaRequestId.value ||= crypto.randomUUID();
        const response = await $fetch<{
          media: { id: number };
          project: {
            id: number;
            updated_at: string;
            metadata_updated_at: string | null;
          };
        }>("/api/internal-media-create", {
          method: "POST",
          body: {
            request_id: internalMediaRequestId.value,
            media_type: "toy",
            name: metadata.name,
            brand: metadata.manufacturer,
            manufacturer: metadata.manufacturer,
            product_line: metadata.product_line,
            release_year: metadata.release_year,
            cover_url: metadata.cover_url,
            description: metadata.description,
            dubbing_language: validateDubbingLanguage(dubbingLanguage.value),
          },
        });
        if (!response.project.metadata_updated_at) {
          throw new Error("Toy metadata was not returned after creation.");
        }
        createdToy.value = {
          contentId: response.media.id,
          projectId: response.project.id,
          projectUpdatedAt: response.project.updated_at,
          metadataUpdatedAt: response.project.metadata_updated_at,
          metadata,
        };
      } else if (JSON.stringify(metadata) !== JSON.stringify(createdToy.value.metadata)) {
        const savedMetadata = await saveToyMetadata({
          request_id: crypto.randomUUID(),
          content_id: createdToy.value.contentId,
          expected_updated_at: createdToy.value.metadataUpdatedAt,
          metadata,
        });
        createdToy.value.metadataUpdatedAt =
          savedMetadata.toy.updated_at || createdToy.value.metadataUpdatedAt;
        createdToy.value.metadata = metadata;
      }

      savedContentId = createdToy.value.contentId;
      contentId.value = savedContentId;
      currentProjectId = createdToy.value.projectId;
      expectedProjectUpdatedAt = createdToy.value.projectUpdatedAt;
      toyMetadataUpdatedAt.value = createdToy.value.metadataUpdatedAt;
      loadedToyMetadata.value = createdToy.value.metadata;
    } else {
      if (toyMetadataLoadFailed.value) {
        throw new Error("Reload this toy metadata before saving.");
      }
      if (JSON.stringify(metadata) !== JSON.stringify(loadedToyMetadata.value)) {
        const savedMetadata = await saveToyMetadata({
          request_id: crypto.randomUUID(),
          content_id: parsedToyId.value,
          expected_updated_at: toyMetadataUpdatedAt.value,
          metadata,
        });
        toyMetadataUpdatedAt.value = savedMetadata.toy.updated_at || null;
        loadedToyMetadata.value = metadata;
      }
      savedContentId = parsedToyId.value;
    }

    if (savedContentId === null || savedContentId === 0) {
      throw new Error("A toy content id is required.");
    }

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
      expected_updated_at: currentProjectId === null ? null : expectedProjectUpdatedAt,
      project: {
        content_id: savedContentId,
        content_type: "toy",
        language: validateDubbingLanguage(dubbingLanguage.value),
        status: status.value,
        studio_id: selectedStudioId.value,
      },
      crew,
      cast,
    });
    projectUpdatedAt.value = result.updatedAt;

    form.saveSucceeded();
    await router.push(localePath(`/toy/${savedContentId}`));
  } catch (err) {
    console.error("Failed to save toy project:", err);
    form.saveFailed(getDubbingProjectSaveErrorMessage(err));
  }
}

function readToyMetadataForm(): ToyMetadataInput {
  const rawReleaseYear = releaseYear.value;
  const parsedReleaseYear =
    rawReleaseYear === null || rawReleaseYear === "" ? null : Number(rawReleaseYear);
  if (
    parsedReleaseYear !== null &&
    (!Number.isSafeInteger(parsedReleaseYear) ||
      parsedReleaseYear < 1800 ||
      parsedReleaseYear > 2200)
  ) {
    throw new Error("Release year must be between 1800 and 2200.");
  }

  return {
    name: mediaTitle.value.trim(),
    manufacturer: manufacturer.value.trim() || null,
    product_line: productLine.value.trim() || null,
    release_year: parsedReleaseYear,
    cover_url: coverUrl.value.trim() || null,
    description: description.value.trim() || null,
  };
}
</script>
