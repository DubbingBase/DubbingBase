<template>
  <div class="space-y-8 md:space-y-12">
    <!-- Trending Games -->
    <section v-if="!errorGames">
      <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 theme-text tracking-wide">
        {{ $t("game.trendingGames", "Jeux du moment") }}
      </h2>
      <div v-if="isLoadingGames" class="home-card-rail flex gap-4 overflow-x-auto pb-4">
        <div
          v-for="i in 4"
          :key="i"
          class="w-48 h-72 theme-surface-muted animate-pulse rounded-xl flex-shrink-0"
        ></div>
      </div>
      <div
        v-else
        ref="gamesScrollRef"
        class="home-card-rail flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 custom-scrollbar"
      >
        <div v-for="game in trendingGames" :key="game.id" class="w-48 flex-shrink-0 snap-start">
          <NuxtLink
            :to="localePath('/game/' + game.id)"
            class="group transition-transform hover:-translate-y-1 block"
          >
            <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 theme-surface-muted">
              <NuxtImg
                v-if="game.cover?.url"
                :src="game.cover.url"
                :alt="game.name"
                format="webp"
                class="object-cover w-full h-full transition duration-300"
                loading="lazy"
                decoding="async"
              />
            </div>
            <h3 class="font-semibold text-sm theme-text line-clamp-2">
              {{ game.name }}
            </h3>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Trending Voice Actors -->
    <section v-if="!errorTrendingVoiceActors">
      <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 theme-text tracking-wide">
        {{ $t("home.trendingVoiceActors") }}
      </h2>
      <div
        v-if="isLoadingTrendingVoiceActors"
        class="home-actor-rail flex gap-4 overflow-x-auto pb-4 pt-4 px-2"
      >
        <div v-for="i in 4" :key="i" class="w-36 flex-shrink-0 flex flex-col items-center gap-3">
          <div class="w-28 h-28 theme-surface-muted rounded-full animate-pulse"></div>
          <div class="h-4 w-20 theme-surface-muted rounded animate-pulse"></div>
        </div>
      </div>
      <div
        v-else
        ref="vaScrollRef"
        class="home-actor-rail flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 pt-4 px-2 custom-scrollbar"
      >
        <div v-for="va in trendingVoiceActors" :key="va.id" class="w-36 flex-shrink-0 snap-start">
          <NuxtLink
            :to="localePath('/voice-actor/' + va.id)"
            class="flex flex-col items-center gap-3 group transition-transform hover:-translate-y-1 relative"
          >
            <div
              class="absolute top-0 right-2 bg-gradient-to-br from-cyan-400 to-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-lg border-2 border-white theme-border flex items-center justify-center min-w-[28px] z-10 transition-transform group-hover:scale-110 group-hover:rotate-6"
            >
              {{ va.work_count }}
            </div>
            <div
              class="relative w-28 h-28 rounded-full overflow-hidden theme-surface-muted border-2 border-transparent theme-hover-primary-border transition-colors shadow-md"
            >
              <NuxtImg
                v-if="va.profile_picture"
                :src="va.profile_picture"
                :alt="va.firstname + ' ' + va.lastname"
                format="webp"
                class="object-cover w-full h-full"
                loading="lazy"
                decoding="async"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center theme-surface-muted theme-text-muted text-3xl font-bold uppercase"
              >
                {{ va.firstname?.[0] }}{{ va.lastname?.[0] }}
              </div>
            </div>
            <h3 class="font-semibold text-sm text-center theme-text w-full px-2">
              {{ va.firstname }} {{ va.lastname }}
            </h3>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Top Voice Actors -->
    <section v-if="!errorTopVoiceActors">
      <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 theme-text tracking-wide">
        {{ $t("home.topVoiceActors") }}
      </h2>
      <div
        v-if="isLoadingTopVoiceActors"
        class="home-actor-rail flex gap-4 overflow-x-auto pb-4 pt-4 px-2"
      >
        <div v-for="i in 4" :key="i" class="w-36 flex-shrink-0 flex flex-col items-center gap-3">
          <div class="w-28 h-28 theme-surface-muted rounded-full animate-pulse"></div>
          <div class="h-4 w-20 theme-surface-muted rounded animate-pulse"></div>
        </div>
      </div>
      <div
        v-else
        class="home-actor-rail flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 pt-4 px-2 custom-scrollbar"
      >
        <div v-for="va in topVoiceActors" :key="va.id" class="w-36 flex-shrink-0 snap-start">
          <NuxtLink
            :to="localePath('/voice-actor/' + va.id)"
            class="flex flex-col items-center gap-3 group transition-transform hover:-translate-y-1"
          >
            <div
              class="relative w-28 h-28 rounded-full overflow-hidden theme-surface-muted border-2 border-transparent theme-hover-primary-border transition-colors shadow-md"
            >
              <NuxtImg
                v-if="va.profile_picture"
                :src="va.profile_picture"
                :alt="va.firstname + ' ' + va.lastname"
                format="webp"
                class="object-cover w-full h-full"
                loading="lazy"
                decoding="async"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center theme-surface-muted theme-text-muted text-3xl font-bold uppercase"
              >
                {{ va.firstname?.[0] }}{{ va.lastname?.[0] }}
              </div>
            </div>
            <h3 class="font-semibold text-sm text-center theme-text w-full px-2">
              {{ va.firstname }} {{ va.lastname }}
            </h3>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { HomeDataPayload } from "@app/shared-logic";
import { toRefs } from "vue";
import { useDragScroll } from "../composables/useDragScroll";

type Props = {
  hydrateOnVisible?: boolean;
  trendingGames: HomeDataPayload["trendingGames"];
  isLoadingGames: boolean;
  errorGames: HomeDataPayload["errorGames"];
  trendingVoiceActors: HomeDataPayload["trendingVoiceActors"];
  isLoadingTrendingVoiceActors: boolean;
  errorTrendingVoiceActors: HomeDataPayload["errorTrendingVoiceActors"];
  topVoiceActors: HomeDataPayload["topVoiceActors"];
  isLoadingTopVoiceActors: boolean;
  errorTopVoiceActors: HomeDataPayload["errorTopVoiceActors"];
};

const props = defineProps<Props>();

const {
  trendingGames,
  isLoadingGames,
  errorGames,
  trendingVoiceActors,
  isLoadingTrendingVoiceActors,
  errorTrendingVoiceActors,
  topVoiceActors,
  isLoadingTopVoiceActors,
  errorTopVoiceActors,
} = toRefs(props);

const gamesScrollRef = ref<HTMLElement | null>(null);
const vaScrollRef = ref<HTMLElement | null>(null);

useDragScroll(gamesScrollRef);
useDragScroll(vaScrollRef);
</script>

<style scoped>
.home-card-rail {
  content-visibility: auto;
  contain-intrinsic-size: auto 22rem;
}

.home-actor-rail {
  content-visibility: auto;
  contain-intrinsic-size: auto 12rem;
}

.custom-scrollbar::-webkit-scrollbar {
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(31, 41, 55, 0.5);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(75, 85, 99, 0.8);
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(107, 114, 128, 1);
}
</style>
