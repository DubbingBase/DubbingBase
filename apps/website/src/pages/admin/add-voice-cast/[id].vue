<template>
  <div class="space-y-6">
    <!-- Top back banner -->
    <div class="flex items-center justify-between bg-gray-900 p-4 rounded-2xl border border-gray-800">
      <h3 class="text-sm font-bold text-white">{{ $t('admin.voiceCast.title') }}</h3>
      <NuxtLink
        :to="localePath('/admin')"
        class="text-xs font-semibold px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-350 hover:text-white rounded-xl border border-gray-700 transition-colors"
      >
        {{ $t('common.backToDashboard') }}
      </NuxtLink>
    </div>

    <!-- Error state -->
    <div v-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center space-x-3 text-red-200 text-sm">
      <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 space-y-3 bg-gray-900/40 border border-gray-800/60 rounded-2xl">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <p class="text-gray-400 text-sm">{{ $t('admin.voiceCast.fetchingCredits') }}</p>
    </div>

    <!-- Main Workspace -->
    <div v-else-if="movie" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Movie details column -->
      <div class="space-y-6">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <!-- Poster -->
          <div class="aspect-[2/3] w-full rounded-xl overflow-hidden bg-gray-950 border border-gray-800 shadow-lg relative">
            <NuxtImg format="webp"               v-if="movie.poster_path"
              :src="'https://image.tmdb.org/t/p/w500' + movie.poster_path"
              class="h-full w-full object-cover"
              alt="Movie Poster"
            />
            <div v-else class="h-full w-full flex items-center justify-center text-gray-600">
              No Poster Available
            </div>
          </div>

          <!-- Metadata -->
          <div class="space-y-2">
            <h4 class="text-lg font-bold text-white leading-snug">{{ movie.title }}</h4>
            <p v-if="movie.release_date" class="text-xs font-semibold text-gray-500">
              Released: {{ movie.release_date.split('-')[0] }}
            </p>
            <p v-if="movie.overview" class="text-xs text-gray-400 leading-relaxed line-clamp-4 italic">
              "{{ movie.overview }}"
            </p>
          </div>

          <!-- Save Button -->
          <div class="border-t border-gray-800/80 pt-4 mt-2">
            <button
              @click="saveVoiceCast"
              :disabled="isSaving || !hasChanges"
              class="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center text-sm"
            >
              <span v-if="isSaving" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
              <span>{{ $t('admin.voiceCast.saveMappingChanges') }}</span>
            </button>
            <p v-if="!hasChanges" class="text-[10px] text-center text-gray-500 mt-2">
              No changes to save yet.
            </p>
          </div>
        </div>
      </div>

      <!-- Cast list column (Double span) -->
      <div class="lg:col-span-2 space-y-4">
        <h4 class="text-sm font-bold text-gray-400 uppercase tracking-wider px-2">{{ $t('admin.voiceCast.castingMembersMapping') }}</h4>

        <div v-if="actors.length === 0" class="p-8 text-center bg-gray-900 border border-gray-850 rounded-2xl text-gray-500 text-sm">
          No cast members returned for this movie.
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="actor in actors"
            :key="actor.id"
            class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm"
          >
            <!-- Actor information -->
            <div class="flex items-center space-x-3.5 min-w-0">
              <div class="h-12 w-12 rounded-full overflow-hidden border border-gray-800 bg-gray-950 shrink-0 flex items-center justify-center text-gray-500">
                <NuxtImg format="webp"                   v-if="actor.profile_path"
                  :src="'https://image.tmdb.org/t/p/w185' + actor.profile_path"
                  class="h-full w-full object-cover"
                  alt="Actor avatar"
                />
                <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="min-w-0">
                <h5 class="font-bold text-white text-sm truncate leading-snug">{{ actor.name }}</h5>
                <p class="text-xs text-gray-400 truncate mt-0.5">Character: <span class="text-indigo-400 font-semibold">{{ actor.character }}</span></p>
              </div>
            </div>

            <!-- Voice Actor selection control -->
            <div class="relative w-full sm:w-72 shrink-0">
              <!-- Mapped profile display -->
              <div v-if="voiceActorAssignments[actor.id]" class="flex items-center justify-between bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-2 pl-3">
                <div class="min-w-0 flex items-center space-x-2">
                  <div class="h-5 w-5 rounded-full overflow-hidden border border-indigo-800 bg-gray-950 shrink-0 flex items-center justify-center text-indigo-400">
                    <NuxtImg format="webp" v-if="getAssignedVA(actor.id)?.profile_picture" :src="getAssignedVA(actor.id)!.profile_picture!" class="h-full w-full object-cover" />
                    <span v-else class="text-[9px] font-bold">{{ getAssignedVA(actor.id)?.firstname.charAt(0) }}</span>
                  </div>
                  <span class="text-xs font-semibold text-indigo-300 truncate">
                    {{ getAssignedVA(actor.id)?.firstname }} {{ getAssignedVA(actor.id)?.lastname }}
                  </span>
                </div>
                <button
                  @click="clearVoiceActor(actor.id)"
                  class="p-1 text-gray-500 hover:text-red-400 rounded-lg hover:bg-gray-800/40 transition-colors shrink-0"
                  title="Clear mapping"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <!-- Inline search field -->
              <div v-else class="relative">
                <input
                  type="text"
                  :placeholder="$t('admin.voiceCast.linkVoiceActorPlaceholder')"
                  v-model="actorSearchQueries[actor.id]"
                  @focus="openSearchDropdown(actor.id)"
                  @input="triggerSearch(actor.id)"
                  class="w-full pl-3 pr-8 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-650 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-medium"
                />
                <span class="absolute right-2.5 top-2.5 text-gray-600 pointer-events-none">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>

                <!-- Search dropdown -->
                <div
                  v-if="activeSearchDropdown === actor.id && searchResults[actor.id]?.length > 0"
                  class="absolute z-40 left-0 right-0 mt-1.5 max-h-40 overflow-y-auto bg-gray-900 border border-gray-850 rounded-xl shadow-2xl divide-y divide-gray-850"
                >
                  <div
                    v-for="va in searchResults[actor.id]"
                    :key="va.id"
                    @click="assignVoiceActor(actor.id, va)"
                    class="px-3 py-2 hover:bg-gray-800/50 cursor-pointer flex items-center space-x-2.5 transition-colors"
                  >
                    <div class="h-6 w-6 rounded-full overflow-hidden border border-gray-800 bg-gray-950 shrink-0 flex items-center justify-center text-gray-500">
                      <NuxtImg format="webp" v-if="va.profile_picture" :src="va.profile_picture" class="h-full w-full object-cover" />
                      <svg v-else class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span class="text-xs font-semibold text-gray-200">{{ va.firstname }} {{ va.lastname }}</span>
                  </div>
                </div>

                <!-- Dropdown states -->
                <div
                  v-else-if="activeSearchDropdown === actor.id && actorSearchQueries[actor.id]?.trim() && searchLoading[actor.id]"
                  class="absolute z-40 left-0 right-0 mt-1.5 p-3 bg-gray-900 border border-gray-850 rounded-xl text-center text-gray-500 text-[10px]"
                >
                  Searching database...
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast Notifications -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3"
      :class="
        toast.type === 'success'
          ? 'bg-green-950/40 border-green-900/60 text-green-200'
          : toast.type === 'error'
          ? 'bg-red-950/40 border-red-900/60 text-red-200'
          : 'bg-gray-900 border-gray-800 text-gray-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
  </template>

