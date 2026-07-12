<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-white">Duplicate Voice Actors</h3>
        <p class="text-sm text-slate-400">Scan database for potential voice actor profile duplicates and merge them.</p>
      </div>
      <button
        @click="fetchDuplicates"
        :disabled="loading"
        class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
      >
        <span v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
        <span>{{ loading ? 'Scanning...' : 'Find Duplicates' }}</span>
      </button>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center space-x-3 text-red-200 text-sm">
      <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Scanner Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <p class="text-slate-400 text-sm">Comparing voice actor profiles in the database...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="duplicates.length === 0" class="text-center py-20 bg-slate-900/20 border border-slate-850 rounded-2xl space-y-2">
      <div class="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 mx-auto">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-slate-400 font-semibold">No duplicates found</p>
      <p class="text-xs text-slate-500">All voice actor profiles in the database look distinct!</p>
    </div>

    <!-- Duplicates Group List -->
    <div v-else class="space-y-8">
      <div
        v-for="(group, idx) in duplicates"
        :key="idx"
        class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6 shadow-xl"
      >
        <div class="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <h4 class="text-md font-bold text-white flex items-center space-x-2">
            <span class="h-6 w-6 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center">
              {{ idx + 1 }}
            </span>
            <span>Duplicate Candidates</span>
          </h4>
          <span class="text-xs text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700/50">
            {{ group.actors.length }} matches detected
          </span>
        </div>

        <!-- Comparative Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            v-for="actor in group.actors"
            :key="actor.id"
            :class="[
              'p-5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 select-none',
              group.selectedId === actor.id
                ? 'bg-blue-600/5 border-blue-500 ring-2 ring-blue-500/20'
                : 'bg-slate-950/40 border-slate-800/60 hover:bg-slate-900/60 hover:border-slate-700'
            ]"
            @click="group.selectedId = actor.id"
          >
            <div class="space-y-4">
              <!-- Avatar & Name row -->
              <div class="flex items-center space-x-3.5">
                <div class="h-12 w-12 rounded-full overflow-hidden shrink-0 border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-500">
                  <img
                    v-if="actor.profile_picture"
                    :src="actor.profile_picture"
                    class="h-full w-full object-cover"
                    alt="Actor Avatar"
                  />
                  <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div class="min-w-0">
                  <h5 class="font-bold text-white text-sm truncate">{{ actor.firstname }} {{ actor.lastname }}</h5>
                  <p class="text-xs text-slate-500 font-mono mt-0.5">ID: {{ actor.id }}</p>
                </div>
              </div>

              <!-- Meta specs -->
              <div class="text-xs space-y-2 border-t border-slate-800/60 pt-3 text-slate-350">
                <p v-if="actor.nationality" class="truncate">
                  <span class="text-slate-500">Nationality:</span> {{ actor.nationality }}
                </p>
                <p v-if="actor.date_of_birth">
                  <span class="text-slate-500">Born:</span> {{ formatDate(actor.date_of_birth) }}
                </p>
                <p v-if="actor.tmdb_id">
                  <span class="text-slate-500">TMDB ID:</span> {{ actor.tmdb_id }}
                </p>
                <p v-if="actor.wikidata_id" class="truncate font-mono">
                  <span class="text-slate-500">Wikidata:</span> {{ actor.wikidata_id }}
                </p>
                <p v-if="actor.bio" class="text-slate-400 text-xs line-clamp-3 leading-relaxed mt-2 border-t border-slate-800/40 pt-2 italic">
                  "{{ actor.bio }}"
                </p>
              </div>
            </div>

            <!-- Keep Radio Option -->
            <div class="flex items-center space-x-2 border-t border-slate-800/60 pt-3 mt-auto shrink-0">
              <input
                type="radio"
                :name="'group-' + idx"
                :value="actor.id"
                v-model="group.selectedId"
                class="h-4 w-4 text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-800"
              />
              <span class="text-xs font-semibold text-slate-300">Keep this profile</span>
            </div>
          </div>
        </div>

        <!-- Group Merge Action Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-slate-800/80 bg-slate-900/50 p-4 rounded-xl">
          <div class="text-sm">
            <span v-if="group.selectedId" class="text-slate-300">
              Profile to keep: <strong class="text-blue-400">ID #{{ group.selectedId }}</strong>. All other duplicates will be merged into it.
            </span>
            <span v-else class="text-yellow-500 font-medium">
              Please choose a profile to keep before merging.
            </span>
          </div>

          <button
            @click="mergeGroup(group)"
            :disabled="!group.selectedId || mergingGroup[idx]"
            class="py-2 px-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-sm transition-all duration-150 flex items-center justify-center shrink-0 shadow-lg shadow-green-900/10"
          >
            <span v-if="mergingGroup[idx]" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
            <span>{{ mergingGroup[idx] ? 'Merging...' : 'Merge Selected' }}</span>
          </button>
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
          : 'bg-slate-900 border-slate-800 text-slate-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { supabase } from "@/lib/supabase";

interface VoiceActorCandidate {
  id: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  tmdb_id: number | null;
  wikidata_id: string | null;
  profile_picture: string | null;
}

interface DuplicateGroup {
  actors: VoiceActorCandidate[];
  selectedId: number | null;
}

const duplicates = ref<DuplicateGroup[]>([]);
const loading = ref(false);
const error = ref("");
const mergingGroup = ref<Record<number, boolean>>({});

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

const fetchDuplicates = async () => {
  try {
    loading.value = true;
    error.value = "";
    duplicates.value = [];

    const { data, error: funcError } = await supabase.functions.invoke("find_duplicate_voice_actors");

    if (funcError) throw funcError;

    duplicates.value = (data || []).map((group: any) => ({
      actors: group.actors || [],
      selectedId: null
    }));
  } catch (err: any) {
    console.error("Error fetching voice actor duplicates:", err);
    error.value = err.message || "Failed to find duplicate voice actors.";
  } finally {
    loading.value = false;
  }
};

const mergeGroup = async (group: DuplicateGroup) => {
  if (!group.selectedId) return;

  const groupIndex = duplicates.value.indexOf(group);
  mergingGroup.value[groupIndex] = true;
  error.value = "";

  try {
    const idsToMerge = group.actors
      .map(a => a.id)
      .filter(id => id !== group.selectedId);

    const { error: funcError } = await supabase.functions.invoke("merge_voice_actor_duplicates", {
      body: {
        keepId: group.selectedId,
        ids: idsToMerge
      }
    });

    if (funcError) throw funcError;

    showToast("Duplicate voice actor profiles merged successfully", "success");

    // Remove group from UI list
    duplicates.value = duplicates.value.filter(g => g !== group);
  } catch (err: any) {
    console.error("Error merging duplicate voice actors:", err);
    showToast(err.message || "Failed to merge profiles", "error");
  } finally {
    mergingGroup.value[groupIndex] = false;
  }
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch {
    return dateStr;
  }
};
</script>
