<template>
  <div class="min-h-screen theme-bg theme-text">
    <div class="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
      <header class="mb-8">
        <h1 class="text-3xl font-bold tracking-tight md:text-4xl">
          {{ t("search.title") }}
        </h1>
        <p class="mt-2 theme-text-secondary">
          {{ t("search.description") }}
        </p>
      </header>

      <div
        class="sticky top-[68px] z-10 -mx-4 mb-6 space-y-4 border-b px-4 pb-4 backdrop-blur-xl theme-bg theme-border-subtle md:-mx-6 md:px-6"
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
            data-testid="search-input"
            autofocus
            :placeholder="t('search.placeholder')"
            :aria-label="t('search.placeholder')"
            class="w-full rounded-full border py-3 pl-12 pr-4 text-base outline-none theme-border theme-surface-raised theme-text theme-placeholder theme-focus"
            @keydown.down.prevent="navigateResults(1)"
            @keydown.up.prevent="navigateResults(-1)"
            @keydown.enter.prevent="selectCurrent"
          />
        </div>
        <SearchFilters v-model="selectedFilter" />
      </div>

      <section aria-live="polite" aria-atomic="true">
        <div
          v-if="loading"
          role="status"
          aria-busy="true"
          class="flex flex-col items-center justify-center gap-3 py-16 theme-text-muted"
        >
          <Loader2Icon class="h-7 w-7 animate-spin" />
          <span>{{ t("common.searching") }}</span>
        </div>

        <div v-else-if="filteredResults.length > 0" class="flex flex-col gap-1">
          <SearchResultItem
            v-for="(item, index) in filteredResults"
            :key="`${item.media_type}-${item.id}`"
            :result="item"
            :media-type-label="getMediaTypeLabel(item.media_type)"
            :selected="index === selectedIndex"
            @select="handleSelect(item)"
          />
        </div>

        <div
          v-else-if="queryReady"
          class="py-16 text-center text-sm theme-text-muted"
        >
          {{ t("search.noResults") }}
        </div>
        <div v-else class="py-16 text-center text-sm theme-text-muted">
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

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();

const queryFromRoute = (value: unknown): string =>
  typeof value === "string" ? value : "";

const query = ref(queryFromRoute(route.query.q));
const results = ref<SearchResult[]>([]);
const loading = ref(false);
const selectedFilter = ref<SearchFilter>("all");
const selectedIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);

const hasQuery = computed(() => query.value.trim().length > 0);
const queryReady = computed(() => query.value.trim().length >= 2);
const filteredResults = computed(() => {
  if (selectedFilter.value === "all") return results.value;
  return results.value.filter(
    (item) => item.media_type === selectedFilter.value,
  );
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

const getMediaTypeLabel = (type: SearchResult["media_type"]): string =>
  t(mediaTypeLabelKeys[type]);

let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
let searchVersion = 0;

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

const performSearch = async (
  searchTerm: string,
  version: number,
): Promise<void> => {
  try {
    const data = await fetchSearchData(searchTerm);
    if (version === searchVersion) results.value = data;
  } finally {
    if (version === searchVersion) loading.value = false;
  }
};

const scheduleSearch = (value: string): void => {
  const trimmed = value.trim();
  searchVersion += 1;
  const version = searchVersion;
  selectedIndex.value = 0;
  syncQueryToUrl(trimmed);

  if (debounceTimeout) clearTimeout(debounceTimeout);
  if (trimmed.length < 2) {
    results.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  debounceTimeout = setTimeout(() => {
    void performSearch(trimmed, version);
  }, 300);
};

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
    { rel: "canonical", href: "https://dubbingbase.com/search" },
    { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://image.tmdb.org" },
    { rel: "preconnect", href: "https://images.igdb.com", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://images.igdb.com" },
  ],
});

useSeoMeta({
  description: () => t("search.description"),
  robots: computed(() =>
    hasQuery.value ? "noindex, follow" : "index, follow",
  ),
});

onMounted(() => {
  void nextTick(() => searchInput.value?.focus());
  scheduleSearch(query.value);
});

onUnmounted(() => {
  if (debounceTimeout) clearTimeout(debounceTimeout);
  searchVersion += 1;
});
</script>
