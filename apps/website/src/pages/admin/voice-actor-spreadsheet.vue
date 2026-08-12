<template>
  <div class="flex flex-col h-full min-h-screen space-y-4 md:space-y-6 pb-24">
    <!-- Toolbar with search -->
    <div class="shrink-0 bg-gray-900 p-6 rounded-2xl border border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex-1 max-w-md">
        <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Search Directory</label>
        <div class="relative">
          <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            v-model="searchInput"
            type="text"
            placeholder="Search voice actors..."
            class="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 placeholder-gray-500 text-sm transition-all duration-150"
            @input="handleSearchInput"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 shrink-0">
        <NuxtLink
          :to="localePath('/voice-actor/new')"
          class="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all duration-150 flex items-center space-x-2 shrink-0 shadow-lg shadow-blue-500/10 border border-blue-500/20"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Voice Actor</span>
        </NuxtLink>
        <div class="flex items-center space-x-2 text-xs text-gray-400 bg-gray-950 border border-gray-800/80 px-4 py-2.5 rounded-xl shrink-0">
          <span class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>Auto-saves changes</span>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <div v-if="error" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl flex items-center justify-between text-red-200 text-sm">
      <div class="flex items-center space-x-3">
        <svg class="h-5 w-5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ error }}</span>
      </div>
      <button
        @click="refresh"
        class="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-all"
      >
        Retry
      </button>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between bg-gray-900 p-4 rounded-xl border border-gray-800">
      <div class="text-sm text-gray-400">
        Showing <span class="font-bold text-white">{{ (page - 1) * limit + 1 }}</span> to <span class="font-bold text-white">{{ Math.min(page * limit, total) }}</span> of <span class="font-bold text-white">{{ total }}</span> results
      </div>
      <div class="flex items-center space-x-2">
        <button
          @click="page > 1 ? page-- : null"
          :disabled="page === 1 || pending"
          class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
        >
          Previous
        </button>
        <span class="text-gray-400 text-sm px-2">Page {{ page }} of {{ Math.ceil(total / limit) || 1 }}</span>
        <button
          @click="page < Math.ceil(total / limit) ? page++ : null"
          :disabled="page >= Math.ceil(total / limit) || pending"
          class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-x-auto relative">
      <div v-if="pending" class="absolute inset-0 bg-gray-900/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
      </div>
      <table class="w-full text-left border-collapse text-sm whitespace-nowrap">
        <thead>
          <tr class="border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-900/40">
            <th class="py-3 px-4">Actions</th>
            <th class="py-3 px-4">ID</th>
            <th class="py-3 px-4">First Name</th>
            <th class="py-3 px-4">Last Name</th>
            <th class="py-3 px-4">Bio</th>
            <th class="py-3 px-4">Nationality</th>
            <th class="py-3 px-4">Date of Birth</th>
            <th class="py-3 px-4">Profile Pic</th>
            <th class="py-3 px-4">Socials</th>
            <th class="py-3 px-4">TMDB ID</th>
            <th class="py-3 px-4">Wikidata ID</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-800/60">
          <tr v-for="actor in tableData" :key="actor.id" class="hover:bg-gray-800/20 transition-colors">
            <td class="py-2 px-4">
              <NuxtLink :to="localePath(`/voice-actor/${actor.id}/edit`)" class="text-blue-500 hover:text-blue-400 underline text-xs font-bold">Edit</NuxtLink>
            </td>
            <td class="py-2 px-4 text-gray-500">{{ actor.id }}</td>
            <td class="py-2 px-2"><input v-model="actor.firstname" @change="handleCellEdit(actor, 'firstname')" class="w-28 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
            <td class="py-2 px-2"><input v-model="actor.lastname" @change="handleCellEdit(actor, 'lastname')" class="w-28 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
            <td class="py-2 px-2"><input v-model="actor.bio" @change="handleCellEdit(actor, 'bio')" class="w-40 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
            <td class="py-2 px-2"><input v-model="actor.nationality" @change="handleCellEdit(actor, 'nationality')" class="w-24 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
            <td class="py-2 px-2"><input v-model="actor.date_of_birth" type="date" @change="handleCellEdit(actor, 'date_of_birth')" class="w-36 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors [color-scheme:dark]" /></td>
            <td class="py-2 px-2"><input v-model="actor.profile_picture" @change="handleCellEdit(actor, 'profile_picture')" class="w-32 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
            <td class="py-2 px-2"><input v-model="actor.social_media_links" @change="handleCellEdit(actor, 'social_media_links')" class="w-32 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
            <td class="py-2 px-2"><input v-model="actor.tmdb_id" @change="handleCellEdit(actor, 'tmdb_id')" class="w-24 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
            <td class="py-2 px-2"><input v-model="actor.wikidata_id" @change="handleCellEdit(actor, 'wikidata_id')" class="w-28 bg-gray-950 border border-transparent hover:border-gray-700 focus:border-blue-500 rounded px-2 py-1 text-white transition-colors" /></td>
          </tr>
          <tr v-if="tableData.length === 0">
            <td colspan="11" class="py-12 text-center text-gray-500">No voice actors found.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Floating save button -->
    <div class="fixed bottom-8 right-8 z-40">
      <button
        @click="handleBulkSave"
        :disabled="pendingChanges.size === 0 || isBulkSaving"
        class="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] border border-blue-500/20 transition-all duration-150 flex items-center space-x-2.5"
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
          : 'bg-gray-900 border-gray-800 text-gray-200'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import type { Tables } from "../../../../packages/database/supabase/functions/_shared/database.types";

