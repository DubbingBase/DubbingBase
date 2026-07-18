<template>
  <div class="dubbing-projects-view">
    <div v-if="loading" class="flex justify-center p-4">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="text-center text-red-500 mt-4 p-4">
      {{ error }}
    </div>

    <div v-else-if="projects.length === 0" class="flex flex-col h-full">
      <!-- Fallback when no dubbing projects exist: just render the original cast with potentially legacy un-migrated voice actors -->
      <div class="px-4">
         <ActorList
          :actors="actors"
          :voice-actors="externalVoiceActors"
          :is-admin="isAdmin"
          :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
          :go-to-actor="goToActor"
          :go-to-voice-actor="goToVoiceActor"
          :edit-voice-actor-link="editVoiceActorLink"
          :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
          :open-voice-actor-search="openVoiceActorSearch"
          :loading="loading"
          :mediaLanguage="mediaLanguage"
          :workType="contentType === 'season' ? 'tv' : contentType"
          :contentId="contentId.toString()"
         />
      </div>
    </div>

    <div v-else class="flex flex-col h-full">
      <!-- Only show segment header if we have more than 1 project -->
      <div v-if="projects.length > 1" class="px-4 py-2 bg-gray-100 dark:bg-gray-800">
        <AppSegment v-model="activeProjectId">
          <AppSegmentButton
            v-for="project in projects"
            :key="project.id"
            :value="project.id.toString()"
          >
            {{ project.language.toUpperCase() }}
          </AppSegmentButton>
        </AppSegment>
      </div>

      <AppSegmentView :activeSegment="activeProjectId" @update:activeSegment="activeProjectId = $event" class="flex-1">
        <AppSegmentContent
          v-for="project in projects"
          :key="project.id"
          :id="project.id.toString()"
        >
          <!-- Technical Team Segment -->
          <div class="p-4 bg-white dark:bg-gray-900 rounded-lg shadow mb-4 mt-4 mx-4">
            <h3 class="text-lg font-bold mb-3 border-b pb-2">{{ t('dubbing.technicalTeam', 'Équipe technique') }}</h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div v-if="project.studio" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.studio', 'Studio') }}</span>
                <span class="font-medium">{{ project.studio }}</span>
              </div>
              <div v-if="project.artistic_director" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.artisticDirector', 'Direction artistique') }}</span>
                <span class="font-medium">{{ project.artistic_director }}</span>
              </div>
              <div v-if="project.adaptation" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.adaptation', 'Adaptation') }}</span>
                <span class="font-medium">{{ project.adaptation }}</span>
              </div>
              <div v-if="project.recording" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.recording', 'Enregistrement') }}</span>
                <span class="font-medium">{{ project.recording }}</span>
              </div>
              <div v-if="project.editing" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.editing', 'Montage') }}</span>
                <span class="font-medium">{{ project.editing }}</span>
              </div>
              <div v-if="project.mixing" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.mixing', 'Mixage') }}</span>
                <span class="font-medium">{{ project.mixing }}</span>
              </div>
              <div v-if="project.project_manager" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.projectManager', 'Chargée de projet') }}</span>
                <span class="font-medium">{{ project.project_manager }}</span>
              </div>
              <div v-if="project.creative_supervision" class="flex flex-col mb-2">
                <span class="text-gray-500 text-xs">{{ t('dubbing.creativeSupervision', 'Supervision créative') }}</span>
                <span class="font-medium">{{ project.creative_supervision }}</span>
              </div>
            </div>

            <div v-if="!project.studio && !project.artistic_director && !project.adaptation && !project.recording && !project.editing && !project.mixing && !project.project_manager && !project.creative_supervision" class="text-gray-400 italic">
              {{ t('common.noInfo', 'Non renseigné') }}
            </div>
          </div>

          <!-- Cast Segment -->
          <div class="px-4">
             <h3 class="text-lg font-bold mb-3 mt-2">{{ t('dubbing.cast', 'Casting') }}</h3>
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
              :loading="loading"
              :mediaLanguage="mediaLanguage"
              :workType="contentType === 'season' ? 'tv' : contentType"
              :contentId="contentId.toString()"
             />
          </div>
        </AppSegmentContent>
      </AppSegmentView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { supabase } from '@/api/supabase';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import AppSegment from '@/components/common/layout/AppSegment.vue';
