<template>
  <div class="max-w-7xl mx-auto p-4 md:p-6">
    <main class="space-y-8 md:space-y-12">
      <!-- Hero Search Section -->
      <section class="relative bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-2xl md:rounded-3xl p-6 md:p-16 flex flex-col items-center justify-center text-center overflow-hidden border border-gray-200 dark:border-gray-800">
        <div class="absolute inset-0 bg-[url('https://image.tmdb.org/t/p/original/t5zCBSB5xMDKcDqe91qahCOUYVV.jpg')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div class="relative z-10 max-w-3xl w-full">
          <h1 class="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 md:mb-6 tracking-tight">Bienvenue.</h1>
          <p class="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-6 md:mb-8 font-medium">
            Des millions de films, séries, et comédiens de doublage à découvrir. Explorez maintenant.
          </p>
          <div class="relative w-full">
            <input
              type="text"
              readonly
              placeholder="Rechercher un film, une série, un comédien..."
              class="w-full bg-white text-gray-900 px-4 py-3 md:px-6 md:py-4 rounded-full text-base md:text-lg shadow-xl cursor-text outline-none pr-28 md:pr-32"
              @click="openSearch"
            />
            <button
              @click="openSearch"
              class="absolute right-1 top-1 bottom-1 bg-gradient-to-r from-[#00E5FF] to-blue-500 hover:from-blue-400 hover:to-blue-600 text-gray-900 dark:text-white font-bold py-1.5 px-4 md:py-2 md:px-6 rounded-full transition-all text-sm md:text-base"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      <!-- Trending Movies -->
      <section>
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">Trending Movies</h2>
        <div v-if="isLoadingMovies" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-48 h-72 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl flex-shrink-0"></div>
        </div>
        <div v-else-if="errorMovies" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorMovies }}
        </div>
        <div v-else class="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          <NuxtLink :to="'/movie/' + movie.id" v-for="movie in trendingMovies" :key="movie.id" class="w-48 flex-shrink-0 group cursor-pointer transition-transform hover:-translate-y-1 block">
            <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800">
              <NuxtImg v-if="movie.poster_path" :src="'https://image.tmdb.org/t/p/w342' + movie.poster_path" :alt="movie.title" format="webp" loading="lazy" class="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
            </div>
            <h3 class="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{{ movie.title }}</h3>
          </NuxtLink>
        </div>
      </section>

      <!-- Trending Series -->
      <section>
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">Trending Series</h2>
        <div v-if="isLoadingSeries" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-48 h-72 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl flex-shrink-0"></div>
        </div>
        <div v-else-if="errorSeries" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorSeries }}
        </div>
        <div v-else class="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          <NuxtLink :to="'/show/' + show.id" v-for="show in trendingSeries" :key="show.id" class="w-48 flex-shrink-0 group cursor-pointer transition-transform hover:-translate-y-1 block">
            <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800">
              <NuxtImg v-if="show.poster_path" :src="'https://image.tmdb.org/t/p/w342' + show.poster_path" :alt="(show as any).name || (show as any).title" format="webp" loading="lazy" class="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
            </div>
            <h3 class="font-semibold text-sm text-gray-800 dark:text-gray-200 line-clamp-2">{{ (show as any).name || (show as any).title }}</h3>
          </NuxtLink>
        </div>
      </section>

      <!-- Top Voice Actors -->
      <section>
        <h2 class="text-xl md:text-2xl font-bold mb-4 md:mb-6 text-gray-900 dark:text-white tracking-wide">Top Voice Actors</h2>
        <div v-if="isLoadingTopVoiceActors" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-32 flex-shrink-0 flex flex-col items-center gap-3">
            <div class="w-24 h-24 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
            <div class="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else-if="errorTopVoiceActors" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorTopVoiceActors }}
        </div>
        <div v-else class="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
          <NuxtLink
            v-for="va in topVoiceActors"
            :key="va.id"
            :to="'/voice-actor/' + va.id"
            class="w-32 flex-shrink-0 flex flex-col items-center gap-3 group transition-transform hover:-translate-y-1"
          >
            <div class="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 border-2 border-transparent group-hover:border-blue-500 transition-colors">
              <NuxtImg v-if="va.profile_picture" :src="va.profile_picture" :alt="va.firstname + ' ' + va.lastname" format="webp" loading="lazy" class="object-cover w-full h-full" />
              <div v-else class="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-2xl font-bold uppercase">
                {{ va.firstname?.[0] }}{{ va.lastname?.[0] }}
              </div>
            </div>
            <h3 class="font-semibold text-sm text-center text-gray-800 dark:text-gray-200">{{ va.firstname }} {{ va.lastname }}</h3>
          </NuxtLink>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { useHomeData, fetchHomeData } from '@app/shared-logic';
import { useSearchModal } from '../composables/useSearchModal';

const supabase = useSupabaseClient();
const { openSearch } = useSearchModal();

useHead({
  title: 'DubbingBase - La base de données du doublage et comédiens de doublage',
  meta: [
    {
      name: 'description',
      content: 'Découvrez DubbingBase, la base de données de référence du doublage français. Retrouvez les fiches des comédiens de doublage, leurs rôles et castings vocaux de vos films et séries préférés.',
    },
    {
      name: 'keywords',
      content: 'doublage, comédiens de doublage, voix française, castings vocaux, films, séries, fiches acteurs',
    },
    { property: 'og:title', content: 'DubbingBase - La base de données du doublage' },
    {
      property: 'og:description',
      content: 'Retrouvez la base de données complète des comédiens de doublage et voix françaises.',
    },
    { property: 'og:type', content: 'website' },
    { property: 'og:url', content: 'https://dubbingbase.com/' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: 'DubbingBase - La base de données du doublage' },
    {
      name: 'twitter:description',
      content: 'Retrouvez la base de données complète des comédiens de doublage et voix françaises.',
    },
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
          logo: 'https://dubbingbase.com/logo.png',
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

const { data } = await useAsyncData('home-data', () => fetchHomeData(supabase));

const {
  trendingMovies,
  trendingSeries,
  topVoiceActors,
  isLoadingMovies,
  isLoadingSeries,
  isLoadingTopVoiceActors,
  errorMovies,
  errorSeries,
  errorTopVoiceActors,
} = useHomeData(supabase, data.value);
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
