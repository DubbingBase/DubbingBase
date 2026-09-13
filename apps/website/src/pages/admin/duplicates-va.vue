<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div
      class="theme-surface-overlay p-6 rounded-2xl border theme-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h3 class="text-lg font-bold theme-text">
          {{ $t("admin.duplicates.title") }}
        </h3>
        <p class="text-sm theme-text-muted">
          {{ $t("admin.duplicates.description") }}
        </p>
      </div>
      <button
        @click="fetchDuplicates"
        :disabled="loading"
        class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
      >
        <span
          v-if="loading"
          class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
        ></span>
        <span>{{
          loading
            ? $t("admin.duplicates.scanning")
            : $t("admin.duplicates.findDuplicates")
        }}</span>
      </button>
    </div>

    <!-- Error Alert -->
    <div
      v-if="error"
      class="p-4 theme-status-danger border border-[var(--app-color-danger-border)] rounded-xl flex items-center space-x-3 theme-status-danger-text text-sm"
    >
      <svg
        class="h-5 w-5 theme-status-danger-text shrink-0"
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

    <!-- Scanner Loading State -->
    <div
      v-if="loading"
      class="flex flex-col items-center justify-center py-24 space-y-3 theme-surface-overlay border theme-border rounded-2xl"
    >
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"
      ></div>
      <p class="theme-text-muted text-sm">
        {{ $t("admin.duplicates.comparingProfiles") }}
      </p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="duplicates.length === 0"
      class="text-center py-20 theme-surface-overlay border theme-border rounded-2xl space-y-2"
    >
      <div
        class="h-12 w-12 rounded-full theme-surface-overlay flex items-center justify-center theme-text-muted mx-auto"
      >
        <svg
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p class="theme-text-muted font-semibold">
        {{ $t("admin.duplicates.noDuplicatesFound") }}
      </p>
      <p class="text-xs theme-text-muted">
        {{ $t("admin.duplicates.allProfilesDistinct") }}
      </p>
    </div>

    <!-- Duplicates Group List -->
    <div v-else class="space-y-8">
      <div
        v-for="(group, idx) in duplicates"
        :key="idx"
        class="theme-surface-overlay border theme-border rounded-2xl p-6 space-y-6 shadow-xl"
      >
        <div
          class="flex items-center justify-between border-b theme-border pb-4"
        >
          <h4 class="text-md font-bold theme-text flex items-center space-x-2">
            <span
              class="h-6 w-6 rounded-full theme-surface-muted theme-text-secondary text-xs font-semibold flex items-center justify-center"
            >
              {{ idx + 1 }}
            </span>
            <span>{{ $t("admin.duplicates.duplicateCandidates") }}</span>
          </h4>
          <span
            class="text-xs theme-text-muted theme-surface-muted px-3 py-1 rounded-full border theme-border"
          >
            {{ group.actors.length
            }}{{ $t("admin.duplicates.matchesDetected") }}</span
          >
        </div>

        <!-- Comparative Table -->
        <div class="overflow-x-auto rounded-xl border theme-border theme-input">
          <table class="w-full text-sm text-left">
            <thead>
              <tr>
                <th
                  class="p-4 theme-surface-overlay border-b theme-border w-32 theme-text-muted font-semibold uppercase tracking-wider text-xs"
                >
                  {{ $t("admin.duplicates.field") }}
                </th>
                <th
                  v-for="actor in group.actors"
                  :key="'h-' + actor.id"
                  class="p-4 theme-surface-overlay border-b border-l theme-border min-w-[280px]"
                  :class="group.selectedId === actor.id ? 'theme-selected' : ''"
                >
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div
                        class="h-10 w-10 rounded-full overflow-hidden shrink-0 border theme-border theme-surface-overlay flex items-center justify-center theme-text-muted"
                      >
                        <NuxtImg
                          format="webp"
                          v-if="actor.profile_picture"
                          :src="actor.profile_picture"
                          class="h-full w-full object-cover"
                          alt="Actor Avatar"
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
                        <h5 class="font-bold theme-text text-base">
                          {{ $t("admin.duplicates.candidate") }}
                        </h5>
                        <p class="text-xs theme-text-muted font-mono mt-0.5">
                          {{ $t("common.idLabel") }}{{ actor.id }}
                        </p>
                      </div>
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody class="divide-y theme-divide">
              <!-- Name Row -->
              <tr>
                <td
                  class="p-4 theme-text-muted font-medium theme-surface-overlay"
                >
                  {{ $t("voiceActor.name") }}
                </td>
                <td
                  v-for="actor in group.actors"
                  :key="'n-' + actor.id"
                  class="p-4 border-l theme-border"
                  :class="getNameDiffClass(group.actors)"
                >
                  {{ actor.firstname }} {{ actor.lastname }}
                </td>
              </tr>
              <!-- Nationality Row -->
              <tr v-if="hasAny(group.actors, 'nationality')">
                <td
                  class="p-4 theme-text-muted font-medium theme-surface-overlay"
                >
                  {{ $t("profile.nationality") }}
                </td>
                <td
                  v-for="actor in group.actors"
                  :key="'nat-' + actor.id"
                  class="p-4 border-l theme-border"
                  :class="getDiffClass(group.actors, 'nationality')"
                >
                  {{ actor.nationality || "-" }}
                </td>
              </tr>
              <!-- Born Row -->
              <tr v-if="hasAny(group.actors, 'date_of_birth')">
                <td
                  class="p-4 theme-text-muted font-medium theme-surface-overlay"
                >
                  {{ $t("admin.duplicates.born") }}
                </td>
                <td
                  v-for="actor in group.actors"
                  :key="'dob-' + actor.id"
                  class="p-4 border-l theme-border"
                  :class="getDiffClass(group.actors, 'date_of_birth')"
                >
                  {{
                    actor.date_of_birth ? formatDate(actor.date_of_birth) : "-"
                  }}
                </td>
              </tr>
              <!-- TMDB Row -->
              <tr v-if="hasAny(group.actors, 'tmdb_id')">
                <td
                  class="p-4 theme-text-muted font-medium theme-surface-overlay"
                >
                  {{ $t("voiceActorEdit.tmdbId") }}
                </td>
                <td
                  v-for="actor in group.actors"
                  :key="'tmd-' + actor.id"
                  class="p-4 border-l theme-border"
                  :class="getDiffClass(group.actors, 'tmdb_id')"
                >
                  {{ actor.tmdb_id || "-" }}
                </td>
              </tr>
              <!-- Wikidata Row -->
              <tr v-if="hasAny(group.actors, 'wikidata_id')">
                <td
                  class="p-4 theme-text-muted font-medium theme-surface-overlay"
                >
                  {{ $t("admin.duplicates.wikidata") }}
                </td>
                <td
                  v-for="actor in group.actors"
                  :key="'wik-' + actor.id"
                  class="p-4 border-l theme-border font-mono text-xs break-all"
                  :class="getDiffClass(group.actors, 'wikidata_id')"
                >
                  {{ actor.wikidata_id || "-" }}
                </td>
              </tr>
              <!-- Bio Row -->
              <tr v-if="hasAny(group.actors, 'bio')">
                <td
                  class="p-4 theme-text-muted font-medium theme-surface-overlay align-top"
                >
                  {{ $t("admin.duplicates.bio") }}
                </td>
                <td
                  v-for="actor in group.actors"
                  :key="'bio-' + actor.id"
                  class="p-4 border-l theme-border align-top max-w-xs"
                  :class="getDiffClass(group.actors, 'bio')"
                >
                  <div
                    class="line-clamp-4 italic text-xs leading-relaxed"
                    :class="actor.bio ? '' : 'theme-text-secondary'"
                  >
                    {{ actor.bio || "-" }}
                  </div>
                </td>
              </tr>
              <!-- Action Row -->
              <tr>
                <td
                  class="p-4 theme-text-muted font-medium theme-surface-overlay"
                >
                  {{ $t("admin.auditLogs.action") }}
                </td>
                <td
                  v-for="actor in group.actors"
                  :key="'sel-' + actor.id"
                  class="p-0 border-l theme-border theme-surface-overlay transition-colors"
                  :class="
                    group.selectedId === actor.id
                      ? 'theme-selected shadow-inner'
                      : 'theme-hover-surface-muted'
                  "
                >
                  <label
                    class="flex items-center space-x-3 cursor-pointer w-full h-full p-4"
                  >
                    <input
                      type="radio"
                      :name="'group-' + idx"
                      :value="actor.id"
                      v-model="group.selectedId"
                      class="h-5 w-5 theme-status-info-text focus:ring-[var(--app-color-focus)] focus:ring-offset-[var(--app-color-background)] theme-input theme-border"
                    />
                    <span
                      class="text-sm font-bold"
                      :class="
                        group.selectedId === actor.id
                          ? 'theme-status-info-text'
                          : 'theme-text-secondary'
                      "
                      >{{ $t("admin.duplicates.keepId") }}{{ actor.id }}</span
                    >
                  </label>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Group Merge Action Bar -->
        <div
          class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t theme-border theme-surface-overlay p-4 rounded-xl"
        >
          <div class="text-sm">
            <span v-if="group.selectedId" class="theme-text-secondary"
              >{{ $t("admin.duplicates.profileToKeep")
              }}<strong class="theme-status-info-text"
                >{{ $t("admin.duplicates.idHash")
                }}{{ group.selectedId }}</strong
              >{{ $t("admin.duplicates.allOtherDuplicatesMerged") }}</span
            >
            <span v-else class="theme-status-warning-text font-medium">{{
              $t("admin.duplicates.chooseProfileToKeep")
            }}</span>
          </div>

          <button
            @click="mergeGroup(group)"
            :disabled="!group.selectedId || mergingGroup[idx]"
            class="py-2 px-4 bg-green-600 hover:bg-green-500 disabled:bg-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] text-white font-semibold rounded-xl text-sm transition-all duration-150 flex items-center justify-center shrink-0 shadow-lg shadow-green-900/10"
          >
            <span
              v-if="mergingGroup[idx]"
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
            ></span>
            <span>{{
              mergingGroup[idx]
                ? $t("admin.duplicates.merging")
                : $t("admin.duplicates.mergeSelected")
            }}</span>
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
          ? 'theme-status-success border-[var(--app-color-success-border)] theme-status-success-text'
          : toast.type === 'error'
            ? 'theme-status-danger border-[var(--app-color-danger-border)] theme-status-danger-text'
            : 'theme-surface-overlay theme-border theme-text'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: "admin",
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

