<template>
  <DialogRoot v-model:open="isOpen">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" />
      <DialogContent class="fixed top-[20%] left-1/2 -translate-x-1/2 w-[90vw] max-w-2xl z-50 bg-white dark:bg-[#1d1d1d] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden focus:outline-none flex flex-col max-h-[70vh]">
        <VisuallyHidden>
          <DialogTitle>{{ t('search.title') }}</DialogTitle>
          <DialogDescription>{{ t('search.description') }}</DialogDescription>
        </VisuallyHidden>
        <!-- Search Input -->
        <div class="flex items-center px-4 py-4 border-b border-gray-200 dark:border-[#2a2a2a] gap-3">
          <SearchIcon class="w-5 h-5 text-gray-400" />
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            class="flex-1 bg-transparent border-none text-gray-900 dark:text-white text-lg focus:ring-0 placeholder-gray-500 outline-none"
            :placeholder="t('search.placeholder')"
            @keydown.esc="isOpen = false"
            @keydown.down.prevent="navigateResults(1)"
            @keydown.up.prevent="navigateResults(-1)"
            @keydown.enter.prevent="selectCurrent"
          />
          <button @click="isOpen = false" class="text-xs text-gray-500 font-medium bg-gray-100 dark:bg-[#2a2a2a] px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-[#3a3a3a] transition">
            ESC
          </button>
        </div>

        <!-- Filter Chips -->
        <div class="flex gap-2 px-4 py-3 border-b border-gray-200 dark:border-[#2a2a2a] overflow-x-auto no-scrollbar shrink-0" v-if="query.length >= 2">
          <button 
            v-for="filter in filters" 
            :key="filter.value"
            @click="selectedFilter = filter.value"
            class="inline-flex items-center justify-center px-4 h-8 rounded-full text-sm font-medium whitespace-nowrap transition outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white shrink-0 leading-none"
            :class="selectedFilter === filter.value ? 'bg-gray-900 text-white dark:bg-white dark:text-black' : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3a3a3a]'"
          >
            {{ filter.label }}
          </button>
        </div>

        <!-- Results -->
        <div class="overflow-y-auto flex-1 p-2 min-h-[100px]">
          <div v-if="loading" class="flex justify-center py-8">
            <Loader2Icon class="w-6 h-6 animate-spin text-gray-400" />
          </div>
          
          <div v-else-if="filteredResults.length > 0" class="flex flex-col gap-1">
            <button
              v-for="(item, index) in filteredResults"
              :key="`${item.media_type}-${item.id}`"
              class="flex items-center gap-4 p-2 rounded-xl transition text-left w-full border"
              :class="selectedIndex === index ? 'bg-gray-100 dark:bg-[#2a2a2a] border-gray-300 dark:border-[#4a4a4a]' : 'border-transparent hover:bg-gray-50 dark:hover:bg-[#2a2a2a]'"
              @click="handleSelect(item)"
              @mouseenter="selectedIndex = index"
            >
              <!-- Image -->
              <img v-if="item.cover?.url || item.poster_path || item.profile_path" :src="item.cover?.url || item.poster_path || item.profile_path" class="w-12 h-16 object-cover rounded shadow-sm bg-gray-200 dark:bg-gray-800" />
              <div v-else class="w-12 h-16 rounded bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-500 shadow-sm">
                <ImageIcon class="w-5 h-5" />
              </div>

              <!-- Info -->
              <div class="flex flex-col flex-1 min-w-0">
                <div class="font-semibold text-gray-900 dark:text-white truncate text-base leading-tight">{{ item.title || item.name || item.voice_actor_name || `${item.firstname || ''} ${item.lastname || ''}`.trim() }}</div>
                <div class="text-xs text-gray-400 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span class="inline-block w-2 h-2 rounded-full" :class="getTypeColor(item.media_type)"></span>
                  <span class="capitalize">{{ getMediaTypeLabel(item.media_type) }}</span>
                  <template v-if="getItemMetadata(item)">
                    <span class="text-gray-600">•</span>
                    <span class="truncate max-w-[200px] sm:max-w-xs">{{ getItemMetadata(item) }}</span>
                  </template>
                </div>
              </div>
              
              <div class="pr-2 text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
          
          <div v-else-if="query.length >= 2 && !loading" class="text-center py-8 text-gray-500">
            {{ t('search.noResults') }}
          </div>
          <div v-else-if="query.length < 2 && !loading" class="text-center py-8 text-gray-500">
            {{ t('search.emptyState') }}
          </div>
        </div>

      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';

