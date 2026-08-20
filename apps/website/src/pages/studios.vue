<template>
  <div class="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
    <div class="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Studios</h1>
        <p class="text-gray-600 dark:text-gray-400">Découvrez les studios de doublage.</p>
      </div>
      <NuxtLink 
        :to="$localePath('/studio/new/edit')"
        class="inline-flex items-center justify-center px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-medium rounded-xl transition-colors shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        Ajouter un studio
      </NuxtLink>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      <div v-for="i in 10" :key="i" class="w-full h-48 md:h-64 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-xl border border-red-200 dark:border-red-800">
      <h3 class="text-lg font-semibold mb-2">Erreur</h3>
      <p>{{ error }}</p>
    </div>

    <!-- Studios Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      <NuxtLink 
        v-for="studio in studios" 
        :key="studio.id" 
        :to="$localePath('/studio/' + studio.id)"
        class="group cursor-pointer block"
      >
        <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-xl">
          <img 
            v-if="studio.logo_url" 
            :src="studio.logo_url" 
            :alt="studio.name" 
            loading="lazy" 
            class="object-contain w-full h-full p-4 transition duration-500 bg-white" 
          />
          <span v-else class="text-4xl font-bold text-gray-400">{{ studio.name.charAt(0) }}</span>
        </div>
        <h3 class="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200 line-clamp-2 group-hover:text-cyan-500 transition-colors">
          {{ studio.name }}
        </h3>
        <p v-if="studio.city || studio.country" class="text-xs text-gray-500 mt-1">
          {{ [studio.city, studio.country].filter(Boolean).join(', ') }}
        </p>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useStudioData, fetchStudiosData } from '@app/shared-logic';

const supabase = useSupabaseClient();

const { data: initialStudios } = await useAsyncData('studios-page', () => fetchStudiosData());

const { studios, loading, error } = useStudioData(initialStudios.value);

useHead({
  title: 'Studios de Doublage - DubbingBase',
  meta: [
    {
      name: 'description',
      content: 'Parcourez la liste des studios de doublage et leurs projets associés.'
    }
  ]
});
</script>