import AppSegmentButton from '@/components/common/layout/AppSegmentButton.vue';
import AppSegmentView from '@/components/common/layout/AppSegmentView.vue';
import AppSegmentContent from '@/components/common/layout/AppSegmentContent.vue';
import ActorList from '@/components/ActorList.vue';
import { useI18n } from 'vue-i18n';
import { PersonData } from '@/components/PersonItem.vue';

const { t } = useI18n();

const props = defineProps<{
  contentId: string | number;
  contentType: 'movie' | 'tv' | 'season';

  // Dependencies required by ActorList
  actors?: PersonData<any>[];
  isAdmin?: boolean;
  getVoiceActorByTmdbId?: (tmdbId: number) => void;
  goToActor: (id: number) => void;
  goToVoiceActor: (id: number) => void;
  editVoiceActorLink?: (va: any) => void;
  confirmDeleteVoiceActorLink?: (vaId: number) => void;
  openVoiceActorSearch?: (actor: any, actorId: number) => void;
  mediaLanguage?: string;
  externalVoiceActors?: any[]; // To fallback if local fetch isn't integrated yet
}>();

export interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture?: string;
  bio?: string;
  nationality?: string;
  date_of_birth?: string;
  awards?: string;
  years_active?: string;
  social_media_links?: any;
  tmdb_id?: number;
  wikidata_id?: string;
}

export interface WorkPerformance {
  id: number;
  content_id: number;
  actor_id: number;
  voice_actor_id: number;
  highlight: boolean;
  suggestions: string;
  status: string;
  source_id: number;
  content_type: string;
  performance: string;
  dubbing_project_id: number;
  voice_actor: VoiceActor;
}

export interface DubbingProject {
  id: number;
  content_id: number;
  content_type: string;
  language: string;
  studio: string;
  artistic_director: string;
  adaptation: string;
  recording: string;
  editing: string;
  mixing: string;
  project_manager: string;
  creative_supervision: string;
  status: string;
  works: WorkPerformance[];
}

const projects = ref<DubbingProject[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const activeProjectId = ref<string>('');

const fetchDubbingProjects = async () => {
  loading.value = true;
  error.value = null;

  try {
    const { data: projectsData, error: projectsError } = await supabase
      .from('dubbing_projects')
      .select(`
        *,
        works:work(
          *,
          voice_actor:voice_actors(*)
        )
      `)
      .eq('content_id', Number(props.contentId))
      .eq('content_type', props.contentType);

    if (projectsError) throw projectsError;

    projects.value = projectsData as any;

    if (projects.value.length > 0) {
      activeProjectId.value = projects.value[0].id.toString();
    } else {
       // If no dubbing project exists, we can fallback to raw works or show empty.
       // The migration ensures all existing works got a project, so we are good.
    }
  } catch (err: any) {
    console.error('Error fetching dubbing projects:', err);
    error.value = err.message || t('common.error', 'Une erreur est survenue');
  } finally {
    loading.value = false;
  }
};

// Map WorkPerformance -> VoiceActor details matching what ActorList expects
const getVoiceActorsForProject = (project: DubbingProject) => {
  if (!project || !project.works) return [];

  return project.works.map(work => {
    return {
       id: work.voice_actor_id,
       name: `${work.voice_actor?.firstname || ''} ${work.voice_actor?.lastname || ''}`.trim(),
       image: work.voice_actor?.profile_picture,
       role: {
         character: work.performance,
         // In ActorList, we also need to link this back to actor_id so ActorList can group them
         credit_id: work.id.toString(),
       },
       // Important fields used by ActorList logic:
       actor_id: work.actor_id,
       voiceActorDetails: work.voice_actor,
       work_id: work.id,
       status: work.status
    };
  }) as any[];
};

onMounted(() => {
  fetchDubbingProjects();
});

watch(() => props.contentId, () => {
  fetchDubbingProjects();
});

</script>

<style scoped>
.dubbing-projects-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>