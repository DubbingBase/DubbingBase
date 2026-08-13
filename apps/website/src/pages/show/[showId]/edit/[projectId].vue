<template>
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div class="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex justify-between items-center shadow-xl">
      <div>
        <h3 class="text-xl font-bold text-white flex items-center gap-2">
          <TvIcon class="w-6 h-6 text-cyan-400" />
          {{ isEditMode ? 'Edit Show Dubbing Project' : 'Create Show Dubbing Project' }}
        </h3>
        <p class="text-sm text-gray-400 mt-1">
          {{ isEditMode ? `Updating dubbing project ID #${projectIdParam}` : 'Fill in TMDB information, technical crew, and cast.' }}
        </p>
      </div>
      <NuxtLink
        :to="tmdbShowId ? localePath(`/show/${tmdbShowId}`) : localePath('/')"
        class="text-xs font-semibold px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-gray-700 transition-colors flex items-center space-x-2"
      >
        <span>{{ tmdbShowId ? '← Back to Show' : '← Back Home' }}</span>
      </NuxtLink>
    </div>

    <!-- Navigation Tabs -->
    <div v-if="tmdbShowId" class="flex flex-wrap gap-2 pb-2 border-b border-gray-800">
      <NuxtLink
        v-for="project in showDubbingProjects"
        :key="project.id"
        :to="localePath(`/show/${tmdbShowId}/edit/${project.id}`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
        :class="project.id === Number(projectIdParam) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-900 text-gray-300 border-gray-800 hover:bg-gray-800'"
      >
        {{ getDisplayLanguage(project.language) }}
        <span v-if="project.studios?.name" class="opacity-75 text-xs ml-1">({{ project.studios.name }})</span>
      </NuxtLink>
      <NuxtLink
        :to="localePath(`/show/${tmdbShowId}/edit/new`)"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-dashed"
        :class="projectIdParam === 'new' ? 'bg-cyan-900/50 text-cyan-400 border-cyan-800' : 'bg-gray-900 text-gray-400 border-gray-700 hover:bg-gray-800 hover:text-gray-300'"
      >
        + Add Language
      </NuxtLink>
    </div>

    <!-- Main Workspace -->
    <!-- Loading overlay -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4 text-gray-400">
      <Loader2Icon class="w-8 h-8 animate-spin text-cyan-400" />
      <span class="text-sm">Loading project data...</span>
    </div>

    <form v-else @submit.prevent="saveShowProject" class="space-y-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Media Metadata Card (Left Column) -->
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5 h-fit shadow-xl">
          <h4 class="text-sm font-bold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-3 flex items-center justify-between">
            <span>Media Info</span>
            <span class="text-xs text-cyan-400 font-normal">TMDB Linked</span>
          </h4>

          <!-- Poster Preview -->
          <div class="flex justify-center">
            <div class="relative h-48 w-32 rounded-xl overflow-hidden border border-gray-800 bg-gray-950 flex items-center justify-center text-gray-500 shadow-md">
              <NuxtImg format="webp" v-if="posterUrl"
                :src="posterUrl"
                class="h-full w-full object-cover"
                alt="Poster"
              />
              <div v-else class="text-center p-3 text-gray-600">
                <ImageIcon class="h-10 w-10 mx-auto mb-1 opacity-50" />
                <span class="text-[10px]">No poster</span>
              </div>
            </div>
          </div>

          <!-- Content ID / TMDB ID -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">TMDB Show ID *</label>
            <div class="flex space-x-2">
              <input
                v-model.number="contentId"
                type="number"
                required
                :disabled="!!tmdbShowId"
                placeholder="e.g. 1020"
                class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                @click="fetchTmdbMetadata"
                :disabled="isFetchingTmdb || !contentId"
                class="px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-200 text-xs font-semibold rounded-xl border border-gray-700 whitespace-nowrap"
              >
                <Loader2Icon v-if="isFetchingTmdb" class="w-4 h-4 animate-spin" />
                <span v-else>Fetch</span>
              </button>
            </div>
          </div>

          <!-- Media Name / Title -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Media Title *</label>
            <input
              v-model="mediaTitle"
              type="text"
              required
              readonly
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm opacity-50 cursor-not-allowed"
            />
          </div>

          <!-- Language -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dubbing Language *</label>
            <LanguageSelect v-model="language" required />
          </div>

          <!-- Status -->
          <div class="space-y-1">
            <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</label>
            <select
              v-model="status"
              class="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
            >
              <option value="validated">Validated</option>
              <option value="pending">Pending Review</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <!-- Technical Crew Form (Right 2 Columns) -->
        <div class="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
          <h4 class="text-sm font-bold text-gray-200 uppercase tracking-wider border-b border-gray-800 pb-3 flex items-center justify-between">
            <span>Technical Dubbing Team</span>
            <span class="text-xs text-gray-400">Crew Attributes</span>
          </h4>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Studio -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Dubbing Studio</label>
              <AsyncAutocomplete
                v-model="selectedStudioId"
                :options="studioOptions"
                :loading="isSearchingStudios"
                placeholder="Search studio..."
                :allow-create="true"
                :display-fn="getStudioName"
                @search="searchStudios"
                @create="(q) => openCreateStudioDialog(q, (id) => selectedStudioId = id)"
              />
            </div>

            <!-- Artistic Director -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Artistic Director (D.A.)</label>
              <AsyncAutocomplete
                v-model="artisticDirectorId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q) => openCreateVaDialog(q, (id) => artisticDirectorId = id)"
              />
            </div>

            <!-- Adaptation -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Adaptation / Dialogueur</label>
              <AsyncAutocomplete
                v-model="adaptationId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q) => openCreateVaDialog(q, (id) => adaptationId = id)"
              />
            </div>

            <!-- Recording -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sound Recording (Enregistrement)</label>
              <AsyncAutocomplete
                v-model="recordingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q) => openCreateVaDialog(q, (id) => recordingId = id)"
              />
            </div>

            <!-- Editing -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Sound Editing (Montage)</label>
              <AsyncAutocomplete
                v-model="editingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q) => openCreateVaDialog(q, (id) => editingId = id)"
              />
            </div>

            <!-- Mixing -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Mixing (Mixage)</label>
              <AsyncAutocomplete
                v-model="mixingId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q) => openCreateVaDialog(q, (id) => mixingId = id)"
              />
            </div>

            <!-- Project Manager -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project Manager</label>
              <AsyncAutocomplete
                v-model="projectManagerId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q) => openCreateVaDialog(q, (id) => projectManagerId = id)"
              />
            </div>
            
            <!-- Creative Supervision -->
            <div class="space-y-1">
              <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Creative Supervision</label>
              <AsyncAutocomplete
                v-model="creativeSupervisionId"
                :options="voiceActorOptions"
                :loading="isSearchingVoiceActors"
                placeholder="Search Voice Actor..."
                :allow-create="true"
                :display-fn="getVoiceActorName"
                @search="searchVoiceActors"
                @create="(q) => openCreateVaDialog(q, (id) => creativeSupervisionId = id)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Cast / Voice Actors List -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6 shadow-xl">
        <div class="flex justify-between items-center border-b border-gray-800 pb-3">
          <h4 class="text-sm font-bold text-gray-200 uppercase tracking-wider">Voice Cast</h4>
          <button
            type="button"
            @click="addCastRow"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl flex items-center transition-colors"
          >
            + Add Voice Actor
          </button>
        </div>

        <div class="space-y-4">
          <div v-for="(row, index) in castRows" :key="index" class="p-4 bg-gray-950 border border-gray-800 rounded-xl relative group">
            <button
              type="button"
              @click="removeCastRow(index)"
              class="absolute -top-3 -right-3 bg-red-900/80 hover:bg-red-800 text-red-200 border border-red-800 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100 shadow-lg z-10"
              title="Remove row"
            >
              <XIcon class="w-4 h-4" />
            </button>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
              <!-- Character fields -->
              <div class="md:col-span-12 space-y-1">
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Original Actor / Character *</label>
                <AsyncAutocomplete
                  v-model="row.actor_id"
                  @update:model-value="(val) => handleActorSelect(row, val)"
                  :options="filteredTmdbCast"
                  :loading="isFetchingTmdb"
                  placeholder="Search TMDB Cast..."
                  :allow-create="true"
                  :display-fn="(id) => getActorName(id) || row.character_name"
                  @search="searchActors"
                  @create="(query) => handleActorCreate(row, query)"
                />
              </div>

              <!-- Voice Actor -->
              <div class="md:col-span-8 space-y-1">
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Voice Actor *</label>
                <AsyncAutocomplete
                  v-model="row.voice_actor_id"
                  :options="voiceActorOptions"
                  :loading="isSearchingVoiceActors"
                  placeholder="Search Voice Actor..."
                  :allow-create="true"
                  :display-fn="getVoiceActorName"
                  @search="searchVoiceActors"
                  @create="(q) => openCreateVaDialog(q, (id) => row.voice_actor_id = id)"
                />
              </div>
              
              <!-- Performance -->
              <div class="md:col-span-4 space-y-1">
                <label class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance Type</label>
                <select
                  v-model="row.performance"
                  class="w-full px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="dialogues">Dialogues</option>
                  <option value="dialogues & chant">Dialogues & Chant</option>
                  <option value="chant">Chant</option>
                  <option value="bruitages">Bruitages</option>
                  <option value="narration">Narration</option>
                </select>
              </div>
              
              <div class="md:col-span-12 flex items-center space-x-2">
                <input type="checkbox" v-model="row.highlight" class="w-4 h-4 bg-gray-900 border-gray-800 rounded text-blue-500 focus:ring-blue-500" />
                <label class="text-xs text-gray-300">Highlight character</label>
              </div>
            </div>
          </div>
          
          <div v-if="castRows.length === 0" class="text-center py-10 bg-gray-950 border border-dashed border-gray-800 rounded-xl text-gray-500">
            No cast members added yet.
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div class="flex justify-end pt-4">
        <button
          type="submit"
          :disabled="isSaving"
          class="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center space-x-2 transition-colors disabled:opacity-50"
        >
          <Loader2Icon v-if="isSaving" class="w-5 h-5 animate-spin" />
          <span v-else>Save Show Project</span>
        </button>
      </div>
    </form>

    <!-- Inline Create Studio Dialog -->
    <DialogRoot v-model:open="isCreateStudioOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 bg-black/60 z-[110] backdrop-blur-sm" />
        <DialogContent class="fixed top-1/2 left-1/2 -trangray-x-1/2 -trangray-y-1/2 bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl z-[120] w-[400px]">
          <DialogTitle class="text-lg font-bold text-white mb-4">Create New Studio</DialogTitle>
          <VisuallyHidden><DialogDescription>Form to create a new studio</DialogDescription></VisuallyHidden>
          <input
            v-model="newStudioName"
            type="text"
            placeholder="Studio Name"
            class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white mb-4"
          />
          <div class="flex justify-end gap-2">
            <button @click="isCreateStudioOpen = false" class="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
            <button @click="createStudio" :disabled="!newStudioName || isCreatingStudio" class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Loader2Icon v-if="isCreatingStudio" class="w-4 h-4 animate-spin" />
              <span>Create</span>
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>

    <!-- Inline Create Voice Actor Dialog -->
    <DialogRoot v-model:open="isCreateVaOpen">
      <DialogPortal>
        <DialogOverlay class="fixed inset-0 bg-black/60 z-[110] backdrop-blur-sm" />
        <DialogContent class="fixed top-1/2 left-1/2 -trangray-x-1/2 -trangray-y-1/2 bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl z-[120] w-[400px]">
          <DialogTitle class="text-lg font-bold text-white mb-4">Create New Voice Actor</DialogTitle>
          <VisuallyHidden><DialogDescription>Form to create a new voice actor</DialogDescription></VisuallyHidden>
          <div class="space-y-4 mb-4">
            <input
              v-model="newVaFirstname"
              type="text"
              placeholder="First Name"
              class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white"
            />
            <input
              v-model="newVaLastname"
              type="text"
              placeholder="Last Name"
              class="w-full px-4 py-2 bg-gray-950 border border-gray-800 rounded-lg text-white"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button @click="isCreateVaOpen = false" class="px-4 py-2 text-gray-300 hover:text-white">Cancel</button>
            <button @click="createVoiceActor" :disabled="!newVaFirstname || isCreatingVa" class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 flex items-center gap-2">
              <Loader2Icon v-if="isCreatingVa" class="w-4 h-4 animate-spin" />
              <span>Create</span>
            </button>
          </div>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    
    <!-- Toast -->
    <div
      v-if="toast.show"
      class="fixed bottom-6 right-6 z-50 p-4 rounded-xl border shadow-2xl text-sm max-w-sm flex flex-col gap-2 bg-gray-900 border-gray-800 text-gray-200"
    >
      <span>{{ toast.message }}</span>
      <a v-if="toast.link" :href="toast.link" target="_blank" class="text-blue-400 hover:underline">View Details ↗</a>
    </div>
  </div>
  </template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent, DialogTitle, DialogDescription, VisuallyHidden } from "reka-ui";
