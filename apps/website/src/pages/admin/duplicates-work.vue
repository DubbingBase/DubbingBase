<template>
  <div class="space-y-6">
    <!-- Header Row -->
    <div class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h3 class="text-lg font-bold text-white">{{ $t('admin.duplicates.workTitle') }}</h3>
        <p class="text-sm text-gray-400">{{ $t('admin.duplicates.workDescription') }}</p>
      </div>
      <button
        @click="fetchDuplicates"
        :disabled="loading"
        class="py-2.5 px-5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl shadow-lg transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center shrink-0"
      >
        <span v-if="loading" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
        <span>{{ loading ? $t('admin.duplicates.scanning') : $t('admin.duplicates.scanDuplicates') }}</span>
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
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 space-y-3 bg-gray-900/40 border border-gray-800/60 rounded-2xl">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <p class="text-gray-400 text-sm">{{ $t('admin.duplicates.scanningWork') }}</p>
    </div>

    <!-- Empty State -->
    <div v-else-if="duplicates.length === 0" class="text-center py-20 bg-gray-900/20 border border-gray-850 rounded-2xl space-y-2">
      <div class="h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center text-gray-500 mx-auto">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <p class="text-gray-400 font-semibold">{{ $t('admin.duplicates.noDuplicateWork') }}</p>
      <p class="text-xs text-gray-500">{{ $t('admin.duplicates.allUnique') }}</p>
    </div>

    <!-- Duplicates Group list -->
    <div v-else class="space-y-6">
      <div
        v-for="(group, idx) in duplicates"
        :key="idx"
        class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4 shadow-xl"
      >
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-gray-800/60 pb-3 gap-3">
          <h4 class="text-sm font-bold text-white flex items-center space-x-2">
            <span class="h-5 w-5 rounded-full bg-gray-800 text-gray-300 text-xs font-semibold flex items-center justify-center">
              {{ idx + 1 }}
            </span>
            <span>{{ $t('admin.duplicates.duplicateWorkGroup') }}</span>
          </h4>
          <span class="text-xs text-gray-400 font-mono">
            Shared properties (Project ID: {{ group.works[0]?.dubbing_project_id }} | Actor ID: {{ group.works[0]?.actor_id }})
          </span>
        </div>

        <!-- Table view of entries -->
        <div class="overflow-x-auto border border-gray-850 rounded-xl">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-gray-950/60 border-b border-gray-850 text-gray-450 font-bold uppercase tracking-wider">
                <th class="py-3 px-4">ID</th>
                <th class="py-3 px-4">{{ $t('admin.duplicates.voiceActorId') }}</th>
                <th class="py-3 px-4">{{ $t('admin.duplicates.performance') }}</th>
                <th class="py-3 px-4">{{ $t('common.status') }}</th>
                <th class="py-3 px-4">{{ $t('admin.duplicates.contentType') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-850">
              <tr
                v-for="work in group.works"
                :key="work.id"
                :class="[
                  'hover:bg-gray-800/10 transition-colors',
                  group.selectedId === work.id ? 'bg-red-500/5' : ''
                ]"
              >
                <td class="py-3 px-4 font-mono font-bold text-gray-300">{{ work.id }}</td>
                <td class="py-3 px-4 font-mono text-gray-400">{{ work.voice_actor_id }}</td>
                <td class="py-3 px-4 font-medium text-gray-200">{{ work.performance }}</td>
                <td class="py-3 px-4">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border"
                    :class="
                      work.status === 'approved' || work.status === 'accepted'
                        ? 'bg-green-500/10 border-green-500/25 text-green-400'
                        : work.status === 'waiting'
                        ? 'bg-yellow-500/10 border-yellow-500/25 text-yellow-400'
                        : 'bg-gray-800 border-gray-700 text-gray-400'
                    "
                  >
                    {{ work.status || 'unknown' }}
                  </span>
                </td>
                <td class="py-3 px-4 text-gray-400 font-semibold">{{ work.content_type }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Deletion Tool Control -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-3 bg-gray-950/20 p-4 rounded-xl border border-gray-850">
          <div class="flex-1 min-w-0 flex items-center space-x-3">
            <label class="text-xs font-semibold text-gray-400 uppercase shrink-0">{{ $t('admin.duplicates.deleteEntry') }}:</label>
            <select
              v-model="group.selectedId"
              class="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs w-full"
            >
              <option :value="null">{{ $t('admin.duplicates.selectWorkId') }}</option>
              <option v-for="work in group.works" :key="work.id" :value="work.id">
                ID #{{ work.id }} (Voice Actor: {{ work.voice_actor_id }})
              </option>
            </select>
          </div>

          <button
            @click="deleteWork(group.selectedId, idx)"
            :disabled="!group.selectedId || deleting[idx]"
            class="py-2.5 px-4 bg-red-650 hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl text-xs transition-all duration-150 flex items-center justify-center shrink-0 shadow-lg shadow-red-950/20"
          >
            <span v-if="deleting[idx]" class="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white mr-2"></span>
            <span>{{ deleting[idx] ? $t('admin.duplicates.deleting') : $t('admin.duplicates.deleteSelected') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  </template>

<script setup lang="ts">

const { t } = useI18n();




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref } from "vue";

interface WorkEntry {
  id: number;
  dubbing_project_id: number;
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

    const data = await $fetch('/api/find_duplicate_work');

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
    const data = await $fetch('/api/delete_work_entry', {
      method: 'POST',
      body: { id: workId }
    });

    if (data && data.error) {
      throw new Error(data.error?.message || "Failed to delete work entry.");
    }

    successMsg.value = t('admin.duplicates.workDeleted', { id: workId });

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
