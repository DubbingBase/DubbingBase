<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div
      class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h3 class="text-lg font-bold text-white">{{ $t('admin.queue.title') }}</h3>
        <p class="text-sm text-gray-400">
          {{ $t('admin.queue.description') }}
        </p>
        <p v-if="pendingCount !== null" class="text-xs text-yellow-400 mt-1">
          {{ $t('admin.queue.pendingCount', { count: pendingCount }) }}
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          v-if="isDev"
          @click="clearQueue"
          :disabled="isClearing || isLoading"
          class="py-2.5 px-5 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isClearing"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ $t('admin.queue.clearQueue') }}</span>
        </button>
        <button
          @click="startProcessing"
          :disabled="isProcessing || isLoading"
          class="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isProcessing"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ $t('admin.queue.startProcessing') }}</span>
        </button>
        <button
          @click="() => fetchQueueAndUsers()"
          :disabled="isLoading"
          class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isLoading"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>{{ $t('admin.queue.refreshQueue') }}</span>
        </button>
      </div>
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

    <!-- Queue Loading State -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 space-y-3 bg-gray-900/40 border border-gray-800/60 rounded-2xl"
    >
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"
      ></div>
      <p class="text-gray-400 text-sm">{{ $t('admin.queue.loadingQueue') }}</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="allQueueItems.length === 0"
      class="text-center py-20 bg-gray-900/20 border border-gray-850 rounded-2xl space-y-2"
    >
      <div
        class="h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center text-gray-500 mx-auto"
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
      <p class="text-gray-400 font-semibold">
        {{ $t('admin.queue.noMediaRequests') }}
      </p>
      <p class="text-xs text-gray-500">{{ $t('admin.queue.queueEmpty') }}</p>
    </div>

    <!-- Queue Content (Filters + Table) -->
    <div v-else class="space-y-6">
      <!-- Filters -->
      <div
        class="flex flex-wrap items-center gap-3 bg-gray-900 p-4 rounded-2xl border border-gray-800"
      >
        <div class="flex items-center space-x-2">
          <label class="text-xs text-gray-400 font-semibold uppercase">{{ $t('admin.queue.status') }}</label>
          <select
            v-model="filterStatus"
            class="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{{ $t('admin.queue.all') }}</option>
            <option value="pending">{{ $t('admin.queue.pending') }}</option>
            <option value="processing">{{ $t('admin.queue.processing') }}</option>
            <option value="completed">{{ $t('admin.queue.completed') }}</option>
            <option value="failed">{{ $t('admin.queue.failed') }}</option>
          </select>
        </div>
        <div class="flex items-center space-x-2">
          <label class="text-xs text-gray-400 font-semibold uppercase">{{ $t('admin.queue.type') }}</label>
          <select
            v-model="filterType"
            class="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">{{ $t('admin.queue.all') }}</option>
            <option value="movie">{{ $t('admin.queue.movie') }}</option>
            <option value="tv">{{ $t('admin.queue.tv') }}</option>
            <option value="season">{{ $t('admin.queue.season') }}</option>
            <option value="episode">{{ $t('admin.queue.episode') }}</option>
          </select>
        </div>
        <div class="flex items-center space-x-2">
          <label class="text-xs text-gray-400 font-semibold uppercase">{{ $t('admin.queue.search') }}</label>
          <input
            v-model="filterSearch"
            type="text"
            :placeholder="$t('admin.queue.searchPlaceholder')"
            class="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 w-32 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <span class="text-xs text-gray-500">
          {{ $t('admin.queue.filterCount', { filtered: filteredItems.length, total: allQueueItems.length }) }}
        </span>
      </div>

      <!-- Queue Grid / Table -->
      <div
        class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-xl"
      >
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr
                class="bg-gray-900/50 border-b border-gray-800 text-xs font-semibold text-gray-450 uppercase tracking-wider"
              >
                <th class="py-4 px-6">{{ $t('admin.queue.mediaDetails') }}</th>
                <th class="py-4 px-6">{{ $t('admin.queue.requestedBy') }}</th>
                <th class="py-4 px-6">{{ $t('common.status') }}</th>
                <th class="py-4 px-6">{{ $t('admin.queue.errors') }}</th>
                <th class="py-4 px-6 w-16 text-right">{{ $t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-800/50">
              <tr v-if="filteredItems.length === 0">
                <td colspan="5" class="py-8 text-center text-gray-500">
                  {{ $t('admin.queue.noMatchingItems') }}
                </td>
              </tr>
              <tr
                v-for="item in filteredItems"
                :key="item.id"
                class="hover:bg-gray-800/10 transition-colors"
              >
                <!-- Media details column -->
                <td class="py-4 px-6">
                  <div class="flex items-center space-x-2.5">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border"
                      :class="getTypeClass(item.media_type)"
                    >
                      {{ item.media_type }}
                    </span>
                    <div class="flex items-center space-x-3">
                      <a
                        :href="`https://www.themoviedb.org/${item.media_type === 'tv' || item.media_type === 'season' || item.media_type === 'episode' ? 'tv' : 'movie'}/${item.tmdb_id}`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center"
                        :title="$t('admin.queue.viewOnTmdb')"
                      >
                        <span>TMDB: {{ item.tmdb_id }}</span>
                        <svg class="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                      <a
                        :href="`https://hub.toolforge.org/${item.media_type === 'tv' || item.media_type === 'season' || item.media_type === 'episode' ? 'P4983' : 'P4947'}:${item.tmdb_id}?lang=fr`"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs font-semibold text-gray-400 hover:text-gray-300 hover:underline flex items-center"
                        :title="$t('admin.queue.viewOnWikipedia')"
                      >
                        <span>Wikipédia</span>
                        <svg class="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      </a>
                    </div>
                  </div>
                  <div class="mt-1 flex items-center space-x-2">
                    <span
                      v-if="item.season_number !== null && item.season_number !== undefined"
                      class="text-xs px-2 py-0.5 bg-gray-950 border border-gray-800 text-gray-300 rounded font-bold"
                    >
                      {{ $t('admin.queue.seasonNumber', { number: item.season_number }) }}
                    </span>
                    <span
                      v-if="item.episode_number !== null && item.episode_number !== undefined"
                      class="text-xs px-2 py-0.5 bg-gray-950 border border-gray-800 text-gray-300 rounded font-bold"
                    >
                      {{ $t('admin.queue.episodeNumber', { number: item.episode_number }) }}
                    </span>
                  </div>
                </td>

                <!-- Requester column -->
                <td class="py-4 px-6">
                  <div
                    class="font-medium text-gray-200 text-sm truncate max-w-xs"
                  >
                    {{ getUserEmail(item.user_id) }}
                  </div>
                  <div class="text-xs text-gray-500 mt-0.5">
                    {{ formatTime(item.created_at) }}
                  </div>
                </td>

                <!-- Status column -->
                <td class="py-4 px-6">
                  <div class="flex items-center space-x-2">
                    <span
                      class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border flex items-center space-x-1.5"
                      :class="getStatusClass(item.status)"
                    >
                      <span
                        v-if="item.status === 'processing'"
                        class="h-2 w-2 rounded-full bg-blue-400 animate-pulse"
                      ></span>
                      <span>{{ item.status }}</span>
                    </span>
                  </div>
                </td>

                <!-- Errors column -->
                <td class="py-4 px-6">
                  <div
                    v-if="item.error_message"
                    class="text-xs text-red-400 max-w-sm line-clamp-2 leading-relaxed bg-red-950/20 border border-red-900/30 rounded-xl p-2.5 font-mono"
                  >
                    {{ item.error_message }}
                  </div>
                  <div v-else class="text-xs text-gray-550 italic">—</div>
                </td>

                <!-- Actions column -->
                <td class="py-4 px-6 text-right">
                  <div class="flex items-center justify-end space-x-1">
                    <button
                      v-if="
                        item.status === 'failed' || item.status === 'completed'
                      "
                      @click="reEnqueueItem(item)"
                      :disabled="
                        reEnqueuingId === item.id || deletingId === item.id
                      "
                      :title="$t('admin.queue.reEnqueueItem')"
                      class="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg
                        v-if="reEnqueuingId === item.id"
                        class="w-4 h-4 animate-spin text-blue-400"
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
                    <button
                      @click="deleteItem(item.id)"
                      :disabled="
                        deletingId === item.id || reEnqueuingId === item.id
                      "
                      :title="$t('admin.queue.deleteItem')"
                      class="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <svg
                        v-if="deletingId === item.id"
                        class="w-4 h-4 animate-spin text-red-400"
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      <svg
                        v-else
                        class="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
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
import { ref, computed, watch } from "vue";
import type { Database } from "@app/supabase";

type QueueItem =
  Database["public"]["Functions"]["get_media_queue_items"]["Returns"][number];

interface ListUsersResponse {
  users?: Array<{ id: string; email: string }>;
}

interface ToastState {
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
}

const supabase = useSupabaseClient<Database>();
const { t } = useI18n();

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

const queueItems = ref<QueueItem[]>([]);
const usersMap = ref<Record<string, string>>({});
const isLoading = ref(true);
const isProcessing = ref(false);
const isClearing = ref(false);
const deletingId = ref<number | null>(null);
const reEnqueuingId = ref<number | null>(null);
const error = ref("");
const isDev = import.meta.env.DEV;
const pendingCount = ref<number | null>(null);

const filterStatus = ref("all");
const filterType = ref("all");
const filterSearch = ref("");

const allQueueItems = computed(() => queueItems.value);

const filteredItems = computed(() => {
  return allQueueItems.value.filter((item) => {
    if (filterStatus.value !== "all" && item.status !== filterStatus.value) {
      return false;
    }
    if (filterType.value !== "all" && item.media_type !== filterType.value) {
      return false;
    }
    if (
      filterSearch.value &&
      !String(item.tmdb_id).includes(filterSearch.value)
    ) {
      return false;
    }
    return true;
  });
});

const toast = ref<ToastState>({
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

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

const getStatusClass = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-500/10 border-green-500/25 text-green-400";
    case "processing":
      return "bg-blue-500/10 border-blue-500/25 text-blue-400";
    case "pending":
      return "bg-yellow-500/10 border-yellow-500/25 text-yellow-400";
    case "failed":
      return "bg-red-500/10 border-red-500/25 text-red-400";
    default:
      return "bg-gray-800 border-gray-700 text-gray-400";
  }
};

const getTypeClass = (type: string) => {
  switch (type) {
    case "movie":
      return "bg-indigo-500/10 border-indigo-500/25 text-indigo-400";
    case "tv":
      return "bg-purple-500/10 border-purple-500/25 text-purple-400";
    case "season":
      return "bg-teal-500/10 border-teal-500/25 text-teal-400";
    case "episode":
      return "bg-pink-500/10 border-pink-500/25 text-pink-400";
    default:
      return "bg-gray-800 border-gray-700 text-gray-400";
  }
};

const getUserEmail = (userId: string | null | undefined) => {
  if (!userId) return "Anonymous";
  return usersMap.value[userId] || `User (${userId.substring(0, 8)})`;
};

// Pure JS relative time formatter
const formatTime = (timeStr: string) => {
  try {
    const past = new Date(timeStr).getTime();
    const now = Date.now();
    const diffSecs = Math.floor((now - past) / 1000);

    if (diffSecs < 60) return "Just now";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return timeStr;
  }
};

const {
  data: initialData,
  pending,
  error: fetchError,
  refresh: fetchQueueAndUsers,
} = await useAsyncData("admin-queue", async () => {
  const { data: queueData, error: queueErr } =
    await supabase.rpc("get_media_queue_items");
  if (queueErr) throw queueErr;

  const { data: depthData } = await supabase.rpc("get_media_queue_depth");

  const userData = await $fetch<ListUsersResponse>("/api/list_users");
  const map: Record<string, string> = {};
  if (userData?.users) {
    for (const u of userData.users) {
      map[u.id] = u.email;
    }
  }

  return {
    queueItems: queueData ?? [],
    usersMap: map,
    pendingCount: depthData ?? null,
  };
});

watch(
  initialData,
  (newData) => {
    if (newData) {
      queueItems.value = newData.queueItems;
      usersMap.value = newData.usersMap;
      pendingCount.value = newData.pendingCount;
    }
  },
  { immediate: true },
);

watch(
  pending,
  (val) => {
    isLoading.value = val;
  },
  { immediate: true },
);

watch(
  fetchError,
  (err) => {
    if (err) {
      error.value = err.message || "Failed to load queue data.";
      console.error("Error fetching queue or users:", err);
    } else {
      error.value = "";
    }
  },
  { immediate: true },
);

const startProcessing = async () => {
  isProcessing.value = true;
  showToast(t("admin.queue.processingStarted"), "info");
  try {
    await $fetch("/api/process-media-queue", {
      method: "POST",
      body: {},
    });
    showToast(t("admin.queue.processingCompleted"), "success");
  } catch (err: unknown) {
    console.error("Error processing queue:", err);
    showToast(getErrorMessage(err, t("admin.queue.failedToProcess")), "error");
  } finally {
    isProcessing.value = false;
    await fetchQueueAndUsers();
  }
};

const clearQueue = async () => {
  if (
    !confirm(
      "Are you sure you want to completely clear the queue? This will delete all pending and archived items.",
    )
  )
    return;

  isClearing.value = true;
  showToast(t("admin.queue.clearingQueue"), "info");

  try {
    const { error: clearErr } = await supabase.rpc("clear_media_queue");
    if (clearErr) throw clearErr;
    showToast(t("admin.queue.cleared"), "success");
  } catch (err: unknown) {
    console.error("Error clearing queue:", err);
    showToast(getErrorMessage(err, t("admin.queue.failedToClear")), "error");
  } finally {
    isClearing.value = false;
    await fetchQueueAndUsers();
  }
};

const deleteItem = async (id: number) => {
  if (!confirm(t("admin.queue.confirmDelete"))) return;

  deletingId.value = id;
  try {
    const { error: err } = await supabase.rpc("delete_media_queue_item", {
      p_id: id,
    });
    if (err) throw err;
    showToast(t("admin.queue.itemDeleted"), "success");
    await fetchQueueAndUsers();
  } catch (err: unknown) {
    console.error("Error deleting item:", err);
    showToast(getErrorMessage(err, t("admin.queue.failedToDelete")), "error");
  } finally {
    deletingId.value = null;
  }
};

const reEnqueueItem = async (item: QueueItem) => {
  if (!confirm(t("admin.queue.confirmReEnqueue"))) return;

  reEnqueuingId.value = item.id;
  try {
    const { error: enqueueErr } = await supabase.rpc("enqueue_media_fetch", {
      p_tmdb_id: item.tmdb_id,
      p_media_type: item.media_type,
      p_season_number: item.season_number ?? undefined,
      p_episode_number: item.episode_number ?? undefined,
    });
    if (enqueueErr) throw enqueueErr;

    const { error: delErr } = await supabase.rpc("delete_media_queue_item", {
      p_id: item.id,
    });
    if (delErr) console.warn("Failed to delete old archived item:", delErr);

    showToast(t("admin.queue.reEnqueued"), "success");
    await fetchQueueAndUsers();
  } catch (err: unknown) {
    console.error("Error re-enqueuing item:", err);
    showToast(
      getErrorMessage(err, t("admin.queue.failedToReEnqueue")),
      "error",
    );
  } finally {
    reEnqueuingId.value = null;
  }
};
</script>