<script setup lang="ts">
const supabase = useSupabaseClient();
const localePath = useLocalePath();
const { t } = useI18n();




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref, computed, onMounted } from "vue";


interface Actor {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture: string | null;
}

interface WorkAndVoiceActor {
  actor_id: number;
  voice_actor_id: number;
  voice_actor: VoiceActor;
}

interface MovieResponse {
  movie: {
    id: number;
    title: string;
    overview: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string;
    credits: {
      cast: Actor[];
    };
  };
  voiceActors: WorkAndVoiceActor[];
}

const route = useRoute();

const movieId = computed(() => Number(route.params.id));

// State
const movie = ref<MovieResponse["movie"] | null>(null);
const actors = ref<Actor[]>([]);
const voiceActors = ref<WorkAndVoiceActor[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const isSaving = ref(false);

// Assignments Map (actorId -> voiceActorId)
const voiceActorAssignments = ref<Record<number, number | null>>({});
const initialAssignments = ref<Record<number, number | null>>({});

// Autocomplete States per actorId
const activeSearchDropdown = ref<number | null>(null);
const actorSearchQueries = ref<Record<number, string>>({});
const searchResults = ref<Record<number, VoiceActor[]>>({});
const searchLoading = ref<Record<number, boolean>>({});
const searchTimers = ref<Record<number, ReturnType<typeof setTimeout>>>({});

const toast = ref({
  show: false,
  message: "",
  type: "info"
});

const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

// Check for changes
const hasChanges = computed(() => {
  return Object.keys(voiceActorAssignments.value).some(actorId => {
    const aid = Number(actorId);
    return voiceActorAssignments.value[aid] !== initialAssignments.value[aid];
  });
});

const getAssignedVA = (actorId: number): VoiceActor | null => {
  const vaId = voiceActorAssignments.value[actorId];
  if (!vaId) return null;

  // Search in fetched list
  const existing = voiceActors.value.find(va => va.voice_actor_id === vaId);
  if (existing) return existing.voice_actor;

  // Search in dropdown results
  const results = searchResults.value[actorId] || [];
  const matchedResult = results.find(va => va.id === vaId);
  return matchedResult || null;
};

const { data: initialData, pending } = await useAsyncData(`movie-cast-${movieId.value}`, async () => {
  const params = new URLSearchParams({ id: movieId.value.toString() });
  const { data, error: fetchErr } = await supabase.functions.invoke(`movie?${params.toString()}`, {
    method: 'GET'
  });

  if (fetchErr) throw fetchErr;
  return data as MovieResponse;
});

watch(initialData, (data) => {
  if (data) {
    movie.value = data.movie;
    voiceActors.value = data.voiceActors || [];
    actors.value = data.movie.credits?.cast || [];

    // Initialize mapping values
    const assignments: Record<number, number | null> = {};
    const initAssigns: Record<number, number | null> = {};

    actors.value.forEach(actor => {
      const match = voiceActors.value.find(va => va.actor_id === actor.id);
      assignments[actor.id] = match ? match.voice_actor_id : null;
      initAssigns[actor.id] = match ? match.voice_actor_id : null;
    });

    voiceActorAssignments.value = assignments;
    initialAssignments.value = initAssigns;
  }
}, { immediate: true });

watch(pending, (val) => {
  loading.value = val;
}, { immediate: true });

const openSearchDropdown = (actorId: number) => {
  activeSearchDropdown.value = actorId;
  if (!actorSearchQueries.value[actorId]) {
    actorSearchQueries.value[actorId] = "";
  }
};

const triggerSearch = (actorId: number) => {
  if (searchTimers.value[actorId]) {
    clearTimeout(searchTimers.value[actorId]);
  }
  searchTimers.value[actorId] = setTimeout(() => {
    executeSearch(actorId);
  }, 300);
};

const executeSearch = async (actorId: number) => {
  const query = actorSearchQueries.value[actorId]?.trim();
  if (!query) {
    searchResults.value[actorId] = [];
    return;
  }

  searchLoading.value[actorId] = true;
  try {
    const params = new URLSearchParams({ query, limit: "10" });
    const { data, error } = await supabase.functions.invoke(`search-voice-actors?${params.toString()}`, {
      method: 'GET'
    });

    if (error) throw error;
    searchResults.value[actorId] = data || [];
  } catch (err: any) {
    console.error("Error searching voice actors:", err);
  } finally {
    searchLoading.value[actorId] = false;
  }
};

const assignVoiceActor = (actorId: number, va: VoiceActor) => {
  voiceActorAssignments.value[actorId] = va.id;
  activeSearchDropdown.value = null;
  actorSearchQueries.value[actorId] = "";
};

const clearVoiceActor = (actorId: number) => {
  voiceActorAssignments.value[actorId] = null;
};

const saveVoiceCast = async () => {
  if (!hasChanges.value) return;

  isSaving.value = true;
  try {
    // Ensure we have a dubbing project first
    let { data: project } = await supabase
      .from("dubbing_projects")
      .select("id")
      .eq("content_id", movieId.value)
      .eq("content_type", "movie")
      .single();

    let projectId = project?.id;

    if (!projectId) {
      const { data: newProject, error: insertErr } = await supabase
        .from("dubbing_projects")
        .insert([{ content_id: movieId.value, content_type: "movie", status: "validated", language: "fr" }])
        .select()
        .single();
      if (insertErr) throw insertErr;
      projectId = newProject.id;
    }

    // 1. Gather all voice actor mappings
    const assignments = Object.entries(voiceActorAssignments.value)
      .filter(([_, voiceActorId]) => voiceActorId !== null)
      .map(([actorId, voiceActorId]) => ({
        actor_id: Number(actorId),
        voice_actor_id: voiceActorId,
        dubbing_project_id: projectId,
        performance: "voice",
        status: "validated"
      }));

    // 2. Clear previous mapping records for this movie
    const { error: deleteError } = await supabase
      .from("work")
      .delete()
      .eq("dubbing_project_id", projectId);

    if (deleteError) throw deleteError;

    // 3. Bulk insert new assignments
    if (assignments.length > 0) {
      const { error: insertError } = await supabase
        .from("work")
        .insert(assignments);

      if (insertError) throw insertError;
    }

    showToast(t('admin.voiceCast.mappingsSaved'), "success");

    // Clear changes diff by resetting initial values
    initialAssignments.value = { ...voiceActorAssignments.value };
  } catch (err: any) {
    console.error("Error saving voice cast:", err);
    showToast(err.message || t('admin.voiceCast.failedToSave'), "error");
  } finally {
    isSaving.value = false;
  }
};

const setupDropdownCloser = () => {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".relative")) {
      activeSearchDropdown.value = null;
    }
  });
};

onMounted(() => {
  setupDropdownCloser();
});
</script>
