<template>
  <div
    v-if="isSearchOpen"
    role="dialog"
    aria-modal="true"
    class="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4"
  >
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/60 backdrop-blur-sm"
      @click="closeSearch"
    ></div>

    <!-- Modal Content -->
    <div
      class="relative w-full max-w-2xl theme-surface border theme-border-subtle theme-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] z-10 focus:outline-none"
    >
      <!-- Search Input -->
      <div
        class="flex items-center px-4 py-4 border-b theme-border-subtle theme-border gap-3"
      >
        <SearchIcon class="w-5 h-5 theme-text-muted" />
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          data-testid="search-modal-input"
          class="flex-1 bg-transparent border-none theme-text text-lg focus:ring-0 theme-placeholder outline-none"
          :placeholder="t('search.placeholder')"
          @keydown.esc="closeSearch"
          @keydown.down.prevent="navigateResults(1)"
          @keydown.up.prevent="navigateResults(-1)"
          @keydown.enter.prevent="selectCurrent"
        />
        <button
          type="button"
          @click="closeSearch"
          class="text-xs theme-text-muted font-medium theme-surface-raised theme-surface-muted px-2 py-1 rounded theme-hover-surface-muted transition cursor-pointer"
        >
          ESC
        </button>
      </div>

      <!-- Filter Chips -->
      <div
        class="flex gap-2 px-4 py-3 border-b theme-border-subtle theme-border overflow-x-auto no-scrollbar shrink-0"
        v-if="query.length >= 2"
      >
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          @click="selectedFilter = filter.value"
          class="inline-flex items-center justify-center px-4 h-8 rounded-full text-sm font-medium whitespace-nowrap transition theme-focus shrink-0 leading-none cursor-pointer"
          :class="
            selectedFilter === filter.value
              ? 'theme-selected'
              : 'theme-surface-raised theme-surface-muted theme-text-secondary theme-hover-surface-muted'
          "
        >
          {{ filter.label }}
        </button>
      </div>

      <!-- Results -->
      <div class="overflow-y-auto flex-1 p-2 min-h-[100px]">
        <div v-if="loading" class="flex justify-center py-8">
          <Loader2Icon class="w-6 h-6 animate-spin theme-text-muted" />
        </div>

        <div v-else-if="filteredResults.length > 0" class="flex flex-col gap-1">
          <button
            v-for="(item, index) in filteredResults"
            :key="`${item.media_type}-${item.id}`"
            type="button"
            @click="handleSelect(item)"
            class="flex items-center gap-3 p-3 rounded-xl theme-hover-surface-muted transition text-left w-full group cursor-pointer"
            :class="{
              'theme-surface-raised theme-surface-muted':
                index === selectedIndex,
            }"
          >
            <!-- Poster / Avatar / Icon -->
            <div
              class="w-12 h-16 rounded-lg overflow-hidden theme-surface-muted shrink-0 flex items-center justify-center relative shadow-sm"
            >
              <NuxtImg
                v-if="item.poster_path || item.profile_path"
                :src="item.poster_path || item.profile_path"
                :alt="
                  item.title ||
                  item.name ||
                  item.voice_actor_name ||
                  `${item.firstname || ''} ${item.lastname || ''}`.trim()
                "
                class="w-full h-full object-cover"
                loading="lazy"
                width="48"
                height="64"
              />
              <div
                v-else-if="item.media_type === 'video_game'"
                class="theme-text-muted"
              >
                <Gamepad2Icon class="w-6 h-6" />
              </div>
              <div v-else class="theme-text-muted">
                <ImageIcon class="w-6 h-6" />
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span
                  class="font-bold theme-text truncate group-hover:text-[var(--app-color-primary)] transition"
                >
                  {{
                    item.title ||
                    item.name ||
                    item.voice_actor_name ||
                    `${item.firstname || ""} ${item.lastname || ""}`.trim()
                  }}
                </span>
                <span
                  class="text-xs px-2 py-0.5 rounded-full theme-surface-raised theme-surface-muted theme-text-muted font-medium shrink-0 border theme-border-subtle theme-border-strong"
                >
                  {{ getMediaTypeLabel(item.media_type) }}
                </span>
              </div>

              <div
                class="text-xs theme-text-muted mt-1 flex items-center gap-2 truncate"
              >
                <span v-if="item.release_date || item.first_air_date">
                  {{
                    (item.release_date || item.first_air_date)?.substring(0, 4)
                  }}
                </span>
                <span
                  v-if="
                    (item.release_date || item.first_air_date) && item.overview
                  "
                  >&bull;</span
                >
                <span v-if="item.overview" class="truncate">
                  {{ item.overview }}
                </span>
              </div>
            </div>
          </button>
        </div>

        <div
          v-else-if="query.length >= 2"
          class="text-center py-8 theme-text-muted text-sm"
        >
          {{ t("search.noResults", "Aucun résultat trouvé") }}
        </div>
        <div v-else class="text-center py-8 theme-text-muted text-xs">
          {{ t("search.typeMore", "Tapez au moins 2 caractères...") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  SearchIcon,
  Loader2Icon,
  ImageIcon,
  Gamepad2Icon,
} from "lucide-vue-next";
import { fetchSearchData, type SearchResult } from "@app/shared-logic";
import { useSearchModal } from "../composables/useSearchModal";

const { isSearchOpen, closeSearch, toggleSearch } = useSearchModal();
const { t } = useI18n();
const router = useRouter();

watch(isSearchOpen, (val) => {
  if (val) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  } else {
    setTimeout(() => {
      query.value = "";
      results.value = [];
      selectedIndex.value = 0;
    }, 200);
  }
});

