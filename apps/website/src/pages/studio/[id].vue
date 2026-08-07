<template>
  <div
    v-if="studio"
    class="bg-gray-50 dark:bg-[#1b1b1b] min-h-screen text-gray-900 dark:text-white pb-12"
  >
    <!-- Hero Section -->
    <div class="relative w-full h-[40vh] min-h-[300px] bg-gray-200 dark:bg-[#1d1d1d]">
      <div class="absolute inset-0 bg-gradient-to-t from-gray-50 dark:from-[#1b1b1b] to-transparent"></div>
      
      <div class="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row gap-6 items-end container mx-auto max-w-6xl">
        <div class="w-32 h-32 md:w-48 md:h-48 rounded-xl shadow-xl bg-white dark:bg-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0 relative z-10">
          <img
            v-if="studio.logo_url"
            :src="studio.logo_url"
            class="w-full h-full object-contain p-4"
            :alt="studio.name"
          />
          <span v-else class="text-6xl font-bold text-gray-300 dark:text-gray-600">{{ studio.name.charAt(0) }}</span>
        </div>
        <div class="pb-4 relative z-10">
          <h1 class="text-4xl md:text-5xl font-bold">{{ studio.name }}</h1>
          <div class="flex flex-wrap items-center gap-3 mt-4">
            <span v-if="studio.city || studio.country" class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              {{ [studio.city, studio.country].filter(Boolean).join(', ') }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Action Bar -->
    <div class="border-b border-gray-200 dark:border-[#2a2a2a] bg-white/95 dark:bg-[#161616]/95 backdrop-blur sticky top-0 z-10 shadow-sm">
      <div class="container mx-auto px-4 md:px-8 max-w-6xl py-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <!-- Left side actions -->
        <div class="flex flex-wrap gap-2">
          <a
            v-if="studio.website_url"
            :href="studio.website_url"
            target="_blank"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1d1d1d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2"
          >
            Visiter le site web
            <ExternalLinkIcon class="w-4 h-4 opacity-70" />
          </a>
        </div>
        
        <!-- Right side actions -->
        <div class="flex items-center flex-wrap gap-4">
          <NuxtLink v-if="isAdmin" :to="$localePath(`/studio/${studio.id}/edit`)" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span class="hidden sm:inline">Éditer le studio</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="container mx-auto p-4 md:p-8 max-w-6xl">
      <!-- Overview -->
      <div class="mb-12 max-w-4xl">
        <section v-if="studio.description">
          <h2 class="text-2xl font-bold mb-4">À propos</h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
            {{ studio.description }}
          </p>
        </section>
      </div>

      <!-- Dubbed Projects -->
      <section class="mb-12" v-if="dubbedProjects.length > 0">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold">Projets de doublage ({{ dubbedProjects.length }})</h2>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          <NuxtLink
            v-for="project in dubbedProjects"
            :key="project.id"
            :to="$localePath(`/${project.content_type === 'movie' ? 'movie' : 'show'}/${project.content_id}`)"
            class="group transition-transform hover:-translate-y-1 block flex flex-col"
          >
            <div class="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-[#2a2a2a] group-hover:border-cyan-500 transition-colors">
              <NuxtImg 
                v-if="project.media?.poster_path" 
                :src="'https://image.tmdb.org/t/p/w342' + project.media.poster_path" 
                :alt="project.media?.title || project.media?.name" 
                format="webp" 
                loading="lazy" 
                class="object-cover w-full h-full group-hover:scale-105 transition duration-300" 
              />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
              </div>
              
              <!-- Language badge -->
              <div class="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-semibold text-white">
                <span v-if="project.language === 'fr-FR'">Français (VFF)</span>
                <span v-else-if="project.language === 'fr-CA'">Québécois (VFQ)</span>
                <span v-else-if="project.language === 'fr-BE'">Belge (VFB)</span>
                <span v-else>{{ project.language }}</span>
              </div>
            </div>
            
            <h3 class="font-semibold text-sm md:text-base text-gray-900 dark:text-gray-100 line-clamp-2">
              {{ project.media?.title || project.media?.name || `Media #${project.content_id}` }}
            </h3>
            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1 uppercase font-bold tracking-wider">
              {{ project.content_type === 'movie' ? 'Film' : 'Série' }}
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- Voice Actors Roster -->
      <section v-if="voiceActorsRoster.length > 0">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold">Comédiens ({{ voiceActorsRoster.length }})</h2>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <NuxtLink
            v-for="va in voiceActorsRoster"
            :key="va.id"
            :to="$localePath(`/voice-actor/${va.id}`)"
            class="group"
          >
            <div class="bg-white dark:bg-[#1d1d1d] border border-gray-200 dark:border-[#2a2a2a] rounded-xl overflow-hidden hover:border-cyan-500 transition-colors flex flex-col items-center p-4 text-center">
              <div class="w-20 h-20 rounded-full overflow-hidden mb-3 bg-gray-200 dark:bg-[#2a2a2a] shrink-0 border-2 border-transparent group-hover:border-cyan-500 transition-colors">
                <img
                  v-if="va.profile_picture"
                  :src="getProfileUrl(va.profile_picture)"
                  class="w-full h-full object-cover"
                  :alt="`${va.firstname} ${va.lastname}`"
                />
                <div v-else class="w-full h-full flex items-center justify-center font-bold text-xl text-gray-400">
                  {{ va.firstname.charAt(0) }}{{ va.lastname.charAt(0) }}
                </div>
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-cyan-500 transition-colors">
                {{ va.firstname }} {{ va.lastname }}
              </h3>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>

  <div v-else-if="loading" class="flex justify-center items-center h-[50vh]">
    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
  </div>
  
  <div v-else-if="error" class="container mx-auto p-8 text-center text-red-500">
    {{ error }}
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStudioData } from '@app/shared-logic';
import { ExternalLinkIcon } from 'lucide-vue-next';

const route = useRoute();
const supabase = useSupabaseClient();
const user = useSupabaseUser();

const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const { studio, dubbedProjects, voiceActorsRoster, loading, error, loadStudioDetails } = useStudioData(supabase);

const getProfileUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("voice_actor_profile_pictures").getPublicUrl(path);
  return data.publicUrl;
};

useHead({
  title: computed(() => studio.value ? `${studio.value.name} - DubbingBase` : 'Studio - DubbingBase'),
});

onMounted(() => {
  if (route.params.id) {
    loadStudioDetails(route.params.id as string);
  }
});
</script>
