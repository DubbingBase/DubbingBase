<template>
  <div class="space-y-6">
    <!-- Top back banner -->
    <div class="flex items-center justify-between bg-gray-900 p-4 rounded-2xl border border-gray-800">
      <h3 class="text-sm font-bold text-white">{{ $t('admin.addVoiceCast.title') }}</h3>
      <NuxtLink
        :to="localePath('/admin')"
        class="text-xs font-semibold px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-350 hover:text-white rounded-xl border border-gray-700 transition-colors"
      >{{ $t('admin.movieEditor.backToDashboard') }}</NuxtLink>
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
      <p class="text-gray-400 text-sm">{{ $t('admin.addVoiceCast.fetchingCredits') }}</p>
    </div>

    <!-- Media summary (no public cast list available) -->
    <div v-else-if="mediaSummary" class="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
      <div class="flex gap-4">
        <div class="h-32 w-24 rounded-lg overflow-hidden border border-gray-800 bg-gray-950 shrink-0 flex items-center justify-center text-gray-600">
          <img v-if="mediaSummary.poster" :src="mediaSummary.poster" class="h-full w-full object-cover" />
          <span v-else class="text-[10px]">No image</span>
        </div>
        <div class="min-w-0 flex-1 space-y-2">
          <h4 class="text-lg font-bold text-white leading-snug">{{ mediaSummary.title }}</h4>
          <p class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{{ mediaTypeLabel }} · #{{ mediaId }}</p>
          <p v-if="mediaSummary.description" class="text-xs text-gray-400 line-clamp-3 italic">"{{ mediaSummary.description }}"</p>
        </div>
      </div>

      <div class="border-t border-gray-800 pt-4 space-y-3">
        <p class="text-xs text-gray-400">
          {{ $t('admin.addVoiceCast.noPublicCastHint') }}
        </p>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="manualCharacterName"
            type="text"
            :placeholder="$t('admin.addVoiceCast.characterNamePlaceholder')"
            class="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
          <select
            v-model="manualPerformance"
            class="px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm"
          >
            <option value="dialogues">{{ $t('admin.movieEditor.dialogues') }}</option>
            <option value="chant">{{ $t('admin.movieEditor.chant') }}</option>
            <option value="dialogues & chant">{{ $t('admin.movieEditor.dialoguesAndChant') }}</option>
            <option value="ambiances">{{ $t('admin.movieEditor.ambiances') }}</option>
            <option value="voice">{{ $t('admin.movieEditor.voice') }}</option>
          </select>
          <input
            v-model="manualActorName"
            type="text"
            :placeholder="$t('admin.addVoiceCast.originalActorPlaceholder')"
            class="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div class="flex flex-col sm:flex-row gap-2">
          <input
            v-model="manualVoiceActorQuery"
            type="text"
            :placeholder="$t('admin.addVoiceCast.searchVoiceActorPlaceholder')"
            @input="triggerVoiceActorSearch('manual')"
            class="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="button"
            @click="quickCreateVoiceActorForManual"
            :disabled="isCreatingPerson || !manualNewVAFirstname || !manualNewVALastname"
            class="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-blue-400 text-xs font-semibold rounded-xl border border-gray-700"
          >+ {{ $t('admin.movieEditor.newVoiceActor') }}</button>
          <button
            type="button"
            @click="saveManualEntry"
            :disabled="isSaving || !manualCharacterName || !selectedManualVA"
            class="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-xl"
          >
            {{ $t('admin.addVoiceCast.saveMappingChanges') }}
          </button>
        </div>
        <div v-if="manualVAOptions.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
          <button
            v-for="va in manualVAOptions"
            :key="va.id"
            type="button"
            @click="selectedManualVA = va"
            class="flex items-center gap-2 p-2 rounded-lg text-left transition-colors border"
            :class="selectedManualVA?.id === va.id ? 'bg-indigo-950/40 border-indigo-700' : 'bg-gray-950 border-gray-800 hover:bg-gray-900'"
          >
            <div class="h-7 w-7 rounded-full overflow-hidden border border-gray-800 bg-gray-950 shrink-0 flex items-center justify-center text-gray-500">
              <img v-if="va.profile_picture" :src="va.profile_picture" class="h-full w-full object-cover" />
              <span v-else class="text-[10px] font-bold">{{ va.firstname?.charAt(0) || '' }}</span>
            </div>
            <span class="text-xs font-semibold text-gray-200 truncate">{{ va.firstname }} {{ va.lastname }}</span>
          </button>
        </div>

        <div class="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-800/50">
          <input
            v-model="manualNewVAFirstname"
            type="text"
            :placeholder="$t('admin.movieEditor.firstName')"
            class="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-xs"
          />
          <input
            v-model="manualNewVALastname"
            type="text"
            :placeholder="$t('admin.movieEditor.lastName')"
            class="flex-1 px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-white text-xs"
          />
        </div>
      </div>
    </div>

    <!-- Main Workspace (TMDB / IGDB / etc. with public cast) -->
    <div v-else-if="media" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Media details column -->
      <div class="space-y-6">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <div class="aspect-[2/3] w-full rounded-xl overflow-hidden bg-gray-950 border border-gray-800 shadow-lg relative">
            <img
              v-if="media.poster"
              :src="media.poster"
              class="h-full w-full object-cover"
              alt="Poster"
            />
            <div v-else class="h-full w-full flex items-center justify-center text-gray-600">
              {{ $t('admin.addVoiceCast.noPosterAvailable') }}
            </div>
          </div>

          <div class="space-y-2">
            <h4 class="text-lg font-bold text-white leading-snug">{{ media.title }}</h4>
            <p class="text-[10px] uppercase tracking-wider text-gray-500 font-bold">{{ mediaTypeLabel }} · #{{ mediaId }}</p>
            <p v-if="media.releaseYear" class="text-xs font-semibold text-gray-500">{{ $t('admin.addVoiceCast.released') }}{{ media.releaseYear }}</p>
            <p v-if="media.description" class="text-xs text-gray-400 leading-relaxed line-clamp-4 italic">"{{ media.description }}"</p>
          </div>

          <div class="border-t border-gray-800/80 pt-4 mt-2">
            <button
              @click="saveVoiceCast"
              :disabled="isSaving || !hasChanges"
              class="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center text-sm"
            >
              <span v-if="isSaving" class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
              <span>{{ $t('admin.addVoiceCast.saveMappingChanges') }}</span>
            </button>
            <p v-if="!hasChanges" class="text-[10px] text-center text-gray-500 mt-2">{{ $t('admin.addVoiceCast.noChangesYet') }}</p>
          </div>
        </div>
      </div>

      <!-- Cast list column -->
      <div class="lg:col-span-2 space-y-4">
        <h4 class="text-sm font-bold text-gray-400 uppercase tracking-wider px-2">{{ $t('admin.addVoiceCast.castingMembersMapping') }}</h4>

        <div v-if="actors.length === 0" class="p-8 text-center bg-gray-900 border border-gray-850 rounded-2xl text-gray-500 text-sm">{{ $t('admin.addVoiceCast.noCastReturned') }}</div>

        <div v-else class="space-y-3">
          <div
            v-for="actor in actors"
            :key="actor.id"
            class="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm"
          >
            <div class="flex items-center space-x-3.5 min-w-0">
              <div class="h-12 w-12 rounded-full overflow-hidden border border-gray-800 bg-gray-950 shrink-0 flex items-center justify-center text-gray-500">
                <img v-if="actor.profile_path" :src="actor.profile_path" class="h-full w-full object-cover" alt="Actor avatar" />
                <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div class="min-w-0">
                <h5 class="font-bold text-white text-sm truncate leading-snug">{{ actor.name }}</h5>
                <p class="text-xs text-gray-400 truncate mt-0.5">{{ $t('admin.addVoiceCast.character') }}<span class="text-indigo-400 font-semibold">{{ actor.character }}</span></p>
              </div>
            </div>

            <div class="relative w-full sm:w-72 shrink-0">
              <div v-if="voiceActorAssignments[actor.id]" class="flex items-center justify-between bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-2 pl-3">
                <div class="min-w-0 flex items-center space-x-2">
                  <div class="h-5 w-5 rounded-full overflow-hidden border border-indigo-800 bg-gray-950 shrink-0 flex items-center justify-center text-indigo-400">
                    <img v-if="getAssignedVA(actor.id)?.profile_picture" :src="getAssignedVA(actor.id)!.profile_picture!" class="h-full w-full object-cover" />
                    <span v-else class="text-[9px] font-bold">{{ getAssignedVA(actor.id)?.firstname?.charAt(0) || '' }}</span>
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

              <div v-else class="relative">
                <input
                  type="text"
                  :placeholder="$t('admin.addVoiceCast.linkVoiceActorPlaceholder')"
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

                <div
                  v-if="activeSearchDropdown === actor.id && (searchResults[actor.id]?.length ?? 0) > 0"
                  class="absolute z-40 left-0 right-0 mt-1.5 max-h-40 overflow-y-auto bg-gray-900 border border-gray-850 rounded-xl shadow-2xl divide-y divide-gray-850"
                >
                  <div
                    v-for="va in (searchResults[actor.id] || [])"
                    :key="va.id"
                    @click="assignVoiceActor(actor.id, va)"
                    class="px-3 py-2 hover:bg-gray-800/50 cursor-pointer flex items-center space-x-2.5 transition-colors"
                  >
                    <div class="h-6 w-6 rounded-full overflow-hidden border border-gray-800 bg-gray-950 shrink-0 flex items-center justify-center text-gray-500">
                      <img v-if="va.profile_picture" :src="va.profile_picture" class="h-full w-full object-cover" />
                      <svg v-else class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <span class="text-xs font-semibold text-gray-200">{{ va.firstname }} {{ va.lastname }}</span>
                  </div>
                </div>

                <div
                  v-else-if="activeSearchDropdown === actor.id && actorSearchQueries[actor.id]?.trim() && searchLoading[actor.id]"
                  class="absolute z-40 left-0 right-0 mt-1.5 p-3 bg-gray-900 border border-gray-850 rounded-xl text-center text-gray-500 text-[10px]"
                >{{ $t('admin.addVoiceCast.searchingDatabase') }}</div>
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