const query = ref("");
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);
const selectedIndex = ref(0);

const selectedFilter = ref<string>("all");

const getLabel = (key: string, fallback: string) => {
  const translation = t(key);
  return translation === key ? fallback : translation;
};

const filters = computed(() => [
  { label: getLabel("search.all", "All"), value: "all" },
  { label: getLabel("search.movie", "Movie"), value: "movie" },
  { label: getLabel("search.tv", "TV Show"), value: "tv" },
  { label: getLabel("search.actor", "Person"), value: "person" },
  { label: getLabel("search.voiceActor", "Voice Actor"), value: "voice_actor" },
  { label: getLabel("search.videoGame", "Video Game"), value: "video_game" },
  { label: getLabel("search.audiobook", "Audiobook"), value: "audiobook" },
  { label: getLabel("search.podcast", "Podcast"), value: "podcast" },
  {
    label: getLabel("search.advertisement", "Ad / Pub"),
    value: "advertisement",
  },
  { label: getLabel("search.toy", "Toy / Objet"), value: "toy" },
]);

const filteredResults = computed(() => {
  if (selectedFilter.value === "all") return results.value;
  return results.value.filter(
    (item) => item.media_type === selectedFilter.value,
  );
});

let debounceTimeout: any = null;

watch(query, (newVal) => {
  selectedIndex.value = 0;
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
  if (type === "movie") return getLabel("search.movie", "Film");
  if (type === "tv") return getLabel("search.tv", "Série");
  if (type === "person") return getLabel("search.actor", "Person");
  if (type === "voice_actor")
    return getLabel("search.voiceActor", "Comédien(ne)");
  if (type === "video_game") return getLabel("search.videoGame", "Jeu vidéo");
  if (type === "audiobook") return getLabel("search.audiobook", "Livre audio");
  if (type === "podcast") return getLabel("search.podcast", "Podcast");
  if (type === "advertisement")
    return getLabel("search.advertisement", "Publicité");
  if (type === "toy") return getLabel("search.toy", "Jouet / Objet");
  return type;
};

const localePath = useLocalePath();

const handleSelect = (item: SearchResult) => {
  closeSearch();
  if (item.media_type === "movie") {
    router.push(localePath(`/movie/${item.id}`));
  } else if (item.media_type === "tv") {
    router.push(localePath(`/show/${item.id}`));
  } else if (item.media_type === "voice_actor") {
    router.push(localePath(`/voice-actor/${item.id}`));
  } else if (item.media_type === "person") {
    router.push(localePath(`/actor/${item.id}`));
  } else if (item.media_type === "video_game") {
    router.push(localePath(`/game/${item.id}`));
  } else if (item.media_type === "audiobook") {
    router.push(localePath(`/audiobook/${item.id}`));
  } else if (item.media_type === "podcast") {
    router.push(localePath(`/podcast/${item.id}`));
  } else if (item.media_type === "advertisement") {
    router.push(localePath(`/advertisement/${item.id}`));
  } else if (item.media_type === "toy") {
    router.push(localePath(`/toy/${item.id}`));
  }
};

const selectCurrent = () => {
  if (
    filteredResults.value.length > 0 &&
    selectedIndex.value >= 0 &&
    selectedIndex.value < filteredResults.value.length
  ) {
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

const handleGlobalKeydown = (e: KeyboardEvent) => {
  const isInput = ["INPUT", "TEXTAREA"].includes(
    (e.target as HTMLElement)?.tagName,
  );
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    toggleSearch();
  } else if (e.key === "/" && !isInput) {
    e.preventDefault();
    isSearchOpen.value = true;
  }
};

onMounted(() => {
  if (typeof window !== "undefined") {
    (window as any).__openSearchModal = () => {
      isSearchOpen.value = true;
    };
  }
  window.addEventListener("keydown", handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleGlobalKeydown);
});
</script>
