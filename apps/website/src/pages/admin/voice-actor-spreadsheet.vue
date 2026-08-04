<template>
  <div class="space-y-6">
    <!-- Toolbar with search -->
    <div class="bg-slate-900 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex-1 max-w-md">
        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Search Directory</label>
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search voice actors..."
            class="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 placeholder-slate-500 text-sm transition-all duration-150"
            @input="handleSearch"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 shrink-0">
        <NuxtLink
          :to="localePath('/admin/voice-actors/new')"
          class="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all duration-150 flex items-center space-x-2 shrink-0 shadow-lg shadow-blue-500/10 border border-blue-500/20"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Voice Actor</span>
        </NuxtLink>
        <div class="flex items-center space-x-2 text-xs text-slate-400 bg-slate-950 border border-slate-800/80 px-4 py-2.5 rounded-xl shrink-0">
          <span class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>Auto-saves changes on edit</span>
        </div>
      </div>
    </div>

    <!-- Loading indicator -->
    <div
      v-if="isLoading"
      class="flex flex-col items-center justify-center py-24 space-y-3 bg-slate-900/40 border border-slate-800/60 rounded-2xl"
    >
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      <p class="text-slate-400 text-sm">Loading voice actors...</p>
    </div>

    <!-- Error message -->
    <div v-else-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center justify-between text-red-200 text-sm">
      <div class="flex items-center space-x-3">
        <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ error }}</span>
      </div>
      <button
        @click="fetchVoiceActors"
        class="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-all"
      >
        Retry
      </button>
    </div>

    <!-- Revogrid container -->
    <div v-else class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
      <div class="spreadsheet-container rounded-xl overflow-hidden border border-slate-800/50">
        <ClientOnly>
          <revogrid
            ref="revoGridRef"
            :source="tableData"
            :columns="revoColumns"
            :theme="'darkMaterial'"
            height="100%"
            width="100%"
            @celleditapply="handleCellEditApply"
          />
        </ClientOnly>
      </div>
    </div>

    <!-- Floating save button -->
    <div class="fixed bottom-8 right-8 z-40">
      <button
        @click="handleBulkSave"
        :disabled="pendingChanges.size === 0 || isBulkSaving"
        class="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] border border-blue-500/20 transition-all duration-150 flex items-center space-x-2.5"
      >
        <span
          v-if="isBulkSaving"
          class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
        ></span>
        <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        <span>{{
          isBulkSaving ? "Saving changes..." : `Save All Changes (${pendingChanges.size})`
        }}</span>
      </button>
    </div>

    <!-- Toast notifications -->
    <div
      v-if="toast.show"
      class="fixed top-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3 transition-all duration-300"
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
const localePath = useLocalePath();




definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import Revogrid from "@revolist/vue3-datagrid";
import type { Tables } from "../../../../packages/database/supabase/functions/_shared/database.types";

// Types
type VoiceActor = Tables<"voice_actors">;
type SaveStatus = "idle" | "saving" | "saved" | "error";
type CellChange = {
  row: number;
  col: number;
  oldValue: any;
  newValue: any;
  prop: string;
};

// Data
const tableData = ref<VoiceActor[]>([]);
const searchQuery = ref("");
const isLoading = ref(false);
const error = ref("");
const revoGridRef = ref<any>(null);

// Save state management
const pendingChanges = ref<Map<string, CellChange>>(new Map());
const saveStatuses = ref<Map<string, SaveStatus>>(new Map());
const isBulkSaving = ref(false);

// Toast state
const toast = ref<{
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
}>({
  show: false,
  message: "",
  type: "info",
});

// Debouncing
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

// Revogrid columns
const revoColumns = computed(() => [
  { prop: "id", name: "ID", size: 80, readonly: true },
  { prop: "firstname", name: "First Name", size: 120 },
  { prop: "lastname", name: "Last Name", size: 120 },
  { prop: "bio", name: "Bio", size: 200 },
  { prop: "nationality", name: "Nationality", size: 120 },
  { prop: "awards", name: "Awards", size: 150 },
  { prop: "years_active", name: "Years Active", size: 120 },
  { prop: "date_of_birth", name: "Date of Birth", size: 120 },
  { prop: "profile_picture", name: "Profile Picture", size: 150 },
  { prop: "social_media_links", name: "Social Media Links", size: 180 },
  { prop: "tmdb_id", name: "TMDB ID", size: 100 },
  { prop: "wikidata_id", name: "Wikidata ID", size: 120 },
]);

