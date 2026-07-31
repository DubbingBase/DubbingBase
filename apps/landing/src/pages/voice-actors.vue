<template>
  <div class="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
    <div class="mb-8">
      <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">Comédiens de doublage</h1>
      <p class="text-gray-600 dark:text-gray-400">Parcourez la base de données des voix françaises.</p>
      
      <!-- Barre de recherche locale -->
      <div class="mt-6 max-w-md">
        <div class="relative">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Rechercher un comédien..." 
            class="w-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-0 rounded-full px-6 py-3 focus:ring-2 focus:ring-blue-500 transition-shadow outline-none"
          />
          <div class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 md:gap-8 pt-4">
      <div v-for="i in 12" :key="i" class="flex flex-col items-center animate-pulse">
        <div class="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-200 dark:bg-gray-800 mb-4"></div>
        <div class="w-20 h-4 bg-gray-200 dark:bg-gray-800 rounded"></div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-6 rounded-xl border border-red-200 dark:border-red-800">
      <h3 class="text-lg font-semibold mb-2">Erreur</h3>
      <p>{{ error }}</p>
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
        :to="$localePath('/voice-actor/' + actor.id)"
        class="group cursor-pointer flex flex-col items-center"
      >
        <div class="relative w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800 shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg border-2 border-transparent group-hover:border-blue-500">
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
        <h3 class="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-200 text-center group-hover:text-blue-500 transition-colors">
          {{ actor.firstname }} {{ actor.lastname }}
        </h3>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const supabase = useSupabaseClient();

const allActors = ref<any[]>([]);
const isLoading = ref(true);
const error = ref('');
const searchQuery = ref('');

useHead({
  title: 'Tous les Comédiens de doublage - DubbingBase',
  meta: [
    {
      name: 'description',
      content: 'Parcourez la base de données complète des comédiens de doublage et voix françaises.'
    }
  ]
});

// Filtrage local simple
const filteredActors = computed(() => {
  if (!searchQuery.value.trim()) return allActors.value;
  const query = searchQuery.value.toLowerCase().trim();
  return allActors.value.filter(actor => {
    const fullName = `${actor.firstname} ${actor.lastname}`.toLowerCase();
    return fullName.includes(query);
  });
});

onMounted(async () => {
  try {
    const { data, error: fetchError } = await supabase.functions.invoke('list-voice-actors');
    if (fetchError) throw fetchError;
    
    allActors.value = data?.voice_actors || [];
  } catch (err: any) {
    error.value = err.message || 'Une erreur est survenue lors du chargement des comédiens.';
  } finally {
    isLoading.value = false;
  }
});
</script>