interface MediaSummary {
  title: string;
  poster: string | null;
  description: string | null;
  releaseYear: string | null;
}

const route = useRoute();

const mediaTypeParam = computed(() => String(route.query.media_type ?? "movie"));
const mediaId = computed(() => Number(route.params.id));
const language = computed(() => String(route.query.lang ?? "fr"));

const mediaTypeLabel = computed(() => {
  switch (mediaTypeParam.value) {
    case "movie": return "Movie";
    case "tv": return "Series";
    case "video_game": return "Video Game";
    case "audiobook": return "Audiobook";
    case "podcast": return "Podcast";
    case "advertisement": return "Commercial";
    case "toy": return "Toy";
    default: return "Media";
  }
});

const supportsPublicCast = computed(() => ["movie", "tv", "video_game"].includes(mediaTypeParam.value));

// State
const media = ref<MediaSummary | null>(null);
const actors = ref<Actor[]>([]);
const voiceActors = ref<WorkAndVoiceActor[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const isSaving = ref(false);

// Manual-entry state (media types without public cast)
const mediaSummary = ref<MediaSummary | null>(null);
const manualCharacterName = ref("");
const manualPerformance = ref("dialogues");
const manualActorName = ref("");
const manualVoiceActorQuery = ref("");
const manualVAOptions = ref<VoiceActor[]>([]);
const selectedManualVA = ref<VoiceActor | null>(null);
const manualNewVAFirstname = ref("");
const manualNewVALastname = ref("");
const isCreatingPerson = ref(false);

// Assignments
const voiceActorAssignments = ref<Record<number, number | null>>({});
const initialAssignments = ref<Record<number, number | null>>({});

const activeSearchDropdown = ref<number | null>(null);
const actorSearchQueries = ref<Record<number, string>>({});
const searchResults = ref<Record<number, VoiceActor[]>>({});
const searchLoading = ref<Record<number, boolean>>({});
const searchTimers = ref<Record<number, ReturnType<typeof setTimeout>>>({});
const manualSearchTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const toast = ref({
  show: false,
  message: "",
  type: "info" as "success" | "error" | "info"
});

const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
  toast.value = { show: true, message, type };
  setTimeout(() => { toast.value.show = false; }, 3000);
};

