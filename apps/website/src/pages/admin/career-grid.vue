<template>
  <div class="space-y-6 pb-20">
    <div class="bg-gray-900 p-6 rounded-2xl border border-gray-800">
      <h3 class="text-lg font-bold text-white">{{ $t('admin.careerGrid.title') }}</h3>
      <p class="text-sm text-gray-400">{{ $t('admin.careerGrid.description') }}</p>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5 shadow-lg">
      <h4 class="font-bold text-white text-sm mb-4">{{ $t('admin.careerGrid.searchVoiceActor') }}</h4>
      
      <div v-if="selectedActor" class="flex items-center justify-between bg-gray-950 border border-gray-800 rounded-xl p-3">
        <div class="flex items-center space-x-3">
          <div class="h-10 w-10 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0 flex items-center justify-center">
            <NuxtImg format="webp" v-if="selectedActor.profile_picture" :src="selectedActor.profile_picture" class="h-full w-full object-cover" />
            <span v-else class="text-xs font-bold text-gray-500">{{ selectedActor.firstname?.charAt(0) || '' }}</span>
          </div>
          <div>
            <p class="text-sm font-semibold text-white">{{ selectedActor.firstname }} {{ selectedActor.lastname }}</p>
            <p class="text-xs text-gray-400 font-mono">{{ $t('common.idLabel') }}{{ selectedActor.id }}</p>
          </div>
        </div>
        <button @click="resetSelection" class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div v-else class="relative">
        <input
          type="text"
          placeholder="Search Voice Actor..."
          v-model="searchQuery"
          @focus="activeSearch = true"
          @input="triggerSearch"
          class="w-full pl-4 pr-10 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <div
          v-if="activeSearch && searchResults.length > 0"
          class="absolute z-40 left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-gray-900 border border-gray-800 rounded-xl shadow-2xl divide-y divide-gray-800/60"
        >
          <div
            v-for="va in searchResults"
            :key="va.id"
            @click="selectActor(va)"
            class="px-4 py-3 hover:bg-gray-800/50 cursor-pointer flex items-start space-x-3 transition-colors"
          >
            <div class="h-10 w-10 mt-1 rounded-full overflow-hidden border border-gray-700 bg-gray-800 shrink-0 flex items-center justify-center">
              <NuxtImg format="webp" v-if="va.profile_picture" :src="va.profile_picture" class="h-full w-full object-cover" />
              <span v-else class="text-xs font-bold text-gray-500">{{ va.firstname?.charAt(0) || '' }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-gray-200">
                {{ va.firstname }} {{ va.lastname }}
                <span class="text-xs text-gray-500 font-mono ml-2">{{ $t('common.idLabel') }}{{ va.id }}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Generator Actions -->
    <div v-if="selectedActor" class="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div class="flex items-center space-x-4">
        <select v-model="selectedLang" class="bg-gray-950 border border-gray-800 rounded-xl text-white py-2 px-4 focus:ring-2 focus:ring-blue-500 text-sm outline-none">
          <option value="fr-FR">{{ $t('admin.careerGrid.french') }}</option>
          <option value="en-US">{{ $t('admin.careerGrid.english') }}</option>
        </select>
        
        <button
          @click="generateImage"
          :disabled="generating"
          class="py-2.5 px-6 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-semibold rounded-xl text-sm transition-all duration-150 flex items-center"
        >
          <span v-if="generating" class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
          {{ generating ? $t('admin.careerGrid.generating') : $t('admin.careerGrid.generateImage') }}
        </button>
      </div>

      <div v-if="errorMsg" class="p-4 bg-red-950/30 border border-red-900/50 rounded-xl text-red-200 text-sm">
        {{ errorMsg }}
      </div>

      <div v-if="imageUrl" class="mt-6 space-y-4">
        <h4 class="font-bold text-white text-sm">{{ $t('admin.careerGrid.preview') }}</h4>
        <div class="rounded-xl overflow-hidden border border-gray-800 bg-gray-950 p-4 inline-block">
          <NuxtImg format="webp" :src="imageUrl" alt="Career Grid" class="max-w-full h-auto max-h-[600px] object-contain" />
        </div>
        <div>
          <button @click="downloadImage" class="py-2 px-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-all inline-flex items-center space-x-2">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{{ $t('admin.careerGrid.downloadPng') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  </template>

<script setup lang="ts">


definePageMeta({
  layout: 'admin',
  middleware: 'admin'
});

import { ref, onMounted, onUnmounted } from "vue";

interface VoiceActorCandidate {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture?: string | null;
}

const searchQuery = ref("");
const searchResults = ref<VoiceActorCandidate[]>([]);
const searchLoading = ref(false);
const activeSearch = ref(false);
const searchTimer = ref<ReturnType<typeof setTimeout> | null>(null);

const selectedActor = ref<VoiceActorCandidate | null>(null);
const selectedLang = ref("fr-FR");
const generating = ref(false);
const imageUrl = ref<string | null>(null);
const errorMsg = ref("");

const triggerSearch = () => {
  if (searchTimer.value) clearTimeout(searchTimer.value);
  searchTimer.value = setTimeout(() => {
    executeSearch();
  }, 300);
};

const executeSearch = async () => {
  const query = searchQuery.value.trim();
  if (!query) {
    searchResults.value = [];
    return;
  }
  searchLoading.value = true;
  try {
    const data = await $fetch<VoiceActorCandidate[]>('/api/search-voice-actors', { params: { query, limit: "10" } });
    searchResults.value = data || [];
  } catch (err: any) {
    console.error("Error searching voice actors:", err);
  } finally {
    searchLoading.value = false;
  }
};

const selectActor = (va: VoiceActorCandidate) => {
  selectedActor.value = va;
  searchQuery.value = "";
  activeSearch.value = false;
  imageUrl.value = null;
  errorMsg.value = "";
};

const resetSelection = () => {
  selectedActor.value = null;
  imageUrl.value = null;
  errorMsg.value = "";
};

const generateImage = async () => {
  if (!selectedActor.value) return;
  generating.value = true;
  imageUrl.value = null;
  errorMsg.value = "";
  
  try {
    const url = `/api/career-grid?id=${selectedActor.value.id}&lang=${selectedLang.value}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    imageUrl.value = URL.createObjectURL(blob);
  } catch (err: any) {
    console.error("Error generating image:", err);
    errorMsg.value = err.message || "Failed to generate image.";
  } finally {
    generating.value = false;
  }
};

const downloadImage = () => {
  if (!imageUrl.value || !selectedActor.value) return;
  
  const a = document.createElement("a");
  a.href = imageUrl.value;
  a.download = `career-grid-${selectedActor.value.id}-${selectedLang.value}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const handleOutsideClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest('.relative')) {
    activeSearch.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value);
  }
});
</script>