import { 
  DialogRoot, 
  DialogPortal, 
  DialogOverlay, 
  DialogContent,
  DialogTitle,
  DialogDescription,
  VisuallyHidden
} from 'reka-ui';
import { SearchIcon, Loader2Icon, ImageIcon, Gamepad2Icon } from 'lucide-vue-next';
import { fetchSearchData, type SearchResult } from '@app/shared-logic';

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const isOpen = ref(props.open);
watch(() => props.open, (val) => { isOpen.value = val; });
watch(isOpen, (val) => { 
  emit('update:open', val); 
  if (val) {
    // Focus input when opened
    nextTick(() => {
      searchInput.value?.focus();
    });
  } else {
    // Reset state when closed
    setTimeout(() => {
      query.value = '';
      results.value = [];
      selectedIndex.value = 0;
    }, 200);
  }
});

const { t } = useI18n();
const router = useRouter();
const supabase = useSupabaseClient();

const query = ref('');
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const selectedIndex = ref(0);

const selectedFilter = ref<string>('all');

const filters = computed(() => {
  const getLabel = (key: string, fallback: string) => {
    const translation = t(key);
    return translation === key ? fallback : translation;
  };
  return [
    { label: getLabel('search.all', 'All'), value: 'all' },
    { label: getLabel('search.movie', 'Movie'), value: 'movie' },
    { label: getLabel('search.tv', 'TV Show'), value: 'tv' },
    { label: getLabel('search.voiceActor', 'Voice Actor'), value: 'voice_actor' },
    { label: getLabel('search.videoGame', 'Video Game'), value: 'video_game' },
  ];
});

const filteredResults = computed(() => {
  if (selectedFilter.value === 'all') return results.value;
  return results.value.filter(item => item.media_type === selectedFilter.value);
});

let debounceTimeout: any = null;

watch(query, (newVal) => {
  selectedIndex.value = 0; // reset selection
  if (debounceTimeout) clearTimeout(debounceTimeout);
  
  const trimmed = newVal.trim();
  if (trimmed.length < 2) {
    results.value = [];
    loading.value = false;
    return;
  }
  
  loading.value = true;
  debounceTimeout = setTimeout(async () => {
    try {
      const data = await fetchSearchData(trimmed);
      results.value = data;
    } catch (e) {
      console.error(e);
      results.value = [];
    } finally {
      loading.value = false;
    }
  }, 300);
});

const getMediaTypeLabel = (type: string) => {
  if (type === 'movie') return t('search.movie') || 'Film';
  if (type === 'tv') return t('search.tv') || 'Série';
  if (type === 'voice_actor') return t('search.voiceActor') || 'Comédien(ne)';
  if (type === 'video_game') return t('search.videoGame') || 'Jeu vidéo';
  return type;
};

const getTypeColor = (type: string) => {
  if (type === 'movie') return 'bg-blue-500';
  if (type === 'tv') return 'bg-purple-500';
  if (type === 'voice_actor') return 'bg-[#00E5FF]';
  if (type === 'video_game') return 'bg-orange-500';
  return 'bg-gray-500';
};

const getItemMetadata = (item: SearchResult) => {
  const parts = [];
  
  if (item.release_date) {
    parts.push(item.release_date.substring(0, 4));
  } else if (item.first_air_date) {
    parts.push(item.first_air_date.substring(0, 4));
  } else if (item.first_release_date) {
    parts.push(new Date(item.first_release_date * 1000).getFullYear().toString());
  }

  const mainTitle = item.title || item.name || item.voice_actor_name || `${item.firstname || ''} ${item.lastname || ''}`.trim();
  const original = item.original_title || item.original_name;
  
  if (original && original !== mainTitle) {
    parts.push(original);
  }

  return parts.join(' • ');
};

const localePath = useLocalePath();

const handleSelect = (item: SearchResult) => {
  isOpen.value = false;
  if (item.media_type === 'movie') {
    router.push(localePath(`/movie/${item.id}`));
  } else if (item.media_type === 'tv') {
    router.push(localePath(`/show/${item.id}`));
  } else if (item.media_type === 'voice_actor') {
    router.push(localePath(`/voice-actor/${item.id}`));
  } else if (item.media_type === 'video_game') {
    router.push(localePath(`/game/${item.id}`));
  }
};

const selectCurrent = () => {
  if (filteredResults.value.length > 0 && selectedIndex.value >= 0 && selectedIndex.value < filteredResults.value.length) {
    const item = filteredResults.value[selectedIndex.value];
    if (item) {
      handleSelect(item);
    }
  }
};

const navigateResults = (direction: number) => {
  if (filteredResults.value.length === 0) return;
  const next = selectedIndex.value + direction;
  if (next >= 0 && next < filteredResults.value.length) {
    selectedIndex.value = next;
  }
};

// Handle Cmd+K or / global shortcut
const handleGlobalKeydown = (e: KeyboardEvent) => {
  // Prevent if user is typing in an input (except for Cmd+K which we might still want to catch)
  const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName);
  
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    e.stopPropagation();
    isOpen.value = true;
  } else if (e.key === '/' && !isInput) {
    e.preventDefault();
    isOpen.value = true;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