// Handle cell edit apply event from Revogrid
function handleCellEditApply(event: any) {
  const { detail } = event;
  const { model, prop, val } = detail;

  // Find the row data
  const rowIndex = tableData.value.findIndex((row) => row.id === model.id);
  if (rowIndex === -1) return;

  const rowData = tableData.value[rowIndex];
  const oldValue = (rowData as any)[prop];

  // Skip if no change
  if (oldValue === val) return;

  // Create change object
  const change: CellChange = {
    row: rowIndex,
    col: revoColumns.value.findIndex((col) => col.prop === prop),
    oldValue,
    newValue: val,
    prop,
  };

  const key = `${rowData.id}-${prop}`;
  pendingChanges.value.set(key, change);

  // Set saving status
  saveStatuses.value.set(key, "saving");

  // Trigger auto-save
  debounceAutoSave();
}

// Data fetching functions
async function fetchVoiceActors() {
  isLoading.value = true;
  error.value = "";

  try {
    const response = await supabase.functions.invoke("list-voice-actors");
    if (response.error) throw response.error;
    tableData.value = response.data.voice_actors || [];
  } catch (err) {
    console.error("Error fetching voice actors:", err);
    error.value = "Failed to load voice actors";
  } finally {
    isLoading.value = false;
  }
}

async function searchVoiceActors(query: string) {
  if (!query.trim()) {
    await fetchVoiceActors();
    return;
  }

  isLoading.value = true;
  error.value = "";

  try {
    const response = await supabase.functions.invoke("search-voice-actors", {
      body: { query, limit: 100 },
    });
    if (response.error) throw response.error;
    tableData.value = response.data || [];
  } catch (err) {
    console.error("Error searching voice actors:", err);
    error.value = "Failed to search voice actors";
  } finally {
    isLoading.value = false;
  }
}

// Handlers
function handleSearch(event: Event) {
  searchQuery.value = (event.target as HTMLInputElement).value || "";
}

function debounceAutoSave() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    savePendingChanges();
  }, 500);
}

async function savePendingChanges() {
  if (pendingChanges.value.size === 0) return;

  const changesToSave = Array.from(pendingChanges.value.entries());

  for (const [key, change] of changesToSave) {
    await saveSingleChange(key, change);
  }
}

async function saveSingleChange(key: string, change: CellChange) {
  const rowData = tableData.value[change.row];
  if (!rowData) return;

  try {
    // Optimistic update
    (rowData as any)[change.prop] = change.newValue;

    const response = await supabase.functions.invoke("update-voice-actor", {
      body: {
        voice_actor_id: rowData.id,
        updates: { [change.prop]: change.newValue },
      },
    });

    if (response.error) throw response.error;

    // Success
    saveStatuses.value.set(key, "saved");
    pendingChanges.value.delete(key);

    // Clear saved status after 2 seconds
    setTimeout(() => {
      saveStatuses.value.delete(key);
    }, 2000);

    showToast("Changes saved successfully", "success");
  } catch (err: any) {
    console.error("Error saving change:", err);

    // Rollback optimistic update
    (rowData as any)[change.prop] = change.oldValue;

    saveStatuses.value.set(key, "error");

    // Clear error status after 5 seconds
    setTimeout(() => {
      saveStatuses.value.delete(key);
    }, 5000);

    showToast(err.message || "Failed to save changes", "error");
  }
}

async function handleBulkSave() {
  if (pendingChanges.value.size === 0) return;

  isBulkSaving.value = true;

  try {
    await savePendingChanges();
    showToast("All changes saved successfully", "success");
  } catch (err) {
    showToast("Some changes failed to save", "error");
  } finally {
    isBulkSaving.value = false;
  }
}

function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
) {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
}

// Watch for search query changes with debouncing
watch(searchQuery, (newQuery) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    searchVoiceActors(newQuery);
  }, 300);
});

onMounted(() => {
  fetchVoiceActors();
});

onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }
});
</script>

<style scoped lang="scss">
.spreadsheet-container {
  height: calc(100vh - 200px);
  overflow: hidden;
}

:deep(.revo-grid) {
  font-size: 14px;
}

// Mobile-first styles
@media (max-width: 768px) {
  .spreadsheet-container {
    height: calc(100vh - 180px);
  }

  :deep(.revo-grid) {
    font-size: 12px;
  }

  :deep(.revo-grid .rgHeaderCell) {
    font-size: 11px;
    padding: 4px;
  }

  :deep(.revo-grid .rgCell) {
    padding: 4px;
  }
}

// No hover states for mobile
@media (hover: none) {
  :deep(.revo-grid .rgCell:hover) {
    background: transparent !important;
  }
}
</style>
