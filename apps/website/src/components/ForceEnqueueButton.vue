<template>
  <button
    type="button"
    @click.prevent="handleEnqueue"
    :disabled="isLoading"
    :title="buttonTitle"
    class="p-1.5 rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-1 shrink-0 border border-transparent"
    :class="buttonClass"
    aria-label="Force enqueue media"
  >
    <!-- Loading Spinner -->
    <svg
      v-if="isLoading"
      class="w-4 h-4 animate-spin text-cyan-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      ></circle>
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8H4z"
      ></path>
    </svg>

    <!-- Success Checkmark -->
    <svg
      v-else-if="status === 'success'"
      class="w-4 h-4 text-emerald-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
    </svg>

    <!-- Already Queued Info -->
    <svg
      v-else-if="status === 'already_queued'"
      class="w-4 h-4 text-amber-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>

    <!-- Error Icon -->
    <svg
      v-else-if="status === 'error'"
      class="w-4 h-4 text-rose-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>

    <!-- Default Sync/Queue Icon -->
    <svg
      v-else
      class="w-4 h-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  </button>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  mediaType: string;
  mediaId: number | string;
  seasonNumber?: number | string | null;
  episodeNumber?: number | string | null;
  language?: string | null;
}>();

const isLoading = ref(false);
const status = ref<"idle" | "success" | "already_queued" | "error">("idle");
let timeoutId: any = null;

const buttonTitle = computed(() => {
  if (isLoading.value) return "Ajout à la file d'attente...";
  if (status.value === "success") return "Ajouté à la file d'attente !";
  if (status.value === "already_queued") return "Déjà dans la file d'attente";
  if (status.value === "error") return "Erreur lors de l'ajout";
  return "Forcer l'analyse / re-scanner Wikipédia (enqueue)";
});

const buttonClass = computed(() => {
  if (status.value === "success") {
    return "bg-emerald-500/10 border-emerald-500/30 text-emerald-500";
  }
  if (status.value === "already_queued") {
    return "bg-amber-500/10 border-amber-500/30 text-amber-500";
  }
  if (status.value === "error") {
    return "bg-rose-500/10 border-rose-500/30 text-rose-500";
  }
  return "text-gray-500 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-gray-100 dark:hover:bg-[#222]";
});

const handleEnqueue = async () => {
  if (isLoading.value) return;

  clearTimeout(timeoutId);
  isLoading.value = true;
  status.value = "idle";

  try {
    const numId =
      typeof props.mediaId === "string"
        ? parseInt(props.mediaId, 10)
        : props.mediaId;

    const numSeason =
      props.seasonNumber !== undefined && props.seasonNumber !== null
        ? typeof props.seasonNumber === "string"
          ? parseInt(props.seasonNumber, 10)
          : props.seasonNumber
        : undefined;

    const numEpisode =
      props.episodeNumber !== undefined && props.episodeNumber !== null
        ? typeof props.episodeNumber === "string"
          ? parseInt(props.episodeNumber, 10)
          : props.episodeNumber
        : undefined;

    await $fetch("/api/media-queue", {
      method: "POST",
      body: {
        action: "enqueue",
        mediaType: props.mediaType,
        mediaId: numId,
        tmdbId: numId,
        seasonNumber: isNaN(numSeason as number) ? undefined : numSeason,
        episodeNumber: isNaN(numEpisode as number) ? undefined : numEpisode,
        language: props.language ?? undefined,
      },
    });

    status.value = "success";
  } catch (err: any) {
    const message = err?.data?.message || err?.message || "";
    if (message.includes("already in the")) {
      status.value = "already_queued";
    } else {
      console.error("Force enqueue error:", err);
      status.value = "error";
    }
  } finally {
    isLoading.value = false;
    timeoutId = setTimeout(() => {
      status.value = "idle";
    }, 4000);
  }
};
</script>