const hasChanges = computed(() => {
  return Object.keys(voiceActorAssignments.value).some(actorId => {
    const aid = Number(actorId);
    return voiceActorAssignments.value[aid] !== initialAssignments.value[aid];
  });
});

const getAssignedVA = (actorId: number): VoiceActor | null => {
  const vaId = voiceActorAssignments.value[actorId];
  if (!vaId) return null;
  const existing = voiceActors.value.find(va => va.voice_actor_id === vaId);
  if (existing) return existing.voice_actor;
  const results = searchResults.value[actorId] || [];
  return results.find(va => va.id === vaId) ?? null;
};

async function fetchInitialData() {
  loading.value = true;
  error.value = null;
  try {
    const metadata: any = await $fetch("/api/internal-media-metadata", {
      params: { media_type: mediaTypeParam.value, media_id: mediaId.value },
    });
    const m = metadata?.media ?? {};
    media.value = {
      title: m.title || m.name || `#${mediaId.value}`,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : m.cover?.url ?? m.cover_url ?? m.poster_url ?? null,
      description: m.overview || m.summary || m.description || null,
      releaseYear: (m.release_date || m.first_air_date || m.first_release_date || "").split("-")[0] || null,
    };

    if (supportsPublicCast.value) {
      const credits: any = await $fetch("/api/internal-media-credits", {
        params: { media_type: mediaTypeParam.value, media_id: mediaId.value },
      });
      actors.value = (credits.cast ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.character ?? c.name,
        profile_path: c.profile_path ?? null,
      }));
    } else {
      // No public cast: use the manual-entry path
      mediaSummary.value = media.value;
    }

    // Fetch existing voice actor mappings
    const { data: projects } = await supabase
      .from("dubbing_projects")
      .select("id")
      .eq("content_id", mediaId.value)
      .eq("content_type", mediaTypeParam.value);
    const projectIds = (projects ?? []).map((p: any) => p.id);
    if (projectIds.length > 0) {
      const { data: works } = await supabase
        .from("work")
        .select("actor_id, voice_actor_id, voice_actor:voice_actors(id, firstname, lastname, profile_picture)")
        .in("dubbing_project_id", projectIds);
      if (works) {
        voiceActors.value = works as any;
        const assignments: Record<number, number | null> = {};
        const initAssigns: Record<number, number | null> = {};
        actors.value.forEach(actor => {
          const match = voiceActors.value.find((va: any) => va.actor_id === actor.id);
          assignments[actor.id] = match ? (match.voice_actor_id ?? null) : null;
          initAssigns[actor.id] = assignments[actor.id] ?? null;
        });
        voiceActorAssignments.value = assignments;
        initialAssignments.value = initAssigns;
      }
    }
  } catch (err: any) {
    console.error("Failed to load media:", err);
    error.value = err?.message || "Failed to load media";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchInitialData);

