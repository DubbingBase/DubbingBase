<template>
  <div class="relative inline-flex items-center">
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

    <!-- Teleported Floating Toast with Copiable Error -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform translate-y-2 opacity-0"
      >
        <div
          v-if="toast.show"
          class="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-full bg-[#18181b] dark:bg-[#121212] text-white border rounded-2xl shadow-2xl p-4 flex flex-col gap-2.5 backdrop-blur-lg"
          :class="toastBorderClass"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 font-semibold text-sm">
              <span v-if="toast.type === 'success'" class="text-emerald-400 flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Ajouté à la file d'attente
              </span>
              <span v-else-if="toast.type === 'info'" class="text-amber-400 flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Déjà dans la file d'attente
              </span>
              <span v-else class="text-rose-400 flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Erreur d'ajout à la file
              </span>
            </div>

            <button
              @click="toast.show = false"
              class="text-gray-400 hover:text-white text-xs p-1 rounded-lg hover:bg-gray-800 transition-colors"
            >
              ✕
            </button>
          </div>

          <p class="text-xs text-gray-300 font-mono bg-black/60 p-2.5 rounded-xl break-all select-all border border-white/5">
            {{ toast.message }}
          </p>

          <div class="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
            <span class="text-[11px] text-gray-500">
              Media: {{ props.mediaType }} (ID: {{ props.mediaId }})
            </span>
            <button
              @click="copyText(toast.message)"
              class="px-2.5 py-1 text-xs rounded-lg border flex items-center gap-1.5 transition-colors font-medium"
              :class="copied ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'"
            >
              <svg v-if="copied" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>{{ copied ? "Copié !" : "Copier l'erreur" }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { API_CLIENT_HEADER, API_CLIENT_VALUE } from "@app/shared-logic";

const props = defineProps<{
  mediaType: string;
  mediaId: number | string;
  seasonNumber?: number | string | null;
  episodeNumber?: number | string | null;
  language?: string | null;
}>();

const isLoading = ref(false);
const status = ref<"idle" | "success" | "already_queued" | "error">("idle");
const copied = ref(false);

const toast = ref<{
  show: boolean;
  type: "success" | "info" | "error";
  message: string;
}>({
  show: false,
  type: "info",
  message: "",
});

let timeoutId: any = null;
let toastTimeoutId: any = null;

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

const toastBorderClass = computed(() => {
  if (toast.value.type === "success") return "border-emerald-500/30";
  if (toast.value.type === "info") return "border-amber-500/30";
  return "border-rose-500/30";
});

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (e) {
    console.error("Clipboard copy failed:", e);
  }
};

const showToast = (type: "success" | "info" | "error", message: string) => {
  clearTimeout(toastTimeoutId);
  toast.value = { show: true, type, message };
  // Auto-hide success/info after 5s, keep errors open longer (10s)
  const duration = type === "error" ? 12000 : 5000;
  toastTimeoutId = setTimeout(() => {
    toast.value.show = false;
  }, duration);
};

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

    const res = await $fetch<{
      success: boolean;
      alreadyQueued?: boolean;
      message?: string;
    }>("/api/media-queue", {
      method: "POST",
      headers: {
        [API_CLIENT_HEADER]: API_CLIENT_VALUE,
      },
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

    if (res?.alreadyQueued) {
      status.value = "already_queued";
      showToast("info", res.message || `Ce contenu (${props.mediaType} ${numId}) est déjà en attente dans la file.`);
    } else {
      status.value = "success";
      showToast("success", `Contenu (${props.mediaType} ${numId}) ajouté avec succès à la file d'attente de détection.`);
    }
  } catch (err: any) {
    const message =
      err?.data?.message ||
      err?.data?.statusMessage ||
      err?.statusMessage ||
      err?.message ||
      (typeof err === "object" ? JSON.stringify(err) : String(err));

    if (message.includes("already in the")) {
      status.value = "already_queued";
      showToast("info", message);
    } else {
      console.error("Force enqueue error:", err);
      status.value = "error";
      showToast("error", message);
    }
  } finally {
    isLoading.value = false;
    timeoutId = setTimeout(() => {
      status.value = "idle";
    }, 4000);
  }
};
</script>