import { TvIcon, Loader2Icon, ImageIcon, XIcon } from "lucide-vue-next";
import AsyncAutocomplete from "@/components/admin/AsyncAutocomplete.vue";
import LanguageSelect from "@/components/admin/LanguageSelect.vue";

defineRouteRules({
  swr: false,
  cache: false
});

definePageMeta({
  middleware: 'admin'
});

const supabase = useSupabaseClient();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const showIdParam = route.params.showId as string | undefined;
const projectIdParam = route.params.projectId as string | undefined;

const isEditMode = computed(() => !!projectIdParam && projectIdParam !== "new");
const tmdbShowId = computed(() => (showIdParam && showIdParam !== "new") ? Number(showIdParam) : null);

const showDubbingProjects = ref<any[]>([]);

// Form state
const contentId = ref<number | null>(null);
const mediaTitle = ref("");
const contentType = ref("tv");
const language = ref("fr-FR");
const posterUrl = ref("");
const status = ref("validated");
const selectedStudioId = ref<number | null>(null);

// Crew state
const artisticDirectorId = ref<number | null>(null);
const adaptationId = ref<number | null>(null);
const recordingId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const mixingId = ref<number | null>(null);
const projectManagerId = ref<number | null>(null);
const creativeSupervisionId = ref<number | null>(null);

