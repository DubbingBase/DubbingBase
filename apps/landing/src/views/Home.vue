<template>
  <div class="max-w-7xl mx-auto p-6">
    <header class="flex justify-between items-center mb-12 py-6 border-b border-gray-800">
      <h1 class="text-3xl font-extrabold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
        DubbingBase
      </h1>
      <nav>
        <router-link to="/" class="text-gray-300 hover:text-white transition">Home</router-link>
      </nav>
    </header>

    <main class="space-y-12">
      <!-- Trending Movies -->
      <section>
        <h2 class="text-2xl font-bold mb-6 text-white tracking-wide">Trending Movies</h2>
        <div v-if="isLoadingMovies" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-48 h-72 bg-gray-800 animate-pulse rounded-xl flex-shrink-0"></div>
        </div>
        <div v-else-if="errorMovies" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorMovies }}
        </div>
        <div v-else class="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          <div v-for="movie in trendingMovies" :key="movie.id" class="w-48 flex-shrink-0 group cursor-pointer transition-transform hover:-translate-y-1">
            <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-800">
              <img v-if="movie.poster_path" :src="'https://image.tmdb.org/t/p/w342' + movie.poster_path" :alt="movie.title" class="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
            </div>
            <h3 class="font-semibold text-sm text-gray-200 line-clamp-2">{{ movie.title }}</h3>
          </div>
        </div>
      </section>

      <!-- Trending Series -->
      <section>
        <h2 class="text-2xl font-bold mb-6 text-white tracking-wide">Trending Series</h2>
        <div v-if="isLoadingSeries" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-48 h-72 bg-gray-800 animate-pulse rounded-xl flex-shrink-0"></div>
        </div>
        <div v-else-if="errorSeries" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorSeries }}
        </div>
        <div v-else class="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
          <div v-for="show in trendingSeries" :key="show.id" class="w-48 flex-shrink-0 group cursor-pointer transition-transform hover:-translate-y-1">
            <div class="relative w-full h-72 rounded-xl overflow-hidden mb-3 bg-gray-800">
              <img v-if="show.poster_path" :src="'https://image.tmdb.org/t/p/w342' + show.poster_path" :alt="(show as any).name || (show as any).title" class="object-cover w-full h-full group-hover:scale-105 transition duration-300" />
            </div>
            <h3 class="font-semibold text-sm text-gray-200 line-clamp-2">{{ (show as any).name || (show as any).title }}</h3>
          </div>
        </div>
      </section>

      <!-- Top Voice Actors -->
      <section>
        <h2 class="text-2xl font-bold mb-6 text-white tracking-wide">Top Voice Actors</h2>
        <div v-if="isLoadingTopVoiceActors" class="flex gap-4 overflow-x-auto pb-4">
          <div v-for="i in 4" :key="i" class="w-32 flex-shrink-0 flex flex-col items-center gap-3">
            <div class="w-24 h-24 bg-gray-800 rounded-full animate-pulse"></div>
            <div class="h-4 w-20 bg-gray-800 rounded animate-pulse"></div>
          </div>
        </div>
        <div v-else-if="errorTopVoiceActors" class="text-red-400 bg-red-900/20 p-4 rounded-lg">
          {{ errorTopVoiceActors }}
        </div>
        <div v-else class="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
          <router-link
            v-for="va in topVoiceActors"
            :key="va.id"
            :to="{ name: 'VoiceActorDetails', params: { id: va.id } }"
            class="w-32 flex-shrink-0 flex flex-col items-center gap-3 group transition-transform hover:-translate-y-1"
          >
            <div class="relative w-24 h-24 rounded-full overflow-hidden bg-gray-800 border-2 border-transparent group-hover:border-blue-500 transition-colors">
              <img v-if="va.profile_picture" :src="va.profile_picture" :alt="va.firstname + ' ' + va.lastname" class="object-cover w-full h-full" />
              <div v-else class="w-full h-full flex items-center justify-center bg-gray-700 text-gray-400 text-2xl font-bold uppercase">
                {{ va.firstname?.[0] }}{{ va.lastname?.[0] }}
              </div>
            </div>
            <h3 class="font-semibold text-sm text-center text-gray-200">{{ va.firstname }} {{ va.lastname }}</h3>
          </router-link>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useHomeData } from '@app/shared-logic';
import { supabase } from '../api/supabase';

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
  loadHomeData
} = useHomeData(supabase);

onMounted(() => {
  loadHomeData();
});
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