const isDifferent = (
  actors: VoiceActorCandidate[],
  field: keyof VoiceActorCandidate,
) => {
  if (!actors || actors.length < 2 || !actors[0]) return false;
  const firstVal = actors[0][field];
  return actors.some((a) => a[field] !== firstVal);
};

const isDifferentName = (actors: VoiceActorCandidate[]) => {
  if (!actors || actors.length < 2 || !actors[0]) return false;
  const firstName = actors[0].firstname + " " + actors[0].lastname;
  return actors.some((a) => a.firstname + " " + a.lastname !== firstName);
};

const getDiffClass = (
  actors: VoiceActorCandidate[],
  field: keyof VoiceActorCandidate,
) => {
  return isDifferent(actors, field)
    ? "theme-status-warning-text font-bold bg-amber-900/30 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.5)]"
    : "theme-text-secondary";
};

const getNameDiffClass = (actors: VoiceActorCandidate[]) => {
  return isDifferentName(actors)
    ? "theme-status-warning-text font-bold bg-amber-900/30 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.5)]"
    : "theme-text font-semibold";
};

const hasAny = (
  actors: VoiceActorCandidate[],
  field: keyof VoiceActorCandidate,
) => {
  return actors.some(
    (a) => a[field] !== null && a[field] !== undefined && a[field] !== "",
  );
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
  if (!actors || actors.length === 0 || !actors[0]) return null;

  let bestActor = actors[0];
  let bestScore = calculateScore(bestActor);

  for (let i = 1; i < actors.length; i++) {
    const actor = actors[i];
    if (!actor) continue;
    const score = calculateScore(actor);
    if (score > bestScore) {
      bestScore = score;
      bestActor = actor;
    } else if (score === bestScore) {
      // Prefer the oldest record in case of a tie
      if (actor.id < bestActor.id) {
        bestActor = actor;
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

    const data = await $fetch<any[]>("/api/find_duplicate_voice_actors");

    duplicates.value = (data || []).map((group: any) => ({
      actors: group.actors || [],
      selectedId: preselectBest(group.actors || []),
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
      .map((a) => a.id)
      .filter((id) => id !== group.selectedId);

    await $fetch("/api/merge_voice_actor_duplicates", {
      method: "POST",
      body: {
        keepId: group.selectedId,
        ids: idsToMerge,
      },
    });

    showToast("Duplicate voice actor profiles merged successfully", "success");

    // Remove group from UI list
    duplicates.value = duplicates.value.filter((g) => g !== group);
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
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
};
</script>
