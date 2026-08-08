<template>
  <div class="min-h-screen overflow-x-hidden">
    <!-- Hero Search Section (Full Width) -->
    <section class="relative bg-gray-100 dark:bg-[#1a1a1a] py-16 md:py-24 px-4 flex flex-col items-center justify-center text-center overflow-hidden border-b border-gray-200 dark:border-gray-800">
      <div class="relative z-10 max-w-3xl w-full">
        <h1 class="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-4 md:mb-6 tracking-tight text-gray-900 dark:text-white">{{ $t('home.hero.title') }}</h1>
        <p class="text-lg md:text-xl text-gray-700 dark:text-gray-300 mb-8 font-medium">
          {{ $t('home.hero.subtitle') }}
        </p>
        <div class="relative w-full max-w-2xl mx-auto">
          <input
            type="text"
            readonly
            :placeholder="$t('home.hero.searchPlaceholder')"
            class="w-full bg-white text-gray-900 px-4 py-3 md:px-6 md:py-4 rounded-full text-base md:text-lg shadow-xl cursor-text outline-none pr-28 md:pr-32"
            @click="openSearch"
          />
          <button
            @click="openSearch"
            class="absolute right-1 top-1 bottom-1 bg-gradient-to-r from-[#00E5FF] to-cyan-500 hover:from-cyan-400 hover:to-cyan-600 text-gray-900 dark:text-white font-bold py-1.5 px-4 md:py-2 md:px-6 rounded-full transition-all text-sm md:text-base"
          >
            {{ $t('home.hero.searchButton') }}
          </button>
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto p-4 md:p-6 mt-4">
      <main class="space-y-8 md:space-y-12">
        <!-- Trending Movies -->
      <section>
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">{{ $t('home.trendingMovies') }}</h2>
        <div v-if="isLoadingMovies" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-48 h-72 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl flex-shrink-0"></div>
        </div>
        <div v-else-if="errorMovies" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorMovies }}
        </div>
        <div v-else ref="moviesScrollRef" class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 custom-scrollbar">
          <div v-for="movie in trendingMovies" :key="movie.id" class="w-48 flex-shrink-0 snap-start">
            <NuxtLink :to="$localePath('/movie/' + movie.id)" class="group transition-transform hover:-translate-y-1 block">
              <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800">
                <NuxtImg v-if="movie.poster_path" :src="'https://image.tmdb.org/t/p/w342' + movie.poster_path" :alt="movie.title" format="webp" loading="lazy" class="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
              </div>
              <h3 class="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{{ movie.title }}</h3>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Trending Series -->
      <section>
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">{{ $t('home.trendingSeries') }}</h2>
        <div v-if="isLoadingSeries" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-48 h-72 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl flex-shrink-0"></div>
        </div>
        <div v-else-if="errorSeries" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorSeries }}
        </div>
        <div v-else ref="seriesScrollRef" class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 custom-scrollbar">
          <div v-for="show in trendingSeries" :key="show.id" class="w-48 flex-shrink-0 snap-start">
            <NuxtLink :to="$localePath('/show/' + show.id)" class="group transition-transform hover:-translate-y-1 block">
              <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800">
                <NuxtImg v-if="show.poster_path" :src="'https://image.tmdb.org/t/p/w342' + show.poster_path" :alt="(show as any).name || (show as any).title" format="webp" loading="lazy" class="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
              </div>
              <h3 class="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{{ (show as any).name || (show as any).title }}</h3>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Trending Games -->
      <section>
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">{{ $t('game.trendingGames', 'Jeux du moment') }}</h2>
        <div v-if="isLoadingGames" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-48 h-72 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl flex-shrink-0"></div>
        </div>
        <div v-else-if="errorGames" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorGames }}
        </div>
        <div v-else ref="gamesScrollRef" class="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 custom-scrollbar">
          <div v-for="game in trendingGames" :key="game.id" class="w-48 flex-shrink-0 snap-start">
            <NuxtLink :to="$localePath('/game/' + game.id)" class="group transition-transform hover:-translate-y-1 block">
              <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800">
                <NuxtImg v-if="game.cover?.url" :src="game.cover.url" :alt="game.name" format="webp" loading="lazy" class="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
              </div>
              <h3 class="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{{ game.name }}</h3>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Top Voice Actors -->
      <section>
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">{{ $t('home.topVoiceActors') }}</h2>
        <div v-if="isLoadingTopVoiceActors" class="flex gap-4 overflow-x-auto pb-4 pt-4 px-2">
          <div v-for="i in 4" :key="i" class="w-36 flex-shrink-0 flex flex-col items-center gap-3">
            <div class="w-28 h-28 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
            <div class="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else-if="errorTopVoiceActors" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorTopVoiceActors }}
        </div>
        <div v-else ref="vaScrollRef" class="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 pt-4 px-2 custom-scrollbar">
          <div v-for="va in topVoiceActors" :key="va.id" class="w-36 flex-shrink-0 snap-start">
            <NuxtLink
              :to="$localePath('/voice-actor/' + va.id)"
              class="flex flex-col items-center gap-3 group transition-transform hover:-translate-y-1"
            >
              <div class="relative w-28 h-28 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 border-2 border-transparent group-hover:border-cyan-500 transition-colors shadow-md">
                <NuxtImg v-if="va.profile_picture" :src="va.profile_picture" :alt="va.firstname + ' ' + va.lastname" format="webp" loading="lazy" class="object-cover w-full h-full" />
                <div v-else class="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-3xl font-bold uppercase">
                  {{ va.firstname?.[0] }}{{ va.lastname?.[0] }}
                </div>
              </div>
              <h3 class="font-semibold text-sm text-center text-gray-800 dark:text-gray-200 w-full px-2">{{ va.firstname }} {{ va.lastname }}</h3>
            </NuxtLink>
          </div>
        </div>
      </section>
      <!-- Top Contributors (Admin Only) -->
      <section v-if="isAdmin">
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">Top Contributeurs (Admin)</h2>
        <div v-if="isLoadingTopContributors" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-32 flex-shrink-0 flex flex-col items-center gap-3">
            <div class="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
            <div class="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else-if="errorTopContributors" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorTopContributors }}
        </div>
        <div v-else ref="contributorsScrollRef" class="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 pt-4 px-2 custom-scrollbar">
          <div v-for="(contributor, index) in topContributors" :key="contributor.user_id" class="w-36 flex-shrink-0 snap-start">
            <div class="flex flex-col items-center gap-3 group transition-transform hover:-translate-y-1 relative">
              <div class="absolute -top-2 0 bg-yellow-400 text-black font-bold rounded-full w-8 h-8 flex items-center justify-center z-10 shadow-lg border-2 border-white dark:border-[#1a1a1a]" style="right: 8px;">
                #{{ index + 1 }}
              </div>
              <div class="relative w-28 h-28 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 border-2 border-transparent group-hover:border-yellow-400 transition-colors shadow-md">
                <NuxtImg v-if="contributor.raw_user_meta_data?.avatar_url" :src="contributor.raw_user_meta_data.avatar_url" :alt="contributor.raw_user_meta_data?.username || 'Utilisateur'" format="webp" loading="lazy" class="object-cover w-full h-full" />
                <div v-else class="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-3xl font-bold uppercase">
                  {{ (contributor.raw_user_meta_data?.username || 'U')[0] }}
                </div>
              </div>
              <div class="text-center w-full">
                <h3 class="font-semibold text-sm text-gray-800 dark:text-gray-200 truncate w-full px-2">{{ contributor.raw_user_meta_data?.username || 'Utilisateur' }}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">{{ contributor.score }} contributions</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useHomeData, fetchHomeData } from '@app/shared-logic';
