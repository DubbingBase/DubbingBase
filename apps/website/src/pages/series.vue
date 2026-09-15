<template>
  <div class="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
    <div class="mb-8">
      <h1 class="text-3xl md:text-4xl font-bold theme-text mb-2">
        {{ $t("footer.series") }}
      </h1>
      <p class="theme-text-secondary theme-text-muted">
        {{ $t("series.heroDescription") }}
      </p>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
    >
      <div
        v-for="i in 10"
        :key="i"
        class="w-full h-64 md:h-80 theme-surface-muted animate-pulse rounded-xl"
      ></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="theme-status-danger p-6 rounded-xl border">
      <h3 class="text-lg font-semibold mb-2">{{ $t("common.error") }}</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Series Grid -->
    <div
      v-else
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
    >
      <NuxtLink
        v-for="serie in series"
        :key="serie.id"
        :to="localePath('/show/' + serie.id)"
        class="group cursor-pointer block"
      >
        <div
          class="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 theme-surface-muted shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
        >
          <NuxtImg
            v-if="serie.poster_path"
            :src="'https://image.tmdb.org/t/p/w342' + serie.poster_path"
            :alt="serie.name"
            format="webp"
            decoding="async"
            class="object-cover w-full h-full transition duration-500"
          />
        </div>
        <h3
          class="font-semibold text-sm md:text-base theme-text line-clamp-2 theme-hover-primary-text transition-colors"
        >
          {{ serie.name }}
        </h3>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const { t } = useI18n();
const localePath = useLocalePath();

useHead({
  title: "Toutes les Séries - DubbingBase",
  meta: [
    {
      name: "description",
      content:
        "Parcourez la liste des séries populaires et découvrez leurs comédiens de doublage.",
    },
    {
      name: "keywords",
      content: computed(() => t("seo.series")),
    },
  ],
  link: [
    { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://image.tmdb.org" },
  ],
});

const {
  data,
  pending: isLoading,
  error,
} = useAsyncData(
  "series-page",
  async () => {
    const data = await $fetch<{ results: any[] }>("/api/trending/shows");
    return data?.results || [];
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const series = computed(() => data.value || []);
</script>
