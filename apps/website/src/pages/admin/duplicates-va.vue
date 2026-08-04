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

        <!-- Comparative Table -->
        <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table class="w-full text-sm text-left">
            <thead>
              <tr>
                <th class="p-4 bg-slate-900/80 border-b border-slate-800 w-32 text-slate-400 font-semibold uppercase tracking-wider text-xs">Field</th>
                <th v-for="actor in group.actors" :key="'h-'+actor.id" class="p-4 bg-slate-900/80 border-b border-l border-slate-800 min-w-[280px]" :class="group.selectedId === actor.id ? 'bg-blue-900/10' : ''">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="h-10 w-10 rounded-full overflow-hidden shrink-0 border border-slate-800 bg-slate-900 flex items-center justify-center text-slate-500">
                        <img
                          v-if="actor.profile_picture"
                          :src="actor.profile_picture"
                          class="h-full w-full object-cover"
                          alt="Actor Avatar"
                        />
                        <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div class="min-w-0">
                        <h5 class="font-bold text-white text-base">Candidate</h5>
                        <p class="text-xs text-slate-400 font-mono mt-0.5">ID: {{ actor.id }}</p>
                      </div>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              <!-- Name Row -->
              <tr>
                <td class="p-4 text-slate-400 font-medium bg-slate-900/30">Name</td>
                <td v-for="actor in group.actors" :key="'n-'+actor.id" class="p-4 border-l border-slate-800" :class="getNameDiffClass(group.actors)">
                  {{ actor.firstname }} {{ actor.lastname }}
                </td>
              </tr>
              <!-- Nationality Row -->
              <tr v-if="hasAny(group.actors, 'nationality')">
                <td class="p-4 text-slate-400 font-medium bg-slate-900/30">Nationality</td>
                <td v-for="actor in group.actors" :key="'nat-'+actor.id" class="p-4 border-l border-slate-800" :class="getDiffClass(group.actors, 'nationality')">
                  {{ actor.nationality || '-' }}
                </td>
              </tr>
              <!-- Born Row -->
              <tr v-if="hasAny(group.actors, 'date_of_birth')">
                <td class="p-4 text-slate-400 font-medium bg-slate-900/30">Born</td>
                <td v-for="actor in group.actors" :key="'dob-'+actor.id" class="p-4 border-l border-slate-800" :class="getDiffClass(group.actors, 'date_of_birth')">
                  {{ actor.date_of_birth ? formatDate(actor.date_of_birth) : '-' }}
                </td>
              </tr>
              <!-- TMDB Row -->
              <tr v-if="hasAny(group.actors, 'tmdb_id')">
                <td class="p-4 text-slate-400 font-medium bg-slate-900/30">TMDB ID</td>
                <td v-for="actor in group.actors" :key="'tmd-'+actor.id" class="p-4 border-l border-slate-800" :class="getDiffClass(group.actors, 'tmdb_id')">
                  {{ actor.tmdb_id || '-' }}
                </td>
              </tr>
              <!-- Wikidata Row -->
              <tr v-if="hasAny(group.actors, 'wikidata_id')">
                <td class="p-4 text-slate-400 font-medium bg-slate-900/30">Wikidata</td>
                <td v-for="actor in group.actors" :key="'wik-'+actor.id" class="p-4 border-l border-slate-800 font-mono text-xs break-all" :class="getDiffClass(group.actors, 'wikidata_id')">
                  {{ actor.wikidata_id || '-' }}
                </td>
              </tr>
              <!-- Bio Row -->
              <tr v-if="hasAny(group.actors, 'bio')">
                <td class="p-4 text-slate-400 font-medium bg-slate-900/30 align-top">Bio</td>
                <td v-for="actor in group.actors" :key="'bio-'+actor.id" class="p-4 border-l border-slate-800 align-top max-w-xs" :class="getDiffClass(group.actors, 'bio')">
                  <div class="line-clamp-4 italic text-xs leading-relaxed" :class="actor.bio ? '' : 'text-slate-600'">
                    {{ actor.bio || '-' }}
                  </div>
                </td>
              </tr>
              <!-- Action Row -->
              <tr>
                <td class="p-4 text-slate-400 font-medium bg-slate-900/30">Action</td>
                <td v-for="actor in group.actors" :key="'sel-'+actor.id" class="p-0 border-l border-slate-800 bg-slate-900/50 transition-colors" :class="group.selectedId === actor.id ? 'bg-blue-900/20 shadow-inner' : 'hover:bg-slate-800'">
                  <label class="flex items-center space-x-3 cursor-pointer w-full h-full p-4">
                    <input
                      type="radio"
                      :name="'group-' + idx"
                      :value="actor.id"
                      v-model="group.selectedId"
                      class="h-5 w-5 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 bg-slate-950 border-slate-700"
                    />
                    <span class="text-sm font-bold" :class="group.selectedId === actor.id ? 'text-blue-400' : 'text-slate-300'">Keep ID #{{ actor.id }}</span>
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
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
const supabase = useSupabaseClient();




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref } from "vue";

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

const isDifferent = (actors: VoiceActorCandidate[], field: keyof VoiceActorCandidate) => {
  if (!actors || actors.length < 2) return false;
  const firstVal = actors[0][field];
  return actors.some((a) => a[field] !== firstVal);
};

const isDifferentName = (actors: VoiceActorCandidate[]) => {
  if (!actors || actors.length < 2) return false;
  const firstName = actors[0].firstname + " " + actors[0].lastname;
  return actors.some((a) => a.firstname + " " + a.lastname !== firstName);
};

const getDiffClass = (actors: VoiceActorCandidate[], field: keyof VoiceActorCandidate) => {
  return isDifferent(actors, field)
    ? "text-amber-300 font-bold bg-amber-900/30 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.5)]"
    : "text-slate-300";
};

const getNameDiffClass = (actors: VoiceActorCandidate[]) => {
  return isDifferentName(actors)
    ? "text-amber-300 font-bold bg-amber-900/30 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.5)]"
    : "text-slate-200 font-semibold";
};

const hasAny = (actors: VoiceActorCandidate[], field: keyof VoiceActorCandidate) => {
  return actors.some((a) => a[field] !== null && a[field] !== undefined && a[field] !== "");
};

const calculateScore = (actor: VoiceActorCandidate) => {
  let score = 0;
  if (actor.bio) score += 1;
  if (actor.nationality) score += 1;
  if (actor.date_of_birth) score += 1;
  if (actor.tmdb_id) score += 2;
  if (actor.wikidata_id) score += 2;
  if (actor.profile_picture) score += 2;
  return score;
};

const preselectBest = (actors: VoiceActorCandidate[]) => {
  if (!actors || actors.length === 0) return null;
  
  let bestActor = actors[0];
  let bestScore = calculateScore(bestActor);
  
  for (let i = 1; i < actors.length; i++) {
    const score = calculateScore(actors[i]);
    if (score > bestScore) {
      bestScore = score;
      bestActor = actors[i];
    } else if (score === bestScore) {
      // Prefer the oldest record in case of a tie
      if (actors[i].id < bestActor.id) {
        bestActor = actors[i];
      }
    }
  }
  
  return bestActor.id;
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
      selectedId: preselectBest(group.actors || [])
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