import { useSearchModal } from '../composables/useSearchModal';
import { useDragScroll } from '../composables/useDragScroll';
import { ref, computed } from 'vue';

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const { t, locale } = useI18n();

const ogLocale = computed(() => {
  const map: Record<string, string> = {
    fr: 'fr_FR',
    en: 'en_US',
  };
  return map[locale.value] || 'en_US';
});

const supabase = useSupabaseClient();
const { openSearch } = useSearchModal();

const moviesScrollRef = ref<HTMLElement | null>(null);
const seriesScrollRef = ref<HTMLElement | null>(null);
const gamesScrollRef = ref<HTMLElement | null>(null);
const vaScrollRef = ref<HTMLElement | null>(null);
const contributorsScrollRef = ref<HTMLElement | null>(null);

useDragScroll(moviesScrollRef);
useDragScroll(seriesScrollRef);
useDragScroll(gamesScrollRef);
useDragScroll(vaScrollRef);
useDragScroll(contributorsScrollRef);

useHead({
  title: computed(() => t('home.meta.title')),
  meta: [
    {
      name: 'description',
      content: computed(() => {
        const desc = t('home.meta.description');
        return desc.length > 160 ? desc.substring(0, 157) + '...' : desc;
      }),
    },
    {
      name: 'keywords',
      content: computed(() => t('home.meta.keywords')),
    },
    { property: 'og:title', content: computed(() => t('home.meta.ogTitle')) },
    {
      property: 'og:description',
      content: computed(() => {
        const desc = t('home.meta.ogDescription');
        return desc.length > 160 ? desc.substring(0, 157) + '...' : desc;
      }),
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://dubbingbase.com/' },
    { property: 'og:image', content: 'https://dubbingbase.com/android-chrome-512x512.png' },
    { property: 'og:site_name', content: 'DubbingBase' },
    { property: 'og:locale', content: ogLocale },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: computed(() => t('home.meta.ogTitle')) },
    {
      name: 'twitter:description',
      content: computed(() => {
        const desc = t('home.meta.ogDescription');
        return desc.length > 160 ? desc.substring(0, 157) + '...' : desc;
      }),
    },
    { name: 'twitter:image', content: 'https://dubbingbase.com/android-chrome-512x512.png' },
  ],
  link: [{ rel: 'canonical', href: 'https://dubbingbase.com/' }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify([
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'DubbingBase',
          url: 'https://dubbingbase.com/',
          description: 'La base de données de référence du doublage et des comédiens de doublage français.',
          inLanguage: 'fr-FR',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://dubbingbase.com/search?q={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'DubbingBase',
          url: 'https://dubbingbase.com/',
          logo: 'https://dubbingbase.com/android-chrome-512x512.png',
          sameAs: [
            'https://x.com/DubbingBase',
            'https://instagram.com/dubbingbase'
          ]
        },
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          'itemListElement': [
            {
              '@type': 'SiteNavigationElement',
              'position': 1,
              'name': 'Films',
              'url': 'https://dubbingbase.com/movies'
            },
            {
              '@type': 'SiteNavigationElement',
              'position': 2,
              'name': 'Séries',
              'url': 'https://dubbingbase.com/series'
            },
            {
              '@type': 'SiteNavigationElement',
              'position': 3,
              'name': 'Comédiens de doublage',
              'url': 'https://dubbingbase.com/voice-actors'
            }
          ]
        }
      ]),
    },
  ],
});

const { data, pending } = useAsyncData('home-data', () => fetchHomeData(supabase), { lazy: true });

const trendingMovies = computed(() => data.value?.trendingMovies || []);
const trendingSeries = computed(() => data.value?.trendingSeries || []);
const trendingGames = computed(() => data.value?.trendingGames || []);
const topVoiceActors = computed(() => data.value?.topVoiceActors || []);
const topContributors = computed(() => data.value?.topContributors || []);

const isLoadingMovies = computed(() => pending.value);
const isLoadingSeries = computed(() => pending.value);
const isLoadingGames = computed(() => pending.value);
const isLoadingTopVoiceActors = computed(() => pending.value);
const isLoadingTopContributors = computed(() => pending.value);

const errorMovies = computed(() => data.value?.errorMovies || "");
const errorSeries = computed(() => data.value?.errorSeries || "");
const errorGames = computed(() => data.value?.errorGames || "");
const errorTopVoiceActors = computed(() => data.value?.errorTopVoiceActors || "");
const errorTopContributors = computed(() => data.value?.errorTopContributors || "");
</script>

<style scoped>
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