// Autocomplete State
const studioOptions = ref<any[]>([]);
const isSearchingStudios = ref(false);
const voiceActorOptions = ref<any[]>([]);
const isSearchingVoiceActors = ref(false);
const optionsCache = ref<Map<number, string>>(new Map());

// Dialog State
const isCreateStudioOpen = ref(false);
const newStudioName = ref("");
const isCreateVaOpen = ref(false);
const newVaFirstname = ref("");
const newVaLastname = ref("");
let pendingVaSelectCallback: ((id: number) => void) | null = null;

// Cast Rows
interface CastRow {
  id?: number;
  actor_id: number | string | null;
  character_name: string;
  voice_actor_id: number | null;
  performance: string;
  highlight: boolean;
}
const castRows = ref<CastRow[]>([]);

// Toast
const toast = ref({ show: false, message: "", type: "info", link: "" });
const showToast = (message: string, type = "info", link = "") => {
  toast.value = { show: true, message, type, link };
  setTimeout(() => (toast.value.show = false), 5000);
};

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return 'Inconnu';
  try {
    const displayNames = new Intl.DisplayNames(['fr'], { type: 'language' });
    const name = displayNames.of(langCode);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : langCode;
  } catch (e) {
    return langCode;
  }
};

const isFetchingTmdb = ref(false);
const isSaving = ref(false);
const isLoading = ref(true);

