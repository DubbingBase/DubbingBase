<template>
  <div class="space-y-6">
    <!-- Header Row -->
    <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-white">Duplicate Work Entries</h3>
        <p class="text-sm text-slate-400">Scan for duplicate casting associations (movie/series credits linked to voice actors) and delete redundant records.</p>
      </div>
      <button
        @click="fetchDuplicates"
        :disabled="loading"
        class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
      >
        <span v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
        <span>{{ loading ? 'Scanning...' : 'Scan Duplicates' }}</span>
      </button>
    </div>

    <!-- Feedback Banners -->
    <div v-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center space-x-3 text-red-200 text-sm">
      <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <span>{{ error }}</span>
    </div>

    <div v-if="successMsg" class="p-4 bg-green-950/30 border border-green-900/50 rounded-xl flex items-center space-x-3 text-green-200 text-sm">
      <svg class="h-5 w-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{{ successMsg }}</span>
    </div>

    <!-- Scanner Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <p class="text-slate-400 text-sm">Scanning work associations for duplicates...</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="duplicates.length === 0" class="text-center py-20 bg-slate-900/20 border border-slate-850 rounded-2xl space-y-2">
      <div class="h-12 w-12 rounded-full bg-slate-900 flex items-center justify-center text-slate-500 mx-auto">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-slate-400 font-semibold">No duplicate work entries found</p>
      <p class="text-xs text-slate-500">All actor-voice actor mapping entries appear unique.</p>
    </div>

    <!-- Duplicates Group list -->
    <div v-else class="space-y-6">
      <div
        v-for="(group, idx) in duplicates"
        :key="idx"
        class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl"
      >
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/60 pb-3 gap-3">
          <h4 class="text-sm font-bold text-white flex items-center space-x-2">
            <span class="h-5 w-5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center">
              {{ idx + 1 }}
            </span>
            <span>Duplicate Work Group</span>
          </h4>
          <span class="text-xs text-slate-400 font-mono">
            Shared properties (Content ID: {{ group.works[0]?.content_id }} | Actor ID: {{ group.works[0]?.actor_id }})
          </span>
        </div>

        <!-- Table view of entries -->
        <div class="overflow-x-auto border border-slate-850 rounded-xl">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-950/60 border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider">
                <th class="py-3 px-4">ID</th>
                <th class="py-3 px-4">Voice Actor ID</th>
                <th class="py-3 px-4">Performance</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4">Content Type</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-850">
              <tr
                v-for="work in group.works"
                :key="work.id"
                :class="[
                  'hover:bg-slate-800/10 transition-colors',
                  group.selectedId === work.id ? 'bg-red-500/5' : ''
                ]"
              >
                <td class="py-3 px-4 font-mono font-bold text-slate-300">{{ work.id }}</td>
                <td class="py-3 px-4 font-mono text-slate-400">{{ work.voice_actor_id }}</td>
                <td class="py-3 px-4 font-medium text-slate-200">{{ work.performance }}</td>
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border"
                    :class="
                      work.status === 'approved' || work.status === 'accepted'
                        ? 'bg-green-500/10 border-green-500/25 text-green-400'
                        : work.status === 'waiting'
                        ? 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    "
                  >
                    {{ work.status || 'unknown' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-slate-400 font-semibold">{{ work.content_type }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Deletion Tool Control -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 bg-slate-950/20 p-4 rounded-xl border border-slate-850">
          <div class="flex-1 min-w-0 flex items-center space-x-3">
            <label class="text-xs font-semibold text-slate-400 uppercase shrink-0">Delete Entry:</label>
            <select
              v-model="group.selectedId"
              class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs w-full"
            >
              <option :value="null">Select work ID to delete</option>
              <option v-for="work in group.works" :key="work.id" :value="work.id">
                ID #{{ work.id }} (Voice Actor: {{ work.voice_actor_id }})
              </option>
            </select>
          </div>

          <button
            @click="deleteWork(group.selectedId, idx)"
            :disabled="!group.selectedId || deleting[idx]"
            class="py-2.5 px-4 bg-red-650 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold rounded-xl text-xs transition-all duration-150 flex items-center justify-center shrink-0 shadow-lg shadow-red-950/20"
          >
            <span v-if="deleting[idx]" class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-2"></span>
            <span>{{ deleting[idx] ? 'Deleting...' : 'Delete Selected' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { supabase } from "@/lib/supabase";

interface WorkEntry {
  id: number;
  content_id: number;
  actor_id: number;
  voice_actor_id: number;
  status: string | null;
  performance: string | null;
  content_type: string | null;
}

interface DuplicateGroup {
  works: WorkEntry[];
  selectedId: number | null;
}

const duplicates = ref<DuplicateGroup[]>([]);
const loading = ref(false);
const error = ref("");
const successMsg = ref("");
const deleting = ref<Record<number, boolean>>({});

const fetchDuplicates = async () => {
  try {
    loading.value = true;
    error.value = "";
    successMsg.value = "";
    duplicates.value = [];

    const { data, error: funcError } = await supabase.functions.invoke("find_duplicate_work", {
      method: "GET"
    });

    if (funcError) throw funcError;

    duplicates.value = (data || []).map((group: any) => ({
      works: group.works || [],
      selectedId: null
    }));
  } catch (err: any) {
    console.error("Error fetching duplicate work entries:", err);
    error.value = err.message || "Failed to fetch duplicate work entries.";
  } finally {
    loading.value = false;
  }
};

const deleteWork = async (workId: number | null, groupIdx: number) => {
  if (!workId) return;

  deleting.value[groupIdx] = true;
  error.value = "";
  successMsg.value = "";

  try {
    const { data, error: delErr } = await supabase.functions.invoke("delete_work_entry", {
      body: { id: workId }
    });

    if (delErr || (data && data.error)) {
      throw new Error((delErr?.message || data?.error?.message) || "Failed to delete work entry.");
    }

    successMsg.value = `Successfully deleted work entry #${workId}`;

    // Remove row locally
    const group = duplicates.value[groupIdx];
    group.works = group.works.filter(w => w.id !== workId);
    group.selectedId = null;

    // If less than 2 items left, discard the group
    if (group.works.length < 2) {
      duplicates.value.splice(groupIdx, 1);
    }
  } catch (err: any) {
    console.error("Error deleting work entry:", err);
    error.value = err.message || "Failed to delete work entry.";
  } finally {
    deleting.value[groupIdx] = false;
  }
};

// Auto scan on load
fetchDuplicates();
</script>
