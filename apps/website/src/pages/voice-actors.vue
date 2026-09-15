<template>
  <div class="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
    <div class="mb-8">
      <h1 class="text-3xl md:text-4xl font-bold theme-text mb-2">
        {{ t("home.trendingVoiceActors") }}
      </h1>
      <p class="theme-text-secondary theme-text-muted">
        {{ t("home.recentVoiceActors") }}
      </p>

      <!-- Barre de recherche locale -->
      <div class="mt-6 max-w-md">
        <div class="relative">
          <input
            v-model="searchInput"
            type="text"
            placeholder="Rechercher un comédien..."
            class="w-full theme-surface-raised theme-surface-muted theme-text border-0 rounded-full px-6 py-3 theme-focus transition-shadow outline-none"
          />
          <div
            class="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
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
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="isLoading"
      class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 pt-4"
    >
      <div
        v-for="i in 12"
        :key="i"
        class="flex flex-col items-center animate-pulse"
      >
        <div
          class="w-24 h-24 md:w-32 md:h-32 rounded-full theme-surface-muted mb-4"
        ></div>
        <div class="w-20 h-4 theme-surface-muted rounded"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="theme-status-danger p-6 rounded-xl border">
      <h3 class="text-lg font-semibold mb-2">{{ $t("common.error") }}</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredActors.length === 0"
      class="text-center py-12 theme-text-muted"
    >
      {{ $t("voiceActor.noResultsFor", { query: searchInput }) }}
    </div>

    <!-- Actors Grid -->
    <div v-else>
      <PaginatedResponsiveGrid
        :items="filteredActors"
        :page-size="pageSize"
        :page="page"
        :total-items="totalActors"
        grid-class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 pt-4"
        :item-key="(actor) => actor.id"
        @update:page="page = $event"
      >
        <template #default="{ item: actor }">
          <NuxtLink
            :key="actor.id"
            :to="localePath('/voice-actor/' + actor.id)"
            class="group cursor-pointer flex flex-col items-center"
          >
            <div
              class="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden mb-3 theme-surface-muted shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg border-2 border-transparent theme-hover-primary-border"
            >
              <NuxtImg
                v-if="actor.profile_picture_url"
                :src="actor.profile_picture_url"
                :alt="actor.firstname + ' ' + actor.lastname"
                format="webp"
                decoding="async"
                class="object-cover w-full h-full"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-3xl theme-text-muted font-bold theme-surface-raised theme-surface-muted"
              >
                {{ actor.firstname?.charAt(0) || ""
                }}{{ actor.lastname?.charAt(0) || "" }}
              </div>
            </div>
            <h3
              class="font-semibold text-sm md:text-base theme-text text-center theme-hover-primary-text transition-colors"
            >
              {{ actor.firstname }} {{ actor.lastname }}
            </h3>
          </NuxtLink>
        </template>
      </PaginatedResponsiveGrid>
      <span class="block text-xs theme-text-muted mt-4">{{
        $t("studio.actorsCount", {
          shown: filteredActors.length,
          total: totalActors,
        })
      }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { refDebounced } from "@vueuse/core";

const { t } = useI18n();
const localePath = useLocalePath();

const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);

interface VoiceActorSummary {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture_url: string | null;
}

interface VoiceActorPage {
  voice_actors: VoiceActorSummary[];
  total: number;
}

const pageSize = 48;
const page = ref(1);

watch(debouncedSearch, () => {
  page.value = 1;
});

useHead({
  title: "Tous les Comédiens de doublage - DubbingBase",
  meta: [
    {
      name: "description",
      content:
        "Parcourez la base de données complète des comédiens de doublage et voix françaises.",
    },
    {
      name: "keywords",
      content: computed(() => t("seo.voiceActors")),
    },
  ],
});

const {
  data,
  pending: isLoading,
  error,
} = useAsyncData(
  "voice-actors-page",
  async () => {
    return await $fetch<VoiceActorPage>("/api/list-voice-actors", {
      query: {
        limit: pageSize,
        offset: (page.value - 1) * pageSize,
        query: debouncedSearch.value.trim() || undefined,
      },
    });
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
    watch: [debouncedSearch, page],
  },
);

// Filtrage local simple avec debounce
const filteredActors = computed(() => {
  return data.value?.voice_actors ?? [];
});

const totalActors = computed(() => data.value?.total ?? 0);
</script>
