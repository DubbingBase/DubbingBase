<template>
  <div class="dubbing-projects-view">
    <div v-if="isFullyLoading" class="flex justify-center p-4">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="text-center text-red-500 mt-4 p-4">
      {{ error }}
    </div>

    <div v-else-if="projects.length === 0" class="flex flex-col h-full">
      <!-- Fallback when no dubbing projects exist: just render the original cast with potentially legacy un-migrated voice actors -->
      <div>
        <ActorList
          :actors="actors"
          :is-admin="isAdmin"
          :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
          :go-to-actor="goToActor"
          :go-to-voice-actor="goToVoiceActor"
          :edit-voice-actor-link="editVoiceActorLink"
          :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
          :open-voice-actor-search="openVoiceActorSearch"
          :loading="isFullyLoading"
          :mediaLanguage="mediaLanguage"
          :workType="contentType === 'season' ? 'tv' : contentType"
          :contentId="contentId?.toString() || ''"
        />
      </div>
    </div>

    <div v-else class="flex flex-col h-full">
      <!-- Show segment header for all projects -->
      <div class="px-4 py-2 w-full flex items-center gap-2">
        <ion-select v-model="activeProjectId" class="project-select flex-1" interface="action-sheet" placeholder="Select Language">
          <ion-select-option
            v-for="project in projects"
            :key="project.id"
            :value="project.id.toString()"
          >
            {{ getLanguageDisplayName(project.language || '', locale) }}
          </ion-select-option>
        </ion-select>

        <AppButton
          v-if="isAdmin && activeProjectId"
          fill="clear"
          @click="goToEditProject"
          aria-label="Edit Dubbing Project"
        >
          <Pencil class="w-5 h-5 text-gray-400" />
        </AppButton>
      </div>

      <div class="flex-1 mt-4">
        <div
          v-for="project in projects"
          :key="project.id"
          v-show="project.id.toString() === activeProjectId"
          class="crew-cast-segment"
        >
          <!-- Cast Segment -->
          <div class="segment">
            <div class="segment-header">
              <h3 class="segment-title">{{ t("dubbing.cast", "Casting") }}</h3>
            </div>
            <!-- Reuse the existing ActorList logic but scoped to this project's works.
                  For simplicity, we pass down the globally fetched actors and filter the works
                  that belong to this project -->
            <ActorList
              :actors="actors"
              :voice-actors="getVoiceActorsForProject(project)"
              :is-admin="isAdmin"
              :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
              :go-to-actor="goToActor"
              :go-to-voice-actor="goToVoiceActor"
              :edit-voice-actor-link="editVoiceActorLink"
              :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
              :open-voice-actor-search="openVoiceActorSearch"
              :loading="isFullyLoading"
              :mediaLanguage="mediaLanguage"
              :workType="contentType === 'season' ? 'tv' : contentType"
              :contentId="contentId?.toString() || ''"
            />
          </div>

          <!-- Technical Team Segment -->
          <div class="segment technical-team">
            <div class="segment-header">
              <h3 class="segment-title">
                {{ t("dubbing.technicalTeam", "Équipe technique") }}
              </h3>
            </div>

            <div class="segment-content">
              <div
                v-if="
                  project.studio_data?.name ||
                  (project.crew && project.crew.length > 0)
                "
                class="technical-team-card"
              >
                <div class="technical-team-grid">
                  <div
                    v-if="project.studio_data"
                    class="info-item full-width-item mb-4"
                  >
                    <StudioCard :studio="project.studio_data" />
                  </div>

                  <!-- Dynamic Crew display -->
                  <div class="full-width-item">
                    <CrewList :groupedCrew="groupCrewByJob(project.crew)" />
                  </div>
                </div>
              </div>
              <div v-else class="technical-team-empty">
                <EmptyState :text="t('common.noInfo', 'Non renseigné')" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { IonSelect, IonSelectOption } from "@ionic/vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import EmptyState from "@/components/common/EmptyState.vue";


import CrewList from "./CrewList.vue";
import StudioCard from "./StudioCard.vue";
import ActorList from "@/components/ActorList.vue";
import { useI18n } from "vue-i18n";
import { PersonData } from "@/components/PersonItem.vue";
import AppButton from "@/components/common/AppButton.vue";
import Pencil from "~icons/lucide/pencil";
import { useRouter } from "vue-router";
import { getLanguageDisplayName } from "@/utils/language";

const { t, locale } = useI18n();
const router = useRouter();

const props = defineProps<{
  contentId: string | number;
  contentType: "movie" | "tv" | "season";
  projects?: DubbingProject[];

  // Dependencies required by ActorList
  actors?: PersonData<any>[];
  isAdmin?: boolean;
  getVoiceActorByTmdbId?: (tmdbId: number) => void;
  goToActor: (id: number) => void;
  goToVoiceActor: (id: number) => void;
  editVoiceActorLink?: (va: any) => void;
  confirmDeleteVoiceActorLink?: (person: any) => void;
  openVoiceActorSearch?: (actorId: number) => void;
  mediaLanguage?: string;
  parentLoading?: boolean;
}>();

export interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture?: string | null;
  bio?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  awards?: string | null;
  years_active?: string | null;
  social_media_links?: any;
  tmdb_id?: number | null;
  wikidata_id?: string | null;
}

export interface WorkPerformance {
  id: number;
  actor_id: number;
  voice_actor_id: number | null;
  highlight: boolean | null;
  suggestions: string | null;
  status: string | null;
  source_id: number | null;
  performance: string | null;
  dubbing_project_id: number;
  voice_actor: VoiceActor | null;
}

export interface DubbingProject {
  id: number;
  content_id: number;
  content_type: string;
  language: string | null;
  studio_id: number | null;
  studio_data?: any;
  status: string | null;
  works: WorkPerformance[];
  crew: any[];
}

const projects = computed(() => props.projects || []);
const error = ref<string | null>(null);

const goToEditProject = () => {
  if (activeProjectId.value) {
    router.push(`/edit-dubbing-project/${activeProjectId.value}`);
  }
};
const activeProjectId = ref<string>("");

const isFullyLoading = computed(() => !!props.parentLoading);

const updateActiveProject = () => {
  if (projects.value.length > 0 && !activeProjectId.value) {
    activeProjectId.value = projects.value[0].id.toString();
  } else if (projects.value.length === 0) {
    activeProjectId.value = "";
  }
};

watch(
  () => projects.value,
  () => {
    updateActiveProject();
  },
  { immediate: true, deep: true }
);

// Map WorkPerformance -> VoiceActor details matching what ActorList expects
const getVoiceActorsForProject = (project: DubbingProject) => {
  if (!project || !project.works) return [];

  const validWorks = project.works.filter(w => w.voice_actor && w.voice_actor_id !== null);

  return validWorks.map((work) => {
    const voiceActor = work.voice_actor!;
    return {
      id: work.voice_actor_id!,
      tmdb_id: Number(work.actor_id),
      actor_id: Number(work.actor_id),
      name: `${voiceActor.firstname || ""} ${voiceActor.lastname || ""}`.trim(),
      profile_picture: voiceActor.profile_picture ?? undefined,
      role: {
        character: work.performance,
        // In ActorList, we also need to link this back to actor_id so ActorList can group them
        credit_id: work.id.toString(),
      },
      // Important fields used by ActorList logic:
      data: {
        id: voiceActor.id,
        bio: voiceActor.bio ?? null,
        awards: voiceActor.awards ?? null,
        lastname: voiceActor.lastname,
        firstname: voiceActor.firstname,
        nationality: voiceActor.nationality ?? null,
        years_active: voiceActor.years_active ?? null,
        date_of_birth: voiceActor.date_of_birth ?? null,
        social_media_links: voiceActor.social_media_links ?? null,
        profile_picture: voiceActor.profile_picture ?? undefined,
      },
      voiceActorDetails: voiceActor,
      work_id: work.id,
      status: work.status,
    };
  });
};

const groupCrewByJob = (crew: any[]) => {
  if (!crew) return {};
  return crew.reduce((acc: any, member: any) => {
    const jobName = member.job?.name || "Unknown Job";
    if (!acc[jobName]) acc[jobName] = [];
    acc[jobName].push(member);
    return acc;
  }, {});
};


</script>

<style scoped lang="scss">
.dubbing-projects-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.segment {
  margin-bottom: 24px;
}

.segment-header {
  padding: 0 16px;

  @media (max-width: 768px) {
    padding: 0 12px;
  }
}

.segment-title {
  font-size: 18px;
  font-weight: 700;
  margin-top: 8px;
  margin-bottom: 8px;
  color: var(--app-color-text-primary);
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--app-color-step-200);
  border: 1px solid #3a3a3a;
  border-radius: 8px;
  color: var(--app-color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover,
  &:active {
    background: #383838;
    color: #ffffff;
    border-color: #4a4a4a;
  }
}

.segment-content {
  padding: 0 16px;

  @media (max-width: 768px) {
    padding: 0 12px;
  }
}

.technical-team-card {
  padding: 0;
  border-radius: 12px;
  background: transparent;
}

.technical-team-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-size: 14px;
}

.full-width-item {
  width: 100%;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  color: #9ca3af;
  font-size: 12px;
  margin-bottom: 4px;
}

.info-value {
  font-weight: 500;
  color: #e5e7eb;
}

.crew-cast-segment {
  height: 100%;
}

.project-select {
  background: var(--app-color-step-100);
  color: var(--app-color-text-primary);
  border: 1px solid var(--app-color-border);
  border-radius: 8px;
  padding: 8px 36px 8px 16px;
  font-size: 14px;
  font-weight: 600;
  outline: none;
  width: 100%;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a0a0a0' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  cursor: pointer;
  text-align: center;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:hover,
  &:focus {
    border-color: var(--app-color-primary);
  }
}
</style>
