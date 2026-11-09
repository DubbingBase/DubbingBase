<template>
  <AdminProjectEditorLayout
    v-model:section="section"
    :title="
      mediaTitle ||
      (isEditMode ? 'Modifier le projet publicitaire' : 'Créer un projet publicitaire')
    "
    :eyebrow="
      isEditMode
        ? $t('projectEditor.editAdvertisementProject')
        : $t('projectEditor.createAdvertisementProject')
    "
    :poster-url="''"
    :back-to="parsedAdId ? localePath(`/advertisement/${parsedAdId}`) : localePath('/')"
    :back-label="
      parsedAdId ? $t('projectEditor.backToAdvertisement') : $t('projectEditor.backHome')
    "
    :chips="heroChips"
    :projects-base-path="parsedAdId ? `/advertisement/${parsedAdId}` : null"
    :projects="adDubbingProjects"
    :project-id-param="projectIdParam"
    :language-label="getDisplayLanguage"
    form-id="advertisement-project-form"
    :save-label="isEditMode ? $t('projectEditor.saveChanges') : $t('projectEditor.createProject')"
    :form="form"
    :is-loading="isLoading"
    :cast-count="castList.length"
    @submit="saveAdProject"
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
            :role-label="$t('common.roleCharacter')"
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
        :title="$t('advertisementEditor.spotInfo')"
        :description="$t('advertisementEditor.campaign')"
      >
        <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
          <AdminTextField
            v-model="contentId"
            id="advertisement-project-content-id"
            type="number"
            required
            :disabled="!!parsedAdId"
            :label="$t('advertisementEditor.adId')"
          />
          <AdminTextField
            v-model="mediaTitle"
            id="advertisement-project-title"
            required
            :label="$t('advertisementEditor.spotTitle')"
          />
        </div>
      </AdminFormCard>
    </template>

    <template #settings>
      <AdminProjectSettingsCard
        v-model:language="dubbingLanguage"
        v-model:status="status"
        id-prefix="advertisement-project"
      />
    </template>

    <template #crew>
      <AdminProjectCrewCard
        v-model:studio-id="selectedStudioId"
        :title="$t('advertisementEditor.advertiserStudio')"
        :description="$t('common.production')"
        :studio-label="$t('advertisementEditor.soundStudioAgency')"
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

const adIdParam = computed(() => firstRouteParam(route.params.adId) ?? "");
const projectIdParam = computed(() => firstRouteParam(route.params.projectId) ?? "");

const isEditMode = computed(() => projectIdParam.value && projectIdParam.value !== "new");

const parsedAdId = computed(() => {
  const num = parseInt(adIdParam.value, 10);
  return isNaN(num) ? null : num;
});

const contentId = ref<number | null>(parsedAdId.value);
const mediaTitle = ref("");
const dubbingLanguage = ref("");
const status = ref<DubbingProjectStatus>("validated");
const selectedStudioId = ref<number | null>(null);
const projectUpdatedAt = ref<string | null>(null);
const artisticDirectorId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);

type CastRow = EditorCastRowBase;

const castList = ref<CastRow[]>([]);
const adDubbingProjects = ref<EditorProjectTab[]>([]);
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
    label: t("advertisementEditor.artisticDirectionCasting"),
  },
  { key: "recording", label: t("audiobookEditor.recordingEngineer") },
  { key: "mixing", label: t("advertisementEditor.mixagePub") },
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
  characterName: "Voix off",
  performance: "Voix off",
});

const getDisplayLanguage = useDisplayLanguage();

onMounted(async () => {
  try {
    if (parsedAdId.value) {
      const { data: projects } = await supabase
        .from("dubbing_projects")
        .select("*, studios(id, name)")
        .eq("content_id", parsedAdId.value)
        .eq("content_type", "advertisement");

      adDubbingProjects.value = projects || [];
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
              character_name: w.character_name || "Voix off",
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
    console.error("Error loading ad project:", err);
  } finally {
    isLoading.value = false;
    form.markClean();
  }
});

async function saveAdProject() {
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
        content_type: "advertisement",
        language: validateDubbingLanguage(dubbingLanguage.value),
        status: status.value,
        studio_id: selectedStudioId.value,
      },
      crew,
      cast,
    });
    projectUpdatedAt.value = result.updatedAt;

    form.saveSucceeded();
    await router.push(localePath(`/advertisement/${contentId.value}`));
  } catch (err) {
    console.error("Failed to save ad project:", err);
    form.saveFailed(getDubbingProjectSaveErrorMessage(err));
  }
}
</script>
