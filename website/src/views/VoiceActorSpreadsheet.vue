<template>
  <div class="w-full flex flex-col min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-blue-600 text-white p-4 shadow-sm">
      <div class="flex justify-between items-center">
        <router-link
          to="/"
          class="px-4 py-2 bg-white text-blue-600 rounded-md font-medium text-sm"
        >
          ← Back to Dashboard
        </router-link>
        <h1 class="text-xl font-bold">Voice Actor Spreadsheet</h1>
        <div></div>
        <!-- Spacer for centering -->
      </div>
    </header>

    <main class="flex-1 p-4 space-y-4 overflow-x-hidden">
      <!-- Toolbar with search -->
      <div class="bg-white p-4 rounded-lg shadow-sm">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search voice actors..."
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          @input="handleSearch"
        />
      </div>

      <!-- Loading indicator -->
      <div
        v-if="isLoading"
        class="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm"
      >
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        ></div>
        <p class="ml-2 text-gray-500">Loading voice actors...</p>
      </div>

      <!-- Error message -->
      <div v-else-if="error" class="bg-red-100 p-4 rounded-lg shadow-sm">
        <p class="text-red-700">{{ error }}</p>
        <button
          @click="fetchVoiceActors"
          class="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>

      <!-- Revogrid container -->
      <div v-else class="bg-white p-4 rounded-lg shadow-sm">
        <div class="spreadsheet-container">
          <revogrid
            ref="revoGridRef"
            :source="tableData"
            :columns="revoColumns"
            :theme="'material'"
            height="100%"
            width="100%"
            @celleditapply="handleCellEditApply"
          />
        </div>
      </div>

      <!-- Floating save button -->
      <div class="fixed bottom-6 right-6">
        <button
          @click="handleBulkSave"
          :disabled="pendingChanges.size === 0 || isBulkSaving"
          class="bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <span
            v-if="isBulkSaving"
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
          ></span>
          <span>{{
            isBulkSaving ? "Saving..." : `Save All (${pendingChanges.size})`
          }}</span>
        </button>
      </div>

      <!-- Toast notifications -->
      <div
        v-if="toast.show"
        class="fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm"
        :class="
          toast.type === 'success'
            ? 'bg-green-100 text-green-800'
            : toast.type === 'error'
            ? 'bg-red-100 text-red-800'
            : 'bg-blue-100 text-blue-800'
        "
      >
        <p>{{ toast.message }}</p>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import Revogrid from "@revolist/vue3-datagrid";
import type { Tables } from "../../../supabase/functions/_shared/database.types";
import { supabase } from "@/lib/supabase";

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
let searchTimer: NodeJS.Timeout | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;

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
  type: "success" | "error" | "info" = "info"
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
