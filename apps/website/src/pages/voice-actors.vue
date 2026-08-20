<template>
  <div class="container mx-auto px-4 py-8 max-w-7xl">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Comédiens de doublage
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Explorez l'ensemble des comédiens et comédiennes répertoriés sur DubbingBase.
        </p>
      </div>

      <!-- Search Input -->
      <div class="w-full md:w-72">
        <input 
          v-model="searchQuery" 
          type="text" 
          placeholder="Rechercher un comédien..."
          class="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-colors"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-12 text-red-500">
      Une erreur est survenue lors du chargement des comédiens.
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredActors.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
      Aucun comédien trouvé pour "{{ searchQuery }}".
    </div>

    <!-- Actors Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 pt-4">
      <NuxtLink 
        v-for="actor in filteredActors" 
        :key="actor.id" 
        :to="localePath('/voice-actor/' + actor.id)"
        class="group cursor-pointer flex flex-col items-center"
      >
        <div class="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800 shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg border-2 border-transparent group-hover:border-cyan-500">
          <NuxtImg 
            v-if="actor.profile_picture_url" 
            :src="actor.profile_picture_url" 
            :alt="actor.firstname + ' ' + actor.lastname" 
            format="webp" 
            loading="lazy" 
            class="object-cover w-full h-full" 
          />
          <div v-else class="w-full h-full flex items-center justify-center text-3xl text-gray-400 font-bold bg-gray-100 dark:bg-gray-700">
            {{ actor.firstname.charAt(0) }}{{ actor.lastname.charAt(0) }}
          </div>
        </div>
        <h3 class="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200 text-center group-hover:text-cyan-500 transition-colors">
          {{ actor.firstname }} {{ actor.lastname }}
        </h3>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const { t } = useI18n();
const localePath = useLocalePath();

const searchQuery = ref('');

useHead({
  title: 'Tous les Comédiens de doublage - DubbingBase',
  meta: [
    {
      name: 'description',
      content: 'Parcourez la base de données complète des comédiens de doublage et voix françaises.'
    },
    {
      name: 'keywords',
      content: computed(() => t('seo.voiceActors'))
    }
  ]
});

const { data, pending: isLoading, error } = useAsyncData('voice-actors-page', async () => {
  const data = await $fetch<{ voice_actors: any[] }>('/api/list-voice-actors', { method: 'POST' });
  return data?.voice_actors || [];
});

const allActors = computed(() => data.value || []);

// Filtrage local simple
const filteredActors = computed(() => {
  if (!searchQuery.value.trim()) return allActors.value;
  const query = searchQuery.value.toLowerCase().trim();
  return allActors.value.filter((actor: any) => {
    const fullName = `${actor.firstname} ${actor.lastname}`.toLowerCase();
    return fullName.includes(query);
  });
});
</script>