const addCastRow = () => {
  castRows.value.push({ actor_id: null, character_name: "", voice_actor_id: null, performance: "dialogues", highlight: false });
};
const removeCastRow = (index: number) => {
  castRows.value.splice(index, 1);
};

const tmdbCast = ref<any[]>([]);
const filteredTmdbCast = ref<any[]>([]);

const extractRoles = (c: any) => {
  if (c.roles && c.roles.length > 0) {
    return c.roles.map((r: any) => r.character).filter(Boolean).join(', ');
  }
  return c.character || '';
}

const searchActors = (query: string) => {
  if (!query) {
    filteredTmdbCast.value = tmdbCast.value.slice(0, 50);
    return;
  }
  filteredTmdbCast.value = tmdbCast.value.filter(c => {
    const chars = extractRoles(c).toLowerCase();
    return c.name.toLowerCase().includes(query.toLowerCase()) || chars.includes(query.toLowerCase());
  }).slice(0, 50);
};

const getActorName = (id: number | string | null) => {
  if (!id) return '';
  const actor = tmdbCast.value.find(c => c.id === id);
  if (!actor) return '';
  const chars = extractRoles(actor);
  return chars ? `${actor.name} (${chars})` : actor.name;
};

const handleActorSelect = (row: CastRow, val: any) => {
  const actor = tmdbCast.value.find(c => c.id === val);
  if (actor) {
    row.character_name = extractRoles(actor);
  }
};