const supabase = useSupabaseClient();
const localePath = useLocalePath();

definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

type VoiceActor = Tables<"voice_actors">;
type CellChange = { id: number; prop: string; newValue: any };

const page = ref(1);
const limit = ref(50);
const searchQuery = ref("");
const searchInput = ref("");
const tableData = ref<VoiceActor[]>([]);
const total = ref(0);

// Debouncing for search
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

// SSR Data Fetching using useAsyncData
const { data, pending, error, refresh } = await useAsyncData(
  `voice-actors-spreadsheet-${page.value}-${searchQuery.value}`,
  async () => {
    const response = await supabase.functions.invoke("list-voice-actors", {
      method: "POST",
      body: {
        limit: limit.value,
        offset: (page.value - 1) * limit.value,
        query: searchQuery.value,
      },
    });

    if (response.error) throw response.error;
    return response.data;
  },
  {
    watch: [page, searchQuery],
  }
);

// Watch data to update local refs
watch(data, (newData) => {
  if (newData) {
    // Clone data so we can mutate it locally for inputs
    tableData.value = JSON.parse(JSON.stringify(newData.voice_actors || []));
    total.value = newData.total || 0;
  }
}, { immediate: true });

function handleSearchInput(event: Event) {
  const val = (event.target as HTMLInputElement).value || "";
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery.value = val;
    page.value = 1; // reset page on search
  }, 400);
}

// Save state management
const pendingChanges = ref<Map<string, CellChange>>(new Map());
const isBulkSaving = ref(false);

const toast = ref<{ show: boolean; message: string; type: "success" | "error" | "info" }>({
  show: false,
  message: "",
  type: "info",
});

function showToast(message: string, type: "success" | "error" | "info" = "info") {
  toast.value = { show: true, message, type };
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
}

function handleCellEdit(actor: VoiceActor, prop: string) {
  const key = `${actor.id}-${prop}`;
  const val = (actor as any)[prop];
  
  pendingChanges.value.set(key, {
    id: actor.id,
    prop,
    newValue: val,
  });

  debounceAutoSave();
}

function debounceAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    savePendingChanges();
  }, 1000);
}

async function savePendingChanges() {
  if (pendingChanges.value.size === 0) return;

  const changesToSave = Array.from(pendingChanges.value.entries());
  for (const [key, change] of changesToSave) {
    await saveSingleChange(key, change);
  }
}

async function saveSingleChange(key: string, change: CellChange) {
  try {
    const response = await supabase.functions.invoke("update-voice-actor", {
      body: {
        voice_actor_id: change.id,
        updates: { [change.prop]: change.newValue },
      },
    });

    if (response.error) throw response.error;
    pendingChanges.value.delete(key);
  } catch (err: any) {
    console.error("Error saving change:", err);
    showToast(`Failed to save ${change.prop}`, "error");
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

onUnmounted(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
});
</script>
