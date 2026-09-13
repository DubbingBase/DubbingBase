<template>
  <div class="flex flex-col h-full min-h-screen space-y-4 md:space-y-6 pb-24">
    <!-- Toolbar with search -->
    <div
      class="shrink-0 theme-surface-overlay p-6 rounded-2xl border theme-border flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div class="flex-1 max-w-md">
        <label
          class="block text-xs font-semibold theme-text-muted uppercase tracking-wider mb-2"
          >{{ $t("admin.spreadsheet.searchDirectory") }}</label
        >
        <div class="relative">
          <span
            class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none theme-text-muted"
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <input
            v-model="searchInput"
            type="text"
            placeholder="Search voice actors..."
            class="w-full pl-10 pr-4 py-2.5 theme-input border theme-border theme-text rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] focus:border-[var(--app-color-focus)] theme-placeholder text-sm transition-all duration-150"
            @input="handleSearchInput"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3 shrink-0">
        <NuxtLink
          :to="localePath('/voice-actor/new')"
          class="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl text-sm transition-all duration-150 flex items-center space-x-2 shrink-0 shadow-lg shadow-blue-500/10 border border-[var(--app-color-info-border)]"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span>{{ $t("admin.spreadsheet.addVoiceActor") }}</span>
        </NuxtLink>
        <div
          class="flex items-center space-x-2 text-xs theme-text-muted theme-input border theme-border px-4 py-2.5 rounded-xl shrink-0"
        >
          <span class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
          <span>{{ $t("admin.spreadsheet.autoSaves") }}</span>
        </div>
      </div>
    </div>

    <!-- Error message -->
    <div
      v-if="error"
      class="p-4 theme-status-danger border border-[var(--app-color-danger-border)] rounded-xl flex items-center justify-between theme-status-danger-text text-sm"
    >
      <div class="flex items-center space-x-3">
        <svg
          class="h-5 w-5 theme-status-danger-text shrink-0"
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
      <button
        @click="() => refresh()"
        class="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold transition-all"
      >
        {{ $t("common.retry") }}
      </button>
    </div>

    <!-- Pagination -->
    <div
      class="flex items-center justify-between theme-surface-overlay p-4 rounded-xl border theme-border"
    >
      <div class="text-sm theme-text-muted">
        {{ $t("admin.spreadsheet.showing")
        }}<span class="font-bold theme-text">{{ (page - 1) * limit + 1 }}</span
        >{{ $t("common.to")
        }}<span class="font-bold theme-text">{{
          Math.min(page * limit, total)
        }}</span
        >{{ $t("common.of")
        }}<span class="font-bold theme-text">{{ total }}</span
        >{{ $t("admin.spreadsheet.results") }}
      </div>
      <div class="flex items-center space-x-2">
        <button
          @click="page > 1 ? page-- : null"
          :disabled="page === 1 || pending"
          class="px-3 py-1.5 theme-surface-muted theme-hover-surface-muted disabled:opacity-50 theme-text rounded-lg text-sm transition-colors"
        >
          {{ $t("admin.spreadsheet.previous") }}
        </button>
        <span class="theme-text-muted text-sm px-2">{{
          $t("admin.spreadsheet.pageOf", {
            page: page,
            total: Math.ceil(total / limit) || 1,
          })
        }}</span>
        <button
          @click="page < Math.ceil(total / limit) ? page++ : null"
          :disabled="page >= Math.ceil(total / limit) || pending"
          class="px-3 py-1.5 theme-surface-muted theme-hover-surface-muted disabled:opacity-50 theme-text rounded-lg text-sm transition-colors"
        >
          {{ $t("admin.spreadsheet.next") }}
        </button>
      </div>
    </div>

    <!-- Table -->
    <div
      class="theme-surface-overlay border theme-border rounded-2xl overflow-x-auto relative"
    >
      <div
        v-if="pending"
        class="absolute inset-0 theme-surface-overlay backdrop-blur-sm z-10 flex flex-col items-center justify-center"
      >
        <div
          class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"
        ></div>
      </div>
      <table class="w-full text-left border-collapse text-sm whitespace-nowrap">
        <thead>
          <tr
            class="border-b theme-border text-xs font-semibold theme-text-muted uppercase tracking-wider theme-surface-overlay"
          >
            <th class="py-3 px-4">{{ $t("common.actions") }}</th>
            <th class="py-3 px-4">{{ $t("common.id") }}</th>
            <th class="py-3 px-4">{{ $t("admin.spreadsheet.firstName") }}</th>
            <th class="py-3 px-4">{{ $t("admin.spreadsheet.lastName") }}</th>
            <th class="py-3 px-4">{{ $t("admin.duplicates.bio") }}</th>
            <th class="py-3 px-4">{{ $t("profile.nationality") }}</th>
            <th class="py-3 px-4">{{ $t("voiceActorEdit.dateOfBirth") }}</th>
            <th class="py-3 px-4">{{ $t("admin.spreadsheet.profilePic") }}</th>
            <th class="py-3 px-4">{{ $t("admin.spreadsheet.socials") }}</th>
            <th class="py-3 px-4">{{ $t("voiceActorEdit.tmdbId") }}</th>
            <th class="py-3 px-4">{{ $t("voiceActorEdit.wikidataId") }}</th>
          </tr>
        </thead>
        <tbody class="divide-y theme-divide">
          <tr
            v-for="actor in tableData"
            :key="actor.id"
            class="theme-hover-surface-muted transition-colors"
          >
            <td class="py-2 px-4">
              <NuxtLink
                :to="localePath(`/voice-actor/${actor.id}/edit`)"
                class="text-blue-500 hover:text-[var(--app-color-info-text)] underline text-xs font-bold"
                >{{ $t("common.edit") }}</NuxtLink
              >
            </td>
            <td class="py-2 px-4 theme-text-muted">{{ actor.id }}</td>
            <td class="py-2 px-2">
              <input
                v-model="actor.firstname"
                @change="handleCellEdit(actor, 'firstname')"
                class="w-28 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.lastname"
                @change="handleCellEdit(actor, 'lastname')"
                class="w-28 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.bio"
                @change="handleCellEdit(actor, 'bio')"
                class="w-40 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.nationality"
                @change="handleCellEdit(actor, 'nationality')"
                class="w-24 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.date_of_birth"
                type="date"
                @change="handleCellEdit(actor, 'date_of_birth')"
                class="w-36 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.profile_picture"
                @change="handleCellEdit(actor, 'profile_picture')"
                class="w-32 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.social_media_links"
                @change="handleCellEdit(actor, 'social_media_links')"
                class="w-32 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.tmdb_id"
                @change="handleCellEdit(actor, 'tmdb_id')"
                class="w-24 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
            <td class="py-2 px-2">
              <input
                v-model="actor.wikidata_id"
                @change="handleCellEdit(actor, 'wikidata_id')"
                class="w-28 theme-input border border-transparent theme-hover-border focus:border-[var(--app-color-focus)] rounded px-2 py-1 theme-text transition-colors"
              />
            </td>
          </tr>
          <tr v-if="tableData.length === 0">
            <td colspan="11" class="py-12 text-center theme-text-muted">
              {{ $t("admin.spreadsheet.noVoiceActorsFound") }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Floating save button -->
    <div class="fixed bottom-8 right-8 z-40">
      <button
        @click="handleBulkSave"
        :disabled="pendingChanges.size === 0 || isBulkSaving"
        class="bg-blue-600 hover:bg-blue-500 disabled:bg-[var(--app-color-surface-muted)] disabled:text-[var(--app-color-text-muted)] disabled:border-[var(--app-color-border)] disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] border border-[var(--app-color-info-border)] transition-all duration-150 flex items-center space-x-2.5"
      >
        <span
          v-if="isBulkSaving"
          class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"
        ></span>
        <svg
          v-else
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
          />
        </svg>
        <span>{{
          isBulkSaving
            ? "Saving changes..."
            : `Save All Changes (${pendingChanges.size})`
        }}</span>
      </button>
    </div>

    <!-- Toast notifications -->
    <div
      v-if="toast.show"
      class="fixed top-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex items-center space-x-3 transition-all duration-300"
      :class="
        toast.type === 'success'
          ? 'theme-status-success border-[var(--app-color-success-border)] theme-status-success-text'
          : toast.type === 'error'
            ? 'theme-status-danger border-[var(--app-color-danger-border)] theme-status-danger-text'
            : 'theme-surface-overlay theme-border theme-text'
      "
    >
      <span>{{ toast.message }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from "vue";
import type { Database } from "@app/supabase";

const supabase = useSupabaseClient();
const localePath = useLocalePath();

definePageMeta({
  layout: "admin",
  middleware: "admin",
});

type VoiceActor = any;
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
    return await $fetch<{ voice_actors: VoiceActor[]; total: number }>(
      "/api/list-voice-actors",
      {
        params: {
          limit: limit.value,
          offset: (page.value - 1) * limit.value,
          query: searchQuery.value,
        },
      },
    );
  },
  {
    watch: [page, searchQuery],
  },
);

// Watch data to update local refs
watch(
  data,
  (newData) => {
    if (newData) {
      // Clone data so we can mutate it locally for inputs
      tableData.value = JSON.parse(JSON.stringify(newData.voice_actors || []));
      total.value = newData.total || 0;
    }
  },
  { immediate: true },
);

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

const toast = ref<{
  show: boolean;
  message: string;
  type: "success" | "error" | "info";
}>({
  show: false,
  message: "",
  type: "info",
});

function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
) {
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
    await $fetch("/api/update-voice-actor", {
      method: "POST",
      body: {
        voice_actor_id: change.id,
        updates: { [change.prop]: change.newValue },
      },
    });

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
