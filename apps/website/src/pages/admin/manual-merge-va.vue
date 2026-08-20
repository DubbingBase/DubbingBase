<template>
  <div class="space-y-6 pb-20">
    <!-- Header Card -->
    <div
      class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h3 class="text-lg font-bold text-white">Manual Voice Actor Merge</h3>
        <p class="text-sm text-gray-400">
          Select two voice actors to compare and merge them.
        </p>
      </div>
      <button
        @click="reset"
        class="py-2.5 px-5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl border border-gray-700 transition-all flex items-center justify-center shrink-0"
      >
        <span>Reset Selection</span>
      </button>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center space-x-3 text-red-200 text-sm"
    >
      <svg
        class="h-5 w-5 text-red-400 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Selection Area -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <!-- Actor A Selection -->
      <div
        class="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 shadow-lg"
      >
        <h4 class="font-bold text-white text-sm">Voice Actor A</h4>

        <div
          v-if="actorA"
          class="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-xl p-3"
        >
          <div class="flex items-center space-x-3">
            <div
              class="h-10 w-10 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0 flex items-center justify-center"
            >
              <NuxtImg
                format="webp"
                v-if="actorA.profile_picture"
                :src="actorA.profile_picture"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-xs font-bold text-gray-500">{{
                actorA.firstname.charAt(0)
              }}</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-white">
                {{ actorA.firstname }} {{ actorA.lastname }}
              </p>
              <p class="text-xs text-gray-400 font-mono">
                ID: {{ actorA.id }}
              </p>
            </div>
          </div>
          <button
            @click="actorA = null"
            class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div v-else class="relative">
          <input
            type="text"
            placeholder="Search Voice Actor A..."
            v-model="searchQueryA"
            @focus="activeSearch = 'A'"
            @input="triggerSearch('A')"
            class="w-full pl-4 pr-10 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <div
            v-if="activeSearch === 'A' && searchResultsA.length > 0"
            class="absolute z-40 left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-gray-900 border border-gray-800 rounded-xl shadow-2xl divide-y divide-gray-800/60"
          >
            <div
              v-for="va in searchResultsA"
              :key="va.id"
              @click="selectActor('A', va)"
              class="px-4 py-3 hover:bg-gray-800/50 cursor-pointer flex items-start space-x-3 transition-colors"
            >
              <div
                class="h-10 w-10 mt-1 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0 flex items-center justify-center"
              >
                <NuxtImg
                  format="webp"
                  v-if="va.profile_picture"
                  :src="va.profile_picture"
                  class="h-full w-full object-cover"
                />
                <span v-else class="text-xs font-bold text-gray-500">{{
                  va.firstname.charAt(0)
                }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-200">
                  {{ va.firstname }} {{ va.lastname }}
                  <span class="text-xs text-gray-500 font-mono ml-2"
                    >ID: {{ va.id }}</span
                  >
                </p>
                <div class="text-xs text-gray-400 mt-1 space-y-0.5">
                  <p v-if="va.date_of_birth || va.nationality">
                    <span v-if="va.date_of_birth"
                      >🎂 {{ formatDate(va.date_of_birth) }}</span
                    >
                    <span v-if="va.date_of_birth && va.nationality" class="mx-1"
                      >•</span
                    >
                    <span v-if="va.nationality">🌍 {{ va.nationality }}</span>
                  </p>
                  <p v-if="va.tmdb_id || va.wikidata_id">
                    <span v-if="va.tmdb_id">TMDB: {{ va.tmdb_id }}</span>
                    <span v-if="va.tmdb_id && va.wikidata_id" class="mx-1"
                      >•</span
                    >
                    <span v-if="va.wikidata_id"
                      >Wiki: {{ va.wikidata_id }}</span
                    >
                  </p>
                  <p v-if="va.bio" class="line-clamp-2 italic opacity-80 mt-1">
                    "{{ va.bio }}"
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="
              activeSearch === 'A' && searchQueryA.trim() && searchLoadingA
            "
            class="absolute z-40 left-0 right-0 mt-2 p-4 bg-gray-900 border border-gray-800 rounded-xl text-center text-gray-500 text-xs"
          >
            Searching...
          </div>
        </div>
      </div>

      <!-- Actor B Selection -->
      <div
        class="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3 shadow-lg"
      >
        <h4 class="font-bold text-white text-sm">Voice Actor B</h4>

        <div
          v-if="actorB"
          class="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-xl p-3"
        >
          <div class="flex items-center space-x-3">
            <div
              class="h-10 w-10 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0 flex items-center justify-center"
            >
              <NuxtImg
                format="webp"
                v-if="actorB.profile_picture"
                :src="actorB.profile_picture"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-xs font-bold text-gray-500">{{
                actorB.firstname.charAt(0)
              }}</span>
            </div>
            <div>
              <p class="text-sm font-semibold text-white">
                {{ actorB.firstname }} {{ actorB.lastname }}
              </p>
              <p class="text-xs text-gray-400 font-mono">
                ID: {{ actorB.id }}
              </p>
            </div>
          </div>
          <button
            @click="actorB = null"
            class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div v-else class="relative">
          <input
            type="text"
            placeholder="Search Voice Actor B..."
            v-model="searchQueryB"
            @focus="activeSearch = 'B'"
            @input="triggerSearch('B')"
            class="w-full pl-4 pr-10 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <div
            v-if="activeSearch === 'B' && searchResultsB.length > 0"
            class="absolute z-40 left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-gray-900 border border-gray-800 rounded-xl shadow-2xl divide-y divide-gray-800/60"
          >
            <div
              v-for="va in searchResultsB"
              :key="va.id"
              @click="selectActor('B', va)"
              class="px-4 py-3 hover:bg-gray-800/50 cursor-pointer flex items-start space-x-3 transition-colors"
            >
              <div
                class="h-10 w-10 mt-1 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0 flex items-center justify-center"
              >
                <NuxtImg
                  format="webp"
                  v-if="va.profile_picture"
                  :src="va.profile_picture"
                  class="h-full w-full object-cover"
                />
                <span v-else class="text-xs font-bold text-gray-500">{{
                  va.firstname.charAt(0)
                }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-gray-200">
                  {{ va.firstname }} {{ va.lastname }}
                  <span class="text-xs text-gray-500 font-mono ml-2"
                    >ID: {{ va.id }}</span
                  >
                </p>
                <div class="text-xs text-gray-400 mt-1 space-y-0.5">
                  <p v-if="va.date_of_birth || va.nationality">
                    <span v-if="va.date_of_birth"
                      >🎂 {{ formatDate(va.date_of_birth) }}</span
                    >
                    <span v-if="va.date_of_birth && va.nationality" class="mx-1"
                      >•</span
                    >
                    <span v-if="va.nationality">🌍 {{ va.nationality }}</span>
                  </p>
                  <p v-if="va.tmdb_id || va.wikidata_id">
                    <span v-if="va.tmdb_id">TMDB: {{ va.tmdb_id }}</span>
                    <span v-if="va.tmdb_id && va.wikidata_id" class="mx-1"
                      >•</span
                    >
                    <span v-if="va.wikidata_id"
                      >Wiki: {{ va.wikidata_id }}</span
                    >
                  </p>
                  <p v-if="va.bio" class="line-clamp-2 italic opacity-80 mt-1">
                    "{{ va.bio }}"
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div
            v-else-if="
              activeSearch === 'B' && searchQueryB.trim() && searchLoadingB
            "
            class="absolute z-40 left-0 right-0 mt-2 p-4 bg-gray-900 border border-gray-800 rounded-xl text-center text-gray-500 text-xs"
          >
            Searching...
          </div>
        </div>
      </div>
    </div>

    <!-- Comparison Area -->
    <div
      v-if="actorA && actorB"
      class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl"
    >
      <div
        class="flex items-center justify-between border-b border-gray-800/80 pb-4"
      >
        <h4 class="text-md font-bold text-white flex items-center space-x-2">
          <span>Compare & Merge</span>
        </h4>
        <span
          v-if="loadingWorks"
          class="text-xs text-gray-400 flex items-center"
        >
          <span
            class="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400 mr-2"
          ></span>
          Loading work history...
        </span>
      </div>

      <!-- Comparative Table -->
      <div
        class="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40"
      >
        <table class="w-full text-sm text-left">
          <thead>
            <tr>
              <th
                class="p-4 bg-gray-900/80 border-b border-gray-800 w-32 text-gray-400 font-semibold uppercase tracking-wider text-xs"
              >
                Field
              </th>
              <th
                v-for="actor in actorsToCompare"
                :key="'h-' + actor.id"
                class="p-4 bg-gray-900/80 border-b border-l border-gray-800 min-w-[280px]"
                :class="selectedKeepId === actor.id ? 'bg-blue-900/10' : ''"
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div
                      class="h-10 w-10 rounded-full overflow-hidden shrink-0 border border-gray-800 bg-gray-900 flex items-center justify-center text-gray-500"
                    >
                      <NuxtImg
                        format="webp"
                        v-if="actor.profile_picture"
                        :src="actor.profile_picture"
                        class="h-full w-full object-cover"
                      />
                      <svg
                        v-else
                        class="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div class="min-w-0">
                      <h5 class="font-bold text-white text-base">Candidate</h5>
                      <p class="text-xs text-gray-400 font-mono mt-0.5">
                        ID: {{ actor.id }}
                      </p>
                    </div>
                  </div>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-800/60">
            <!-- Name Row -->
            <tr>
              <td class="p-4 text-gray-400 font-medium bg-gray-900/30">
                Name
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'n-' + actor.id"
                class="p-4 border-l border-gray-800"
                :class="getNameDiffClass()"
              >
                {{ actor.firstname }} {{ actor.lastname }}
              </td>
            </tr>
            <!-- Work Count Row -->
            <tr>
              <td class="p-4 text-gray-400 font-medium bg-gray-900/30">
                Linked Works
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'w-' + actor.id"
                class="p-4 border-l border-gray-800 font-semibold"
                :class="
                  worksCount[actor.id] > 0 ? 'text-green-400' : 'text-gray-500'
                "
              >
                {{
                  loadingWorks
                    ? "..."
                    : (worksCount[actor.id] || 0) + " credits"
                }}
              </td>
            </tr>
            <!-- Nationality Row -->
            <tr v-if="hasAny('nationality')">
              <td class="p-4 text-gray-400 font-medium bg-gray-900/30">
                Nationality
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'nat-' + actor.id"
                class="p-4 border-l border-gray-800"
                :class="getDiffClass('nationality')"
              >
                {{ actor.nationality || "-" }}
              </td>
            </tr>
            <!-- Born Row -->
            <tr v-if="hasAny('date_of_birth')">
              <td class="p-4 text-gray-400 font-medium bg-gray-900/30">
                Born
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'dob-' + actor.id"
                class="p-4 border-l border-gray-800"
                :class="getDiffClass('date_of_birth')"
              >
                {{
                  actor.date_of_birth ? formatDate(actor.date_of_birth) : "-"
                }}
              </td>
            </tr>
            <!-- TMDB Row -->
            <tr v-if="hasAny('tmdb_id')">
              <td class="p-4 text-gray-400 font-medium bg-gray-900/30">
                TMDB ID
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'tmd-' + actor.id"
                class="p-4 border-l border-gray-800"
                :class="getDiffClass('tmdb_id')"
              >
                {{ actor.tmdb_id || "-" }}
              </td>
            </tr>
            <!-- Wikidata Row -->
            <tr v-if="hasAny('wikidata_id')">
              <td class="p-4 text-gray-400 font-medium bg-gray-900/30">
                Wikidata
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'wik-' + actor.id"
                class="p-4 border-l border-gray-800 font-mono text-xs break-all"
                :class="getDiffClass('wikidata_id')"
              >
                {{ actor.wikidata_id || "-" }}
              </td>
            </tr>
            <!-- Bio Row -->
            <tr v-if="hasAny('bio')">
              <td
                class="p-4 text-gray-400 font-medium bg-gray-900/30 align-top"
              >
                Bio
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'bio-' + actor.id"
                class="p-4 border-l border-gray-800 align-top max-w-xs"
                :class="getDiffClass('bio')"
              >
                <div
                  class="line-clamp-4 italic text-xs leading-relaxed"
                  :class="actor.bio ? '' : 'text-gray-600'"
                >
                  {{ actor.bio || "-" }}
                </div>
              </td>
            </tr>
            <!-- Action Row -->
            <tr>
              <td class="p-4 text-gray-400 font-medium bg-gray-900/30">
                Action
              </td>
              <td
                v-for="actor in actorsToCompare"
                :key="'sel-' + actor.id"
                class="p-0 border-l border-gray-800 bg-gray-900/50 transition-colors"
                :class="
                  selectedKeepId === actor.id
                    ? 'bg-blue-900/20 shadow-inner'
                    : 'hover:bg-gray-800'
                "
              >
                <label
                  class="flex items-center space-x-3 cursor-pointer w-full h-full p-4"
                >
                  <input
                    type="radio"
                    name="keepId"
                    :value="actor.id"
                    v-model="selectedKeepId"
                    class="h-5 w-5 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900 bg-gray-950 border-gray-700"
                  />
                  <span
                    class="text-sm font-bold"
                    :class="
                      selectedKeepId === actor.id
                        ? 'text-blue-400'
                        : 'text-gray-300'
                    "
                    >Keep ID #{{ actor.id }}</span
                  >
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Action Bar -->
      <div
        class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-800/80 bg-gray-900/50 p-4 rounded-xl"
      >
        <div class="text-sm">
          <span v-if="selectedKeepId" class="text-gray-300">
            Profile to keep:
            <strong class="text-blue-400">ID #{{ selectedKeepId }}</strong
            >. The other profile will be merged into it and deleted. Linked
            works from both will be combined.
          </span>
          <span v-else class="text-yellow-500 font-medium">
            Please choose a profile to keep before merging.
          </span>
        </div>

        <button
          @click="mergeActors"
          :disabled="!selectedKeepId || merging"
          class="py-2.5 px-6 bg-green-600 hover:bg-green-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl text-sm transition-all duration-150 flex items-center justify-center shrink-0 shadow-lg shadow-green-900/10"
        >
          <span
            v-if="merging"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ merging ? "Merging..." : "Merge Profiles" }}</span>
        </button>
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

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

