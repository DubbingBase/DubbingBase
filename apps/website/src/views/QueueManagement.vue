<template>
  <div class="space-y-6">
    <!-- Header Card -->
    <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-white">Import Queue Management</h3>
        <p class="text-sm text-slate-400">Monitor TMDb media import requests, retry failed jobs, or clean up the queue.</p>
      </div>
      <button
        @click="fetchQueueAndUsers"
        :disabled="isLoading"
        class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
      >
        <span v-if="isLoading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
        <span>Refresh Queue</span>
      </button>
    </div>

    <!-- Error Alert -->
    <div v-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center space-x-3 text-red-200 text-sm">
      <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <!-- Queue Loading State -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <p class="text-slate-400 text-sm">Loading media import queue...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="queueItems.length === 0" class="text-center py-20 bg-slate-900/20 border border-slate-850 rounded-2xl space-y-2">
      <div class="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 mx-auto">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-slate-400 font-semibold">No media fetch requests in queue</p>
      <p class="text-xs text-slate-500">Queue is completely empty.</p>
    </div>

    <!-- Queue Grid / Table -->
    <div v-else class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-sm">
          <thead>
            <tr class="bg-slate-900/50 border-b border-slate-800 text-xs font-semibold text-slate-450 uppercase tracking-wider">
              <th class="py-4 px-6">Media details</th>
              <th class="py-4 px-6">Requested by</th>
              <th class="py-4 px-6">Status</th>
              <th class="py-4 px-6">Errors</th>
              <th class="py-4 px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/50">
            <tr v-for="item in queueItems" :key="item.id" class="hover:bg-slate-800/10 transition-colors">
              <!-- Media details column -->
              <td class="py-4 px-6">
                <div class="flex items-center space-x-2.5">
                  <span
                    class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border"
                    :class="getTypeClass(item.media_type)"
                  >
                    {{ item.media_type }}
                  </span>
                  <span class="text-xs font-semibold text-slate-400">TMDB: {{ item.tmdb_id }}</span>
                </div>
                <div class="mt-1 flex items-center space-x-2">
                  <span v-if="item.season_number !== null" class="text-xs px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded font-bold">
                    Season {{ item.season_number }}
                  </span>
                  <span v-if="item.episode_number !== null" class="text-xs px-2 py-0.5 bg-slate-950 border border-slate-800 text-slate-300 rounded font-bold">
                    Episode {{ item.episode_number }}
                  </span>
                </div>
              </td>

              <!-- Requester column -->
              <td class="py-4 px-6">
                <div class="font-medium text-slate-200 text-sm truncate max-w-xs">{{ getUserEmail(item.user_id) }}</div>
                <div class="text-xs text-slate-500 mt-0.5">{{ formatTime(item.created_at) }}</div>
              </td>

              <!-- Status column -->
              <td class="py-4 px-6">
                <div class="flex items-center space-x-2">
                  <span
                    class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border flex items-center space-x-1.5"
                    :class="getStatusClass(item.status)"
                  >
                    <span v-if="item.status === 'processing'" class="h-2 w-2 rounded-full bg-blue-400 animate-pulse"></span>
                    <span>{{ item.status }}</span>
                  </span>
                </div>
              </td>

              <!-- Errors column -->
              <td class="py-4 px-6">
                <div v-if="item.error_message" class="text-xs text-red-400 max-w-sm line-clamp-2 leading-relaxed bg-red-950/20 border border-red-900/30 rounded-xl p-2.5 font-mono">
                  {{ item.error_message }}
                </div>
                <div v-else class="text-xs text-slate-550 italic">—</div>
              </td>

              <!-- Actions column -->
              <td class="py-4 px-6 text-right">
                <div class="flex items-center justify-end space-x-2">
                  <!-- Retry button -->
                  <button
                    v-if="item.status === 'failed' || item.status === 'pending'"
                    @click="retryFetch(item)"
                    :disabled="retrying[item.id]"
                    class="p-2 bg-blue-950/40 hover:bg-blue-950/60 text-blue-400 border border-blue-900/30 rounded-xl transition-all disabled:opacity-50"
                    title="Retry request"
                  >
                    <svg v-if="retrying[item.id]" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
                    </svg>
                    <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    </svg>
                  </button>

                  <!-- Delete button -->
                  <button
                    @click="deleteRequest(item.id)"
                    :disabled="deleting[item.id]"
                    class="p-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/25 rounded-xl transition-all disabled:opacity-50"
                    title="Delete request"
                  >
                    <svg v-if="deleting[item.id]" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18" />
                    </svg>
                    <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
import { ref, onMounted } from "vue";
import { supabase } from "@/lib/supabase";
import { enqueueAndProcessMedia } from "@/lib/mediaQueue";

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
const error = ref("");

const retrying = ref<Record<number, boolean>>({});
const deleting = ref<Record<number, boolean>>({});

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
    const { data: queueData, error: queueErr } = await supabase.rpc("get_media_queue_items");

    if (queueErr) throw queueErr;
    queueItems.value = queueData || [];

    // 2. Fetch users to map user_id -> email
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (session) {
      const { data: userData, error: userErr } = await supabase.functions.invoke("list_users", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!userErr && userData?.users) {
        const tempMap: Record<string, string> = {};
        userData.users.forEach((u: any) => {
          tempMap[u.id] = u.email;
        });
        usersMap.value = tempMap;
      }
    }
  } catch (err: any) {
    console.error("Error fetching queue or users:", err);
    error.value = err.message || "Failed to load queue data.";
  } finally {
    isLoading.value = false;
  }
};

const deleteRequest = async (id: number) => {
  deleting.value[id] = true;
  try {
    const { error: delErr } = await supabase.rpc("delete_media_queue_item", { p_id: id });

    if (delErr) throw delErr;

    queueItems.value = queueItems.value.filter(item => item.id !== id);
    showToast("Request removed from queue.", "success");
  } catch (err: any) {
    console.error("Error deleting queue request:", err);
    showToast(err.message || "Failed to delete request.", "error");
  } finally {
    deleting.value[id] = false;
  }
};

const retryFetch = async (item: QueueItem) => {
  retrying.value[item.id] = true;
  showToast("Processing media import request...", "info");

  try {
    // Delete the old request first since it is being re-run
    const { error: delErr } = await supabase.rpc("delete_media_queue_item", { p_id: item.id });
    if (delErr) {
      console.warn("Could not delete old queue item, proceeding anyway:", delErr);
    }

    await enqueueAndProcessMedia({
      tmdbId: item.tmdb_id,
      mediaType: item.media_type,
      seasonNumber: item.season_number,
      episodeNumber: item.episode_number,
    });

    showToast("Import completed successfully!", "success");
  } catch (err: any) {
    console.error("Error retrying fetch:", err);
    showToast(err.message || "Failed to import media.", "error");
  } finally {
    retrying.value[item.id] = false;
    await fetchQueueAndUsers();
  }
};

onMounted(fetchQueueAndUsers);
</script>
