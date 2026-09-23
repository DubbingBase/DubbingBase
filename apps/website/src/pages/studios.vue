<template>
  <div class="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
    <div
      class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4"
    >
      <div>
        <h1 class="text-3xl md:text-4xl font-bold theme-text mb-2">
          {{ $t("footer.studios") }}
        </h1>
        <p class="theme-text-secondary theme-text-muted">
          {{ $t("studio.heroDescription") }}
        </p>

        <!-- Search bar -->
        <div class="mt-4 max-w-md" v-if="studios.length > 10">
          <div class="relative">
            <input
              v-model="searchInput"
              type="text"
              placeholder="Rechercher un studio..."
              class="w-full theme-surface-raised theme-surface-muted theme-text border-0 rounded-full px-6 py-2.5 text-sm theme-focus transition-shadow outline-none"
            />
          </div>
        </div>
      </div>
      <NuxtLink
        :to="localePath('/studio/new/edit')"
        class="inline-flex items-center justify-center px-4 py-2 theme-primary-bg theme-hover-primary-bg font-medium rounded-xl transition-colors shadow-sm self-start md:self-auto"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5 mr-2"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line></svg
        >{{ $t("studio.addStudio") }}</NuxtLink
      >
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
    >
      <div
        v-for="i in 10"
        :key="i"
        class="w-full h-48 md:h-64 theme-surface-muted animate-pulse rounded-xl"
      ></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="theme-status-danger p-6 rounded-xl border">
      <h3 class="text-lg font-semibold mb-2">{{ $t("common.error") }}</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Empty Search State -->
    <div
      v-else-if="studios.length === 0"
      class="text-center py-12 theme-text-muted"
    >
      {{ $t("studio.noResultsFor", { query: searchInput }) }}
    </div>

    <!-- Studios Grid -->
    <div v-else>
      <PaginatedResponsiveGrid
        :items="studios"
        :total-items="totalStudios"
        :page-size="pageSize"
        :page="page"
        grid-class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6"
        @update:page="page = $event"
      >
        <template #default="{ item: studio }">
          <NuxtLink
            :to="localePath('/studio/' + studio.id)"
            class="group cursor-pointer block"
          >
            <div
              class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 theme-surface-muted flex items-center justify-center shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl"
            >
              <img
                v-if="studio.logo_url"
                :src="studio.logo_url"
                :alt="studio.name"
                decoding="async"
                class="object-contain w-full h-full p-4 transition duration-500 bg-white"
              />
              <span v-else class="text-4xl font-bold theme-text-muted">{{
                studio.name?.charAt(0) || ""
              }}</span>
            </div>
            <h3
              class="font-semibold text-sm md:text-base theme-text line-clamp-2 theme-hover-primary-text transition-colors"
            >
              {{ studio.name }}
            </h3>
            <p
              v-if="studio.city || studio.country"
              class="text-xs theme-text-muted mt-1"
            >
              {{ [studio.city, studio.country].filter(Boolean).join(", ") }}
            </p>
          </NuxtLink>
        </template>
      </PaginatedResponsiveGrid>
      <span class="block text-xs theme-text-muted mt-4">{{
        $t("studio.studiosCount", {
          shown: studios.length,
          total: totalStudios,
        })
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { refDebounced } from "@vueuse/core";

const localePath = useLocalePath();

const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);

interface Studio {
  id: number;
  name: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
}

interface StudiosPage {
  studios: Studio[];
  total: number;
}

const pageSize = 20;
const page = ref(1);

const {
  data,
  pending: loading,
  error,
} = await useAsyncData<StudiosPage>(
  "studios-page",
  () =>
    $fetch<StudiosPage>("/api/get-studio-details", {
      query: {
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
        query: debouncedSearch.value.trim() || undefined,
      },
    }),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    watch: [debouncedSearch, page],
  },
);

const studios = computed(() => data.value?.studios ?? []);
const totalStudios = computed(() => data.value?.total ?? 0);

watch(debouncedSearch, () => {
  page.value = 1;
});

useHead({
  title: "Studios de Doublage - DubbingBase",
  meta: [
    {
      name: "description",
      content:
        "Parcourez la liste des studios de doublage et leurs projets associés.",
    },
  ],
});
</script>