import { ref, computed, watch, onMounted, onUnmounted } from "vue";

interface VoiceActorCandidate {
  id: number;
  firstname: string;
  lastname: string;
  bio?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  tmdb_id?: number | null;
  wikidata_id?: string | null;
  profile_picture?: string | null;
}

// State
const actorA = ref<VoiceActorCandidate | null>(null);
const actorB = ref<VoiceActorCandidate | null>(null);

const searchQueryA = ref("");
const searchQueryB = ref("");
const searchResultsA = ref<VoiceActorCandidate[]>([]);
const searchResultsB = ref<VoiceActorCandidate[]>([]);
const searchLoadingA = ref(false);
const searchLoadingB = ref(false);

const activeSearch = ref<"A" | "B" | null>(null);
const searchTimerA = ref<ReturnType<typeof setTimeout> | null>(null);
const searchTimerB = ref<ReturnType<typeof setTimeout> | null>(null);

const worksCount = ref<Record<number, number>>({});
const loadingWorks = ref(false);

const selectedKeepId = ref<number | null>(null);
const merging = ref(false);
const error = ref("");

const toast = ref({
  show: false,
  message: "",
  type: "info",
});

const showToast = (
  message: string,
  type: "success" | "error" | "info" = "info",
) => {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

// Computed
const actorsToCompare = computed(() => {
  if (actorA.value && actorB.value) {
    return [actorA.value, actorB.value];
  }
  return [];
});

// Watchers to fetch full profile and work counts when actors are selected
watch([actorA, actorB], async ([newA, newB]) => {
  if (newA && newB) {
    if (newA.id === newB.id) {
      error.value =
        "You selected the same voice actor twice. Please select two different profiles to merge.";
      selectedKeepId.value = null;
      return;
    }
    error.value = "";
    selectedKeepId.value = null; // Reset selection

    // Full profiles are already fetched by search-voice-actors, so we just need works count
    await fetchWorksCount([newA.id, newB.id]);

    // Auto-preselect the one with the most works or most info
    autoSelectBest();
  }
});

const fetchWorksCount = async (ids: number[]) => {
  loadingWorks.value = true;
  worksCount.value = {};
  try {
    const data = await $fetch("/api/count-voice-actor-works", {
      method: "POST",
      body: { ids },
    });

    if (data) {
      worksCount.value = data as any;
    }
  } catch (err: any) {
    console.error("Error fetching works count:", err);
  } finally {
    loadingWorks.value = false;
  }
};

const autoSelectBest = () => {
  if (!actorA.value || !actorB.value) return;
  const countA = worksCount.value[actorA.value.id] || 0;
  const countB = worksCount.value[actorB.value.id] || 0;

  if (countA > countB) {
    selectedKeepId.value = actorA.value.id;
  } else if (countB > countA) {
    selectedKeepId.value = actorB.value.id;
  } else {
    // Tie breaker: profile completeness
    const scoreA = calculateScore(actorA.value);
    const scoreB = calculateScore(actorB.value);
    if (scoreA >= scoreB) {
      selectedKeepId.value = actorA.value.id;
    } else {
      selectedKeepId.value = actorB.value.id;
    }
  }
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

// Comparison Helpers
const isDifferent = (field: keyof VoiceActorCandidate) => {
  if (actorsToCompare.value.length < 2) return false;
  const firstVal = actorsToCompare.value[0][field];
  return actorsToCompare.value.some((a) => a[field] !== firstVal);
};

const isDifferentName = () => {
  if (actorsToCompare.value.length < 2) return false;
  const firstName =
    actorsToCompare.value[0].firstname +
    " " +
    actorsToCompare.value[0].lastname;
  return actorsToCompare.value.some(
    (a) => a.firstname + " " + a.lastname !== firstName,
  );
};

const getDiffClass = (field: keyof VoiceActorCandidate) => {
  return isDifferent(field)
    ? "text-amber-300 font-bold bg-amber-900/30 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.5)]"
    : "text-gray-300";
};

const getNameDiffClass = () => {
  return isDifferentName()
    ? "text-amber-300 font-bold bg-amber-900/30 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.5)]"
    : "text-gray-200 font-semibold";
};

const hasAny = (field: keyof VoiceActorCandidate) => {
  return actorsToCompare.value.some(
    (a) => a[field] !== null && a[field] !== undefined && a[field] !== "",
  );
};

// Search Logic
const triggerSearch = (type: "A" | "B") => {
  const timer = type === "A" ? searchTimerA : searchTimerB;
  if (timer.value) {
    clearTimeout(timer.value);
  }
  timer.value = setTimeout(() => {
    executeSearch(type);
  }, 300);
};

const executeSearch = async (type: "A" | "B") => {
  const query =
    type === "A" ? searchQueryA.value.trim() : searchQueryB.value.trim();
  const loadingRef = type === "A" ? searchLoadingA : searchLoadingB;
  const resultsRef = type === "A" ? searchResultsA : searchResultsB;

  if (!query) {
    resultsRef.value = [];
    return;
  }

  loadingRef.value = true;
  try {
    const data = await $fetch("/api/search-voice-actors", {
      params: { query, limit: "10" }
    });

    resultsRef.value = (data as any) || [];
  } catch (err: any) {
    console.error(`Error searching voice actors (${type}):`, err);
  } finally {
    loadingRef.value = false;
  }
};

const selectActor = (type: "A" | "B", va: VoiceActorCandidate) => {
  if (type === "A") {
    actorA.value = va;
    searchQueryA.value = "";
  } else {
    actorB.value = va;
    searchQueryB.value = "";
  }
  activeSearch.value = null;
};

const reset = () => {
  actorA.value = null;
  actorB.value = null;
  searchQueryA.value = "";
  searchQueryB.value = "";
  searchResultsA.value = [];
  searchResultsB.value = [];
  selectedKeepId.value = null;
  error.value = "";
};

const mergeActors = async () => {
  if (!selectedKeepId.value || !actorA.value || !actorB.value) return;

  merging.value = true;
  error.value = "";

  try {
    const otherId =
      selectedKeepId.value === actorA.value.id
        ? actorB.value.id
        : actorA.value.id;

    await $fetch("/api/merge_voice_actor_duplicates", {
      method: "POST",
      body: {
        keepId: selectedKeepId.value,
        ids: [otherId],
      },
    });

    showToast("Voice actor profiles merged successfully!", "success");

    // Reset after success
    reset();
  } catch (err: any) {
    console.error("Error merging voice actors:", err);
    showToast(err.message || "Failed to merge profiles", "error");
  } finally {
    merging.value = false;
  }
};

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};

const handleOutsideClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest(".relative")) {
    activeSearch.value = null;
  }
};

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
});
</script>
