<template>
  <div class="min-h-screen theme-bg theme-text">
    <div class="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <header class="mb-4 md:mb-8">
        <h1 class="text-3xl font-bold tracking-tight md:text-4xl">
          {{ t("search.title") }}
        </h1>
        <p class="mt-2 theme-text-secondary">
          {{ t("search.description") }}
        </p>
      </header>

      <div
        class="sticky top-[68px] z-10 -mx-4 mb-4 space-y-3 border-b px-4 pb-3 backdrop-blur-xl theme-bg theme-border-subtle md:-mx-6 md:mb-6 md:space-y-4 md:px-6 md:pb-4"
      >
        <label class="sr-only" for="search-page-input">
          {{ t("search.placeholder") }}
        </label>
        <div class="relative">
          <SearchIcon
            class="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 theme-text-muted"
          />
          <input
            id="search-page-input"
            ref="searchInput"
            v-model="query"
            type="search"
            role="combobox"
            data-testid="search-input"
            autofocus
            :placeholder="t('search.placeholder')"
            class="w-full rounded-full border py-3 pl-12 pr-4 text-base outline-none theme-border theme-surface-raised theme-text theme-placeholder theme-focus"
            :aria-expanded="!loading && filteredResults.length > 0"
            :aria-controls="filteredResults.length > 0 ? 'search-results-listbox' : undefined"
            :aria-activedescendant="activeResultId"
            @keydown.down.prevent="navigateResults(1)"
            @keydown.up.prevent="navigateResults(-1)"
            @keydown.enter.prevent="selectCurrent"
          />
        </div>
        <SearchFilters v-model="selectedFilter" />
      </div>

      <section id="search-results" aria-live="polite" aria-atomic="false" :aria-busy="loading">
        <div v-if="loading && filteredResults.length > 0" role="status" class="sr-only">
          {{ t("common.searching") }}
        </div>
        <div
          v-if="loading && filteredResults.length === 0"
          role="status"
          aria-busy="true"
          class="flex flex-col items-center justify-center gap-3 py-8 theme-text-muted md:py-16"
        >
          <Loader2Icon class="h-7 w-7 animate-spin" />
          <span>{{ t("common.searching") }}</span>
        </div>

        <div
          v-else-if="filteredResults.length > 0"
          id="search-results-listbox"
          role="listbox"
          :aria-label="t('search.results')"
          :class="['flex flex-col gap-1', loading ? 'pointer-events-none opacity-60' : '']"
        >
          <SearchResultItem
            v-for="(item, index) in filteredResults"
            :key="`${item.media_type}-${item.id}`"
            :result="item"
            :media-type-label="getMediaTypeLabel(item.media_type)"
            :selected="index === selectedIndex"
            :disabled="loading"
            :id="resultId(item)"
            role="option"
            :aria-selected="index === selectedIndex"
            @select="handleSelect(item)"
          />
        </div>

        <div
          v-else-if="!loading && error"
          role="alert"
          class="py-8 text-center text-sm theme-text-muted md:py-12"
        >
          <p>{{ t("search.error") }}</p>
          <button
            type="button"
            class="mt-3 rounded-lg px-4 py-2 theme-focus theme-selected"
            @click="retrySearch"
          >
            {{ t("search.retry") }}
          </button>
        </div>
        <div
          v-else-if="!loading && queryReady"
          class="py-8 text-center text-sm theme-text-muted md:py-16"
        >
          {{ t("search.noResults") }}
        </div>
        <div v-else-if="!loading" class="py-8 text-center text-sm theme-text-muted md:py-16">
          {{ query.trim() ? t("search.typeMore") : t("search.emptyState") }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Loader2Icon, SearchIcon } from "lucide-vue-next";
import { fetchSearchData, type SearchResult } from "@app/shared-logic";
import SearchFilters from "../components/SearchFilters.vue";
import SearchResultItem from "../components/SearchResultItem.vue";
import type { SearchFilter } from "../utils/search-routes";
import { getSearchResultRoute } from "../utils/search-routes";

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const queryFromRoute = (value: unknown): string => (typeof value === "string" ? value : "");

const query = ref(queryFromRoute(route.query.q));
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const error = ref(false);
const selectedFilter = ref<SearchFilter>("all");
const selectedIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);
let activeController: AbortController | null = null;