const openSearchDropdown = (actorId: number) => {
  activeSearchDropdown.value = actorId;
  if (!actorSearchQueries.value[actorId]) actorSearchQueries.value[actorId] = "";
};

const triggerSearch = (actorId: number) => {
  if (searchTimers.value[actorId]) clearTimeout(searchTimers.value[actorId]);
  searchTimers.value[actorId] = setTimeout(() => executeSearch(actorId), 300);
};

const executeSearch = async (actorId: number) => {
  const query = actorSearchQueries.value[actorId]?.trim();
  if (!query) { searchResults.value[actorId] = []; return; }
  searchLoading.value[actorId] = true;
  try {
    const data = await $fetch<VoiceActor[]>("/api/search-voice-actors", { params: { query, limit: "10" } });
    searchResults.value[actorId] = data || [];
  } catch (err) { console.error(err); }
  finally { searchLoading.value[actorId] = false; }
};

const triggerVoiceActorSearch = (_source: string) => {
  if (manualSearchTimer.value) clearTimeout(manualSearchTimer.value);
  manualSearchTimer.value = setTimeout(async () => {
    const q = manualVoiceActorQuery.value.trim();
    if (!q) { manualVAOptions.value = []; return; }
    try {
      const data = await $fetch<VoiceActor[]>("/api/search-voice-actors", { params: { query: q, limit: "10" } });
      manualVAOptions.value = data || [];
    } catch (err) { console.error(err); }
  }, 300);
};

