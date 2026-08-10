<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div
      class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <h3 class="text-lg font-bold text-white">Import Queue Management</h3>
        <p class="text-sm text-slate-400">
          Monitor TMDb media import requests, retry failed jobs, or clean up the
          queue.
        </p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          v-if="isDev"
          @click="clearQueue"
          :disabled="isClearing || isLoading"
          class="py-2.5 px-5 bg-red-600 hover:bg-red-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isClearing"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>Clear Queue</span>
        </button>
        <button
          @click="startProcessing"
          :disabled="isProcessing || isLoading"
          class="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isProcessing"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>Start Processing</span>
        </button>
        <button
          @click="fetchQueueAndUsers"
          :disabled="isLoading"
          class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
        >
          <span
            v-if="isLoading"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></span>
          <span>Refresh Queue</span>
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
      class="flex flex-col items-center justify-center py-24 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl"
    >
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"
      ></div>
      <p class="text-slate-400 text-sm">Loading media import queue...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="queueItems.length === 0"
      class="text-center py-20 bg-slate-900/20 border border-slate-850 rounded-2xl space-y-2"
    >
      <div
        class="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 mx-auto"
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
      <p class="text-slate-400 font-semibold">
        No media fetch requests in queue
      </p>
      <p class="text-xs text-slate-500">Queue is completely empty.</p>
    </div>

    <!-- Queue Grid / Table -->
    <div
      v-else
      class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
    >
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr
              class="bg-slate-900/50 border-b border-slate-800 text-xs font-semibold text-slate-450 uppercase tracking-wider"
            >
              <th class="py-4 px-6">Media details</th>
              <th class="py-4 px-6">Requested by</th>
              <th class="py-4 px-6">Status</th>
              <th class="py-4 px-6">Errors</th>
              <th class="py-4 px-6 w-16 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/50">
            <tr
              v-for="item in queueItems"
              :key="item.id"
              class="hover:bg-slate-800/10 transition-colors"
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
                      title="Voir sur TMDB"
                    >
                      <span>TMDB: {{ item.tmdb_id }}</span>
                      <svg class="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                    <a
                      :href="`https://hub.toolforge.org/${item.media_type === 'tv' || item.media_type === 'season' || item.media_type === 'episode' ? 'P4983' : 'P4947'}:${item.tmdb_id}?lang=fr`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs font-semibold text-slate-400 hover:text-slate-300 hover:underline flex items-center"
                      title="Voir sur Wikipédia FR (redirection via Wikidata)"
                    >
                      <span>Wikipédia</span>
                      <svg class="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                  </div>
                </div>
                <div class="mt-1 flex items-center space-x-2">
                  <span
                    v-if="item.season_number !== null"
                    class="text-xs px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded font-bold"
                  >
                    Season {{ item.season_number }}
                  </span>
                  <span
                    v-if="item.episode_number !== null"
                    class="text-xs px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded font-bold"
                  >
                    Episode {{ item.episode_number }}
                  </span>
                </div>
              </td>

              <!-- Requester column -->
              <td class="py-4 px-6">
                <div
                  class="font-medium text-slate-200 text-sm truncate max-w-xs"
                >
                  {{ getUserEmail(item.user_id) }}
                </div>
                <div class="text-xs text-slate-500 mt-0.5">
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
                <div v-else class="text-xs text-slate-550 italic">—</div>
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
                    title="Re-enqueue item"
                    class="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
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
                    title="Delete item"
                    class="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
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

import { ref, onMounted } from "vue";

interface QueueItem {
  id: number;
  tmdb_id: number;
  media_type: "movie" | "tv" | "season" | "episode";
  season_number: number | null;
  episode_number: number | null;
  status: "pending" | "processing" | "completed" | "failed";
  error_message: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

const queueItems = ref<QueueItem[]>([]);
const usersMap = ref<Record<string, string>>({});
const isLoading = ref(true);
const isProcessing = ref(false);
const isClearing = ref(false);
const deletingId = ref<number | null>(null);
const reEnqueuingId = ref<number | null>(null);
const error = ref("");
const isDev = import.meta.env.DEV;

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
      return "bg-slate-800 border-slate-700 text-slate-400";
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
      return "bg-slate-800 border-slate-700 text-slate-400";
  }
};

const getUserEmail = (userId: string | null) => {
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

const fetchQueueAndUsers = async () => {
  try {
    isLoading.value = true;
    error.value = "";

    // 1. Fetch queue items via RPC
    const { data: queueData, error: queueErr } = await supabase.rpc(
      "get_media_queue_items",
    );

    if (queueErr) throw queueErr;
    queueItems.value = queueData || [];

    // 2. Fetch users to map user_id -> email
    const { data: userData, error: userErr } =
      await supabase.functions.invoke("list_users", { method: 'GET' });
    if (!userErr && userData?.users) {
      const tempMap: Record<string, string> = {};
      userData.users.forEach((u: any) => {
        tempMap[u.id] = u.email;
      });
      usersMap.value = tempMap;
    }
  } catch (err: any) {
    console.error("Error fetching queue or users:", err);
    error.value = err.message || "Failed to load queue data.";
  } finally {
    isLoading.value = false;
  }
};



const startProcessing = async () => {
  isProcessing.value = true;
  showToast("Processing started...", "info");
  try {
    const { error: processErr } = await supabase.functions.invoke(
      "process-media-queue",
      {
        body: {},
      }
    );
    if (processErr) throw processErr;
    showToast("Processing completed successfully!", "success");
  } catch (err: any) {
    console.error("Error processing queue:", err);
    showToast(err.message || "Failed to process queue.", "error");
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
  showToast("Clearing queue...", "info");

  try {
    const { error: clearErr } = await supabase.rpc("clear_media_queue");
    if (clearErr) throw clearErr;
    showToast("Queue cleared successfully!", "success");
  } catch (err: any) {
    console.error("Error clearing queue:", err);
    showToast(err.message || "Failed to clear queue.", "error");
  } finally {
    isClearing.value = false;
    await fetchQueueAndUsers();
  }
};

const deleteItem = async (id: number) => {
  if (!confirm("Are you sure you want to delete this item?")) return;

  deletingId.value = id;
  try {
    const { error: err } = await supabase.rpc("delete_media_queue_item", {
      p_id: id,
    });
    if (err) throw err;
    showToast("Item deleted successfully", "success");
    await fetchQueueAndUsers();
  } catch (err: any) {
    console.error("Error deleting item:", err);
    showToast(err.message || "Failed to delete item", "error");
  } finally {
    deletingId.value = null;
  }
};

const reEnqueueItem = async (item: QueueItem) => {
  if (
    !confirm(
      "Are you sure you want to re-enqueue this item? This will add it back to the active queue and delete the archived record.",
    )
  )
    return;

  reEnqueuingId.value = item.id;
  try {
    const { error: enqueueErr } = await supabase.rpc("enqueue_media_fetch", {
      p_tmdb_id: item.tmdb_id,
      p_media_type: item.media_type,
      p_season_number: item.season_number,
      p_episode_number: item.episode_number,
    });
    if (enqueueErr) throw enqueueErr;

    const { error: delErr } = await supabase.rpc("delete_media_queue_item", {
      p_id: item.id,
    });
    if (delErr) console.warn("Failed to delete old archived item:", delErr);

    showToast("Item re-enqueued successfully", "success");
    await fetchQueueAndUsers();
  } catch (err: any) {
    console.error("Error re-enqueuing item:", err);
    showToast(err.message || "Failed to re-enqueue item", "error");
  } finally {
    reEnqueuingId.value = null;
  }
};

onMounted(fetchQueueAndUsers);
</script>