const handleActorCreate = (row: CastRow, query: string) => {
  const fakeId = `custom_${Date.now()}_${Math.random()}`;
  tmdbCast.value.push({ id: fakeId, name: query, character: query });
  row.actor_id = fakeId as any; // Type hack for UI fake IDs
  row.character_name = query;
};



const searchStudios = async (query: string) => {
  isSearchingStudios.value = true;
  try {
    let q = supabase.from("studios").select("id, name").limit(10);
    if (query) {
      q = q.ilike("name", `%${query}%`);
    }
    const { data } = await q;
    studioOptions.value = data || [];
    (data || []).forEach(d => optionsCache.value.set(d.id, d.name));
  } finally {
    isSearchingStudios.value = false;
  }
};

const searchVoiceActors = async (query: string) => {
  isSearchingVoiceActors.value = true;
  try {
    let q = supabase.from("voice_actors").select("id, firstname, lastname").limit(10);
    if (query) {
      q = q.or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`);
    }
    const { data } = await q;
    const formatted = (data || []).map(va => ({ id: va.id, name: `${va.firstname || ''} ${va.lastname || ''}`.trim() }));
    voiceActorOptions.value = formatted;
    formatted.forEach(f => optionsCache.value.set(f.id, f.name));
  } finally {
    isSearchingVoiceActors.value = false;
  }
};

const getStudioName = (id: number | null) => {
  if (!id) return '';
  return optionsCache.value.get(id) || `Studio #${id}`;
};
const getVoiceActorName = (id: number | null) => {
  if (!id) return '';
  return optionsCache.value.get(id) || `VA #${id}`;
};

// Inline Creation
const studioCreationCallback = ref<((id: number) => void) | null>(null);
const openCreateStudioDialog = (query: string, callback?: (id: number) => void) => {
  newStudioName.value = query;
  studioCreationCallback.value = callback || null;
  isCreateStudioOpen.value = true;
};

const isCreatingStudio = ref(false);
const createStudio = async () => {
  isCreatingStudio.value = true;
  try {
    const { data } = await supabase.from("studios").insert({ name: newStudioName.value }).select().single();
    if (data) {
      optionsCache.value.set(data.id, data.name);
      studioOptions.value = [{ id: data.id, name: data.name }];
      if (studioCreationCallback.value) {
        studioCreationCallback.value(data.id);
        studioCreationCallback.value = null;
      }
      isCreateStudioOpen.value = false;
      showToast(`Created ${data.name}`, "success", `/studio/${data.id}`);
    }
  } finally {
    isCreatingStudio.value = false;
  }
};

const openCreateVaDialog = (query: string, callback?: (id: number) => void) => {
  const parts = query.split(" ");
  newVaFirstname.value = parts[0] || "";
  newVaLastname.value = parts.slice(1).join(" ") || "";
  pendingVaSelectCallback = callback || null;
  isCreateVaOpen.value = true;
};

const isCreatingVa = ref(false);
const createVoiceActor = async () => {
  isCreatingVa.value = true;
  try {
    const payload = { firstname: newVaFirstname.value, lastname: newVaLastname.value };
    const { data } = await supabase.from("voice_actors").insert(payload).select().single();
    if (data) {
      const name = `${data.firstname || ''} ${data.lastname || ''}`.trim();
      optionsCache.value.set(data.id, name);
      voiceActorOptions.value = [{ id: data.id, name }];
      if (pendingVaSelectCallback) {
        pendingVaSelectCallback(data.id);
        pendingVaSelectCallback = null;
      }
      isCreateVaOpen.value = false;
      showToast(`Created ${name}`, "success");
    }
  } finally {
    isCreatingVa.value = false;
  }
};


const saveShowProject = async () => {
  if (!contentId.value) return showToast("TMDB ID required", "error");
  if (!language.value) return showToast("Language required", "error");
  isSaving.value = true;
  try {
    const projectPayload = {
      content_id: contentId.value,
      content_type: contentType.value,
      language: language.value || "fr-FR",
      studio_id: selectedStudioId.value || null,
      status: status.value || "validated"
    };

    let projectId = isEditMode.value ? Number(projectIdParam) : null;

    if (isEditMode.value && projectId) {
      await supabase.from("dubbing_projects").update(projectPayload).eq("id", projectId);
    } else {
      const { data } = await supabase.from("dubbing_projects").insert([projectPayload]).select().single();
      projectId = data?.id;
      
      if (projectId && contentId.value) {
        showToast("Project created! Redirecting...", "success");
        router.push(localePath(`/show/${contentId.value}/edit/${projectId}`));
        return;
      }
    }

    if (!projectId) throw new Error("No project ID returned");

    // Save Crew
    const crewJobs = [
      { job_id: 1, person_id: artisticDirectorId.value },
      { job_id: 2, person_id: adaptationId.value },
      { job_id: 3, person_id: recordingId.value },
      { job_id: 4, person_id: editingId.value },
      { job_id: 5, person_id: mixingId.value },
      { job_id: 6, person_id: projectManagerId.value },
      { job_id: 7, person_id: creativeSupervisionId.value },
    ].filter(j => j.person_id !== null);

    // Delete old crew & insert new
    await supabase.from("dubbing_project_crew").delete().eq("dubbing_project_id", projectId);
    if (crewJobs.length > 0) {
      const crewPayload = crewJobs.map(j => ({ dubbing_project_id: projectId!, job_id: j.job_id, person_id: j.person_id }));
      await supabase.from("dubbing_project_crew").insert(crewPayload);
    }

    // Save Works (Cast)
    for (const row of castRows.value) {
      if (!row.voice_actor_id && !row.character_name) continue;
      const isCustom = typeof row.actor_id === 'string' && row.actor_id.startsWith('custom_');
      const actorId = isCustom || !row.actor_id ? null : row.actor_id;
      const workPayload: any = {
        dubbing_project_id: projectId,
        actor_id: actorId,
        character_id: null,
        character_name: row.character_name || null,
        voice_actor_id: row.voice_actor_id || null,
        performance: row.performance || "dialogues",
        highlight: row.highlight ? true : false,
      };
      if (row.id) workPayload.id = row.id;
      await supabase.from("work").upsert([workPayload]);
    }

    showToast("Project saved successfully!", "success");
  } catch (err: any) {
    showToast(err.message, "error");
  } finally {
    isSaving.value = false;
  }
};

const { data: initialData } = await useAsyncData(`show-edit-${tmdbShowId.value}-${projectIdParam}`, async () => {
  let tmdbData = null;
  let projects = [];
  let project = null;
  let studioName = null;
  let crew = [];
  let works = [];

  if (tmdbShowId.value) {
    // TMDB metadata
    try {
      const params = new URLSearchParams({ id: tmdbShowId.value.toString() });
      const { data, error } = await supabase.functions.invoke(`show?${params.toString()}`, { method: "GET" });
      if (!error) {
        tmdbData = data;
      }
    } catch (e) {
      console.error("Failed to fetch TMDB data.", e);
    }
    
    // Fetch all dubbing projects for this show for the tabs
    const { data: pData } = await supabase
      .from("dubbing_projects")
      .select("id, language, studio_id, studios(name)")
      .eq("content_id", tmdbShowId.value)
      .eq("content_type", "tv");
    projects = pData || [];
  }

  if (isEditMode.value) {
    const projectId = Number(projectIdParam);
    const { data: proj } = await supabase.from("dubbing_projects").select("*").eq("id", projectId).single();
    if (proj) {
      project = proj;
      if (proj.studio_id) {
         const { data: studio } = await supabase.from("studios").select("name").eq("id", proj.studio_id).single();
         if (studio) studioName = studio.name;
      }
    }

    const { data: cData } = await supabase.from("dubbing_project_crew").select("job_id, person_id, voice_actors(firstname, lastname)").eq("dubbing_project_id", projectId);
    crew = cData || [];

    const { data: wData } = await supabase.from("work").select("*, voice_actors(firstname, lastname)").eq("dubbing_project_id", projectId);
    works = wData || [];
  }

  // Pre-fetch initial dropdown options
  const { data: studiosData } = await supabase.from("studios").select("id, name").limit(10);
  const initialStudios = studiosData || [];

  const { data: vaData } = await supabase.from("voice_actors").select("id, firstname, lastname").limit(10);
  const initialVoiceActors = (vaData || []).map(va => ({ id: va.id, name: `${va.firstname || ''} ${va.lastname || ''}`.trim() }));

  return { tmdbData, projects, project, studioName, crew, works, initialStudios, initialVoiceActors };
});

watch(initialData, (data) => {
  if (data) {
    if (data.tmdbData) {
      contentId.value = tmdbShowId.value;
      if (data.tmdbData.serie) {
        mediaTitle.value = data.tmdbData.serie.name;
        let poster = data.tmdbData.serie.poster_path;
        if (poster && poster.startsWith("/")) {
          poster = `https://image.tmdb.org/t/p/w500${poster}`;
        }
        posterUrl.value = poster || "";
      }
      if (data.tmdbData.aggregateCredits?.cast) {
        tmdbCast.value = data.tmdbData.aggregateCredits.cast;
        filteredTmdbCast.value = tmdbCast.value.slice(0, 50);
      }
    }
    
    showDubbingProjects.value = data.projects;

    if (data.project) {
      contentId.value = data.project.content_id;
      contentType.value = data.project.content_type;
      language.value = data.project.language;
      status.value = data.project.status;
      selectedStudioId.value = data.project.studio_id;
      if (data.studioName) {
        optionsCache.value.set(data.project.studio_id, data.studioName);
      }
    }

    if (data.crew) {
      data.crew.forEach((c: any) => {
        const name = `${c.voice_actors?.firstname || ''} ${c.voice_actors?.lastname || ''}`.trim();
        optionsCache.value.set(c.person_id, name);
        if (c.job_id === 1) artisticDirectorId.value = c.person_id;
        if (c.job_id === 2) adaptationId.value = c.person_id;
        if (c.job_id === 3) recordingId.value = c.person_id;
        if (c.job_id === 4) editingId.value = c.person_id;
        if (c.job_id === 5) mixingId.value = c.person_id;
        if (c.job_id === 6) projectManagerId.value = c.person_id;
        if (c.job_id === 7) creativeSupervisionId.value = c.person_id;
      });
    }

    if (data.works) {
      castRows.value = data.works.map((w: any) => {
        if (w.voice_actors) {
           const name = `${w.voice_actors.firstname || ''} ${w.voice_actors.lastname || ''}`.trim();
           optionsCache.value.set(w.voice_actor_id, name);
        }
        return {
          id: w.id,
          actor_id: w.actor_id,
          character_name: w.character_name,
          voice_actor_id: w.voice_actor_id,
          performance: w.performance,
          highlight: w.highlight
        };
      });
    }

    if (data.initialStudios) {
      studioOptions.value = data.initialStudios;
      data.initialStudios.forEach((d: any) => optionsCache.value.set(d.id, d.name));
    }

    if (data.initialVoiceActors) {
      voiceActorOptions.value = data.initialVoiceActors;
      data.initialVoiceActors.forEach((f: any) => optionsCache.value.set(f.id, f.name));
    }

    isLoading.value = false;
  }
}, { immediate: true });

const fetchTmdbMetadata = async () => {}; // Dummy to prevent error if called

</script>