const hasQuery = computed(() => query.value.trim().length > 0);
const queryReady = computed(() => query.value.trim().length >= 2);
const filteredResults = computed(() => {
  if (selectedFilter.value === "all") return results.value;
  return results.value.filter((item) => item.media_type === selectedFilter.value);
});

const mediaTypeLabelKeys: Record<SearchResult["media_type"], string> = {
  movie: "search.movie",
  tv: "search.tv",
  person: "search.actor",
  voice_actor: "search.voiceActor",
  video_game: "search.videoGame",
  audiobook: "search.audiobook",
  podcast: "search.podcast",
  advertisement: "search.advertisement",
  toy: "search.toy",
};

const getMediaTypeLabel = (type: SearchResult["media_type"]): string => t(mediaTypeLabelKeys[type]);
const resultId = (item: SearchResult): string => `search-result-${item.media_type}-${item.id}`;
const activeResultId = computed(() => {
  const item = filteredResults.value[selectedIndex.value];
  return item ? resultId(item) : undefined;
});

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let searchVersion = 0;
const markKeyboardModality = (event: KeyboardEvent): void => {
  if (
    event.isComposing ||
    event.keyCode === 229 ||
    !["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
  ) {
    return;
  }

  document.documentElement.dataset.inputModality = "keyboard";
};
const markPointerModality = (event: PointerEvent): void => {
  document.documentElement.dataset.inputModality = event.pointerType;
};

const syncQueryToUrl = (value: string): void => {
  const currentQuery = queryFromRoute(route.query.q);
  if (currentQuery === value) return;

  void router.replace({
    query: {
      ...route.query,
      q: value || undefined,
    },
  });
};

const performSearch = async (searchTerm: string, version: number): Promise<void> => {
  const controller = new AbortController();
  activeController = controller;
  try {
    const data = await fetchSearchData(searchTerm, controller.signal, String(locale.value));
    if (version === searchVersion) {
      results.value = data;
      error.value = false;
    }
  } catch {
    if (version === searchVersion && !controller.signal.aborted) {
      results.value = [];
      error.value = true;
    }
  } finally {
    if (version === searchVersion) loading.value = false;
    if (activeController === controller) activeController = null;
  }
};

const scheduleSearch = (value: string): void => {
  const trimmed = value.trim();
  searchVersion += 1;
  activeController?.abort();
  const version = searchVersion;
  selectedIndex.value = 0;
  syncQueryToUrl(trimmed);

  if (debounceTimeout) clearTimeout(debounceTimeout);
  if (trimmed.length < 2) {
    results.value = [];
    loading.value = false;
    error.value = false;
    return;
  }

  loading.value = true;
  debounceTimeout = setTimeout(() => {
    void performSearch(trimmed, version);
  }, 300);
};

const retrySearch = (): void => scheduleSearch(query.value);

const handleSelect = (item: SearchResult): void => {
  void router.push(localePath(getSearchResultRoute(item)));
};

const selectCurrent = (): void => {
  if (loading.value) return;

  const item = filteredResults.value[selectedIndex.value];
  if (item) handleSelect(item);
};

const navigateResults = (direction: number): void => {
  if (loading.value || filteredResults.value.length === 0) return;
  selectedIndex.value = Math.min(
    Math.max(selectedIndex.value + direction, 0),
    filteredResults.value.length - 1,
  );
};

watch(query, scheduleSearch);
watch(selectedFilter, () => {
  selectedIndex.value = 0;
});
watch(
  () => route.query.q,
  (value) => {
    const nextQuery = queryFromRoute(value);
    if (nextQuery !== query.value.trim()) query.value = nextQuery;
  },
);

useHead({
  title: computed(() => t("search.title")),
  link: [
    { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://image.tmdb.org" },
    { rel: "preconnect", href: "https://images.igdb.com", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://images.igdb.com" },
  ],
});

useSeoMeta({
  description: () => t("search.description"),
  robots: computed(() => (hasQuery.value ? "noindex, follow" : "index, follow")),
});

onMounted(() => {
  document.addEventListener("keydown", markKeyboardModality, true);
  document.addEventListener("pointerdown", markPointerModality, true);
  void nextTick(() => searchInput.value?.focus());
  scheduleSearch(query.value);
});

onUnmounted(() => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  activeController?.abort();
  document.removeEventListener("keydown", markKeyboardModality, true);
  document.removeEventListener("pointerdown", markPointerModality, true);
  delete document.documentElement.dataset.inputModality;
  searchVersion += 1;
});
</script>