const assignVoiceActor = (actorId: number, va: VoiceActor) => {
  voiceActorAssignments.value[actorId] = va.id;
  activeSearchDropdown.value = null;
  actorSearchQueries.value[actorId] = "";
};

const clearVoiceActor = (actorId: number) => {
  voiceActorAssignments.value[actorId] = null;
};

async function findOrCreateProject(): Promise<number> {
  const { data: project } = await supabase
    .from("dubbing_projects")
    .select("id")
    .eq("content_id", mediaId.value)
    .eq("content_type", mediaTypeParam.value)
    .eq("language", language.value)
    .maybeSingle();
  if (project) return project.id;
  const { data: newProject, error } = await supabase
    .from("dubbing_projects")
    .insert([{ content_id: mediaId.value, content_type: mediaTypeParam.value, status: "validated", language: language.value }])
    .select()
    .single();
  if (error) throw error;
  return newProject.id;
}

const saveVoiceCast = async () => {
  if (!hasChanges.value) return;
  isSaving.value = true;
  try {
    const projectId = await findOrCreateProject();
    const assignments = Object.entries(voiceActorAssignments.value)
      .filter(([_, voiceActorId]) => voiceActorId !== null)
      .map(([actorId, voiceActorId]) => ({
        actor_id: Number(actorId),
        voice_actor_id: voiceActorId,
        dubbing_project_id: projectId,
        performance: "voice",
        status: "validated",
      }));
    const { error: deleteError } = await supabase.from("work").delete().eq("dubbing_project_id", projectId);
    if (deleteError) throw deleteError;
    if (assignments.length > 0) {
      const { error: insertError } = await supabase.from("work").insert(assignments);
      if (insertError) throw insertError;
    }
    showToast("Voice cast mappings saved successfully!", "success");
    initialAssignments.value = { ...voiceActorAssignments.value };
  } catch (err: any) {
    console.error(err);
    showToast(err.message || "Failed to save voice cast mappings", "error");
  } finally { isSaving.value = false; }
};

const quickCreateVoiceActorForManual = async () => {
  if (!manualNewVAFirstname.value || !manualNewVALastname.value) return;
  isCreatingPerson.value = true;
  try {
    const { data, error } = await supabase
      .from("voice_actors")
      .insert([{ firstname: manualNewVAFirstname.value.trim(), lastname: manualNewVALastname.value.trim() }])
      .select()
      .single();
    if (error) throw error;
    if (data) {
      selectedManualVA.value = data as VoiceActor;
      manualNewVAFirstname.value = "";
      manualNewVALastname.value = "";
      showToast(`Created profile for ${data.firstname} ${data.lastname}!`, "success");
    }
  } catch (err: any) {
    showToast(err.message || "Failed to create voice actor", "error");
  } finally { isCreatingPerson.value = false; }
};

const saveManualEntry = async () => {
  if (!manualCharacterName.value || !selectedManualVA.value) {
    showToast("Character name and voice actor are required.", "error");
    return;
  }
  isSaving.value = true;
  try {
    const projectId = await findOrCreateProject();
    const { error: insertError } = await supabase.from("work").insert({
      dubbing_project_id: projectId,
      voice_actor_id: selectedManualVA.value.id,
      character_name: manualCharacterName.value,
      actor_id: null,
      performance: manualPerformance.value,
      status: "validated",
    });
    if (insertError) throw insertError;
    showToast("Mapping created successfully!", "success");
    manualCharacterName.value = "";
    manualActorName.value = "";
    selectedManualVA.value = null;
    manualVoiceActorQuery.value = "";
    manualVAOptions.value = [];
  } catch (err: any) {
    showToast(err.message || "Failed to save mapping", "error");
  } finally { isSaving.value = false; }
};

const setupDropdownCloser = () => {
  document.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".relative")) activeSearchDropdown.value = null;
  });
};

onMounted(() => { setupDropdownCloser(); });
</script>
