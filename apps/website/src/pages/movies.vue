<template>
  <div class="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
    <div class="mb-8">
      <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Films</h1>
      <p class="text-gray-600 dark:text-gray-400">Découvrez les films les plus populaires du moment.</p>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      <div v-for="i in 10" :key="i" class="w-full h-64 md:h-80 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-xl border border-red-200 dark:border-red-800">
      <h3 class="text-lg font-semibold mb-2">Erreur</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Movies Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      <NuxtLink 
        v-for="movie in movies" 
        :key="movie.id" 
        :to="$localePath('/movie/' + movie.id)"
        class="group cursor-pointer block"
      >
        <div class="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800 shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
          <NuxtImg 
            v-if="movie.poster_path" 
            :src="'https://image.tmdb.org/t/p/w342' + movie.poster_path" 
            :alt="movie.title" 
            format="webp" 
            loading="lazy" 
            class="object-cover w-full h-full group-hover:scale-105 transition duration-500" 
          />
        </div>
        <h3 class="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200 line-clamp-2 group-hover:text-cyan-500 transition-colors">
          {{ movie.title }}
        </h3>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const supabase = useSupabaseClient();

const movies = ref<any[]>([]);
const isLoading = ref(true);
const error = ref('');

useHead({
  title: 'Tous les Films - DubbingBase',
  meta: [
    {
      name: 'description',
      content: 'Parcourez la liste des films populaires et découvrez leurs comédiens de doublage.'
    }
  ]
});

onMounted(async () => {
  try {
    const { data, error: fetchError } = await supabase.functions.invoke('trending-movies');
    if (fetchError) throw fetchError;
    
    movies.value = data?.results || [];
  } catch (err: any) {
    error.value = err.message || 'Une erreur est survenue lors du chargement des films.';
  } finally {
    isLoading.value = false;
  }
});
</script>
