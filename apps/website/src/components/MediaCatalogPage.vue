<template>
  <div class="mx-auto min-h-screen max-w-7xl p-4 md:p-6 lg:p-8">
    <header class="mb-8">
      <h1 class="mb-2 text-3xl font-bold theme-text md:text-4xl">
        {{ t("browse.title", { type: t(typeLabelKeys[type]) }) }}
      </h1>
      <p class="theme-text-secondary theme-text-muted">
        {{ t("browse.description", { type: t(typeLabelKeys[type]) }) }}
      </p>
    </header>

    <div
      v-if="pending && items.length === 0"
      aria-busy="true"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5"
    >
      <div
        v-for="index in 12"
        :key="index"
        class="aspect-[2/3] animate-pulse rounded-xl theme-surface-muted"
      />
    </div>

    <div v-else-if="error" role="alert" class="rounded-xl border p-6 theme-status-danger">
      <h2 class="mb-2 text-lg font-semibold">{{ t("common.error") }}</h2>
      <p>{{ error.message }}</p>
    </div>

    <p v-else-if="items.length === 0" class="py-16 text-center theme-text-muted">
      {{ t("browse.empty", { type: t(typeLabelKeys[type]) }) }}
    </p>

    <PaginatedResponsiveGrid
      v-else
      :items="items"
      :page="page"
      :page-size="pagination.pageSize"
      :total-items="pagination.totalItems"
      grid-class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6 lg:grid-cols-4 xl:grid-cols-5"
      :item-key="itemKey"
      @page-change="changePage"
    >
      <template #default="{ item }">
        <NuxtLink :to="localePath(item.href)" class="group block">
          <div
            class="mb-3 flex aspect-[2/3] items-center justify-center overflow-hidden rounded-xl theme-surface-muted"
          >
            <NuxtImg
              v-if="item.coverUrl && type === 'game'"
              :src="item.coverUrl"
              :alt="item.title"
              format="webp"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
            <img
              v-else-if="item.coverUrl"
              :src="item.coverUrl"
              :alt="item.title"
              loading="lazy"
              decoding="async"
              class="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            />
            <span v-else class="px-4 text-center text-sm font-medium theme-text-muted">
              {{ item.title }}
            </span>
          </div>
          <h2
            class="line-clamp-2 text-sm font-semibold theme-text theme-hover-primary-text md:text-base"
          >
            {{ item.title }}
          </h2>
        </NuxtLink>
      </template>
    </PaginatedResponsiveGrid>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { PaginatedResponse } from "@app/shared-logic";

type CatalogType = "game" | "audiobook" | "podcast" | "advertisement" | "toy";
type CatalogItem = {
  id: number;
  title: string;
  coverUrl: string | null;
  href: string;
};

const props = defineProps<{ type: CatalogType }>();
const { t } = useI18n();
const localePath = useLocalePathPrefix();
const page = ref(1);
const typeLabelKeys: Record<CatalogType, string> = {
  game: "search.videoGame",
  audiobook: "search.audiobook",
  podcast: "search.podcast",
  advertisement: "search.advertisement",
  toy: "search.toy",
};

const { data, pending, error } = await useAsyncData(
  () => `media-catalog:${props.type}:${page.value}`,
  () =>
    $fetch<PaginatedResponse<CatalogItem>>("/api/media-catalog", {
      query: { type: props.type, page: page.value, pageSize: 12 },
    }),
  {
    watch: [page],
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);

const items = computed(() => data.value?.data ?? []);
const pagination = computed(
  () => data.value?.pagination ?? { page: 1, pageSize: 12, totalItems: 0, totalPages: 1 },
);

const changePage = (nextPage: number): void => {
  page.value = nextPage;
};

const itemKey = (item: CatalogItem): number => item.id;

useHead({
  title: computed(() => t("browse.title", { type: t(typeLabelKeys[props.type]) })),
  link: [
    { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://image.tmdb.org" },
    { rel: "preconnect", href: "https://thetvdb.com", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://thetvdb.com" },
    { rel: "preconnect", href: "https://images.igdb.com", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://images.igdb.com" },
  ],
});

useSeoMeta({
  description: () => t("browse.description", { type: t(typeLabelKeys[props.type]) }),
});
</script>
