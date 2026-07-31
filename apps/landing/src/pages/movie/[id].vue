<template>
  <div v-if="movie" class="bg-[#1b1b1b] min-h-screen text-white">
    <!-- Hero Section -->
    <div class="relative w-full h-[50vh] min-h-[400px]">
      <button @click="router.back()" class="absolute top-6 left-6 z-20 flex items-center gap-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm text-white px-4 py-2 rounded-full transition-colors border border-gray-700">
        <ArrowLeftIcon class="w-5 h-5" />
        <span class="font-medium">Retour</span>
      </button>
      <div class="absolute inset-0">
        <img
          v-if="backdropUrl"
          :src="backdropUrl"
          class="w-full h-full object-cover"
          alt="Backdrop"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-[#1b1b1b] to-transparent"></div>
        <div class="absolute inset-0 bg-black/40"></div>
      </div>
      
      <div class="absolute bottom-0 left-0 w-full p-8 flex flex-col md:flex-row gap-6 items-end">
        <img
          v-if="posterUrl"
          :src="posterUrl"
          class="w-32 md:w-48 rounded-lg shadow-xl"
          :alt="movie.title"
        />
        <div class="pb-4">
          <h1 class="text-4xl md:text-5xl font-bold">{{ movie.title }}</h1>
          <p class="text-gray-300 mt-2 text-lg">
            {{ new Date(movie.release_date).getFullYear() }}
          </p>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="container mx-auto p-8 max-w-6xl">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <!-- Overview -->
        <div class="md:col-span-2 space-y-6">
          <section>
            <h2 class="text-2xl font-bold mb-4">Synopsis</h2>
            <p class="text-gray-300 leading-relaxed text-lg">
              {{ movie.overview || 'Aucun synopsis disponible.' }}
            </p>
          </section>
        </div>

        <!-- Sidebar Details -->
        <div class="space-y-6">
          <div class="bg-[#1d1d1d] p-6 rounded-xl border border-[#2a2a2a]">
            <h3 class="font-bold text-gray-400 mb-2">Titre Original</h3>
            <p>{{ movie.original_title }}</p>

            <h3 class="font-bold text-gray-400 mt-4 mb-2">Note</h3>
            <p>{{ movie.vote_average?.toFixed(1) }} / 10</p>
          </div>
        </div>
      </div>

      <!-- Voice Cast -->
      <section>
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <h2 class="text-2xl font-bold">Casting & Voix Françaises</h2>
          
          <!-- Dubbing Projects Tabs -->
          <div v-if="dubbingProjects.length > 1" class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="project in dubbingProjects"
              :key="project.id"
              :to="{ query: { dub: project.id } }"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-[#2a2a2a]"
              :class="activeDubId === project.id ? 'bg-[#00E5FF] text-black border-[#00E5FF]' : 'bg-[#1d1d1d] text-gray-300 hover:bg-[#2a2a2a]'"
            >
              Doublage {{ getDisplayLanguage(project.language) }}
              <span v-if="project.studio_data?.name" class="opacity-75 text-xs ml-1">({{ project.studio_data.name }})</span>
            </NuxtLink>
          </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            v-for="actor in formattedCast"
            :key="actor.id"
            class="bg-[#1d1d1d] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col p-4 gap-3 shadow-md"
          >
            <!-- Character -->
            <div class="flex flex-col items-center border-b border-[#2a2a2a] pb-3 mb-2">
              <img v-if="actor.characterImage" :src="actor.characterImage" class="w-16 h-16 rounded-lg object-cover mb-2 border border-[#3a3a3a] shadow-sm bg-gray-800" alt="Character" />
              <div class="text-center text-sm font-semibold text-gray-400 truncate w-full" :title="actor.character">
                {{ actor.character || 'Personnage inconnu' }}
              </div>
            </div>
            
            <div class="flex flex-col md:flex-row justify-between md:items-center gap-2 md:gap-4">
              <!-- Physical Actor -->
              <NuxtLink :to="$localePath(`/actor/${actor.id}`)" class="flex items-center gap-4 flex-1 min-w-0 hover:bg-[#2a2a2a] p-2 -mx-2 md:-ml-2 rounded-xl transition-colors cursor-pointer w-full">
                <img v-if="actor.profile_path" :src="actor.profile_path" class="w-20 h-20 rounded-full object-cover bg-gray-800 flex-shrink-0" alt="Actor" />
                <div v-else class="w-20 h-20 rounded-full bg-gray-800 flex-shrink-0"></div>
                <div class="min-w-0">
                  <div class="text-[10px] text-gray-500 uppercase tracking-wider">Acteur</div>
                  <div class="font-bold text-base md:text-sm text-white truncate hover:underline" :title="actor.name">{{ actor.name }}</div>
                </div>
              </NuxtLink>

              <!-- Arrow -->
              <div class="text-gray-600 flex-shrink-0 hidden md:block">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd" /></svg>
              </div>

              <!-- Voice Actor -->
              <div class="flex flex-row md:flex-row-reverse items-center gap-4 flex-1 min-w-0 justify-start md:justify-end text-left md:text-right w-full hover:bg-[#2a2a2a] md:hover:bg-transparent p-2 -mx-2 md:p-0 md:m-0 rounded-xl transition-colors">
                <template v-if="actor.voiceActor">
                  <img v-if="actor.voiceActor.profile_picture" :src="actor.voiceActor.profile_picture" class="w-20 h-20 rounded-full object-cover bg-gray-700 flex-shrink-0" alt="VF" />
                  <div v-else class="w-20 h-20 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-gray-400">
                    {{ actor.voiceActor.firstname?.[0] }}{{ actor.voiceActor.lastname?.[0] }}
                  </div>
                  <div class="min-w-0 flex-1 md:flex-none">
                    <div class="text-[10px] text-[#00E5FF] uppercase tracking-wider">Voix VF</div>
                    <NuxtLink :to="$localePath(`/voice-actor/${actor.voiceActor.id}`)" class="font-bold text-base md:text-sm text-[#00E5FF] hover:underline truncate block" :title="actor.voiceActor.firstname + ' ' + actor.voiceActor.lastname">{{ actor.voiceActor.firstname }} {{ actor.voiceActor.lastname }}</NuxtLink>
                  </div>
                </template>
                <template v-else>
                  <div class="text-sm text-gray-500 italic w-full text-left md:text-right pl-[5.5rem] md:pl-0">Non renseignée</div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
  <div v-else-if="pending" class="min-h-screen bg-[#1b1b1b] flex items-center justify-center">
    <div class="w-12 h-12 border-4 border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

import { fetchMovieData } from '@app/shared-logic';
import { computed } from 'vue';
import { ArrowLeftIcon } from 'lucide-vue-next';

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const movieId = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id;

const { data, pending } = await useAsyncData(`movie-${movieId}`, () => fetchMovieData(supabase, movieId));

const movie = computed(() => data.value?.movie);
const dubbingProjects = computed(() => data.value?.dubbingProjects || []);
const characterProfilePictures = computed(() => data.value?.characterProfilePictures || []);

const backdropUrl = computed(() => {
  if (!movie.value?.backdrop_path) return null;
  return `https://image.tmdb.org/t/p/original${movie.value.backdrop_path}`;
});

const posterUrl = computed(() => {
  if (!movie.value?.poster_path) return null;
  return `https://image.tmdb.org/t/p/w500${movie.value.poster_path}`;
});

const activeDubId = computed(() => {
  if (route.query.dub) {
    return Number(route.query.dub);
  }
  return dubbingProjects.value[0]?.id || null;
});

const activeDubProject = computed(() => {
  return dubbingProjects.value.find((p: any) => p.id === activeDubId.value) || dubbingProjects.value[0];
});

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return 'Inconnu';
  try {
    const displayNames = new Intl.DisplayNames(['fr'], { type: 'language' });
    const name = displayNames.of(langCode);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : langCode;
  } catch (e) {
    return langCode;
  }
};

// Format cast and attach voice actors
const formattedCast = computed(() => {
  if (!movie.value?.credits?.cast) return [];

  // Get works (dubbing links) for the currently active dubbing project
  const works = activeDubProject.value?.works || [];

  return movie.value.credits.cast.map((actor: any) => {
    // TMDB returns profile_path without full URL sometimes in raw payload, 
    // but the backend processMedia adds TMDB urls to it.
    // If it's a relative path starting with /, prepend tmdb url.
    let profilePath = actor.profile_path;
    if (profilePath && profilePath.startsWith('/')) {
      profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
    }

    // Find the voice actor work for this physical actor
    const work = works.find((w: any) => w.actor_id === actor.id);
    const voiceActor = work?.voice_actor;

    // Find character picture matching the character name
    let characterImage = null;
    if (actor.character) {
      const match = characterProfilePictures.value.find((c: any) => 
        c.name && c.name.toLowerCase() === actor.character.toLowerCase()
      );
      if (match && match.image) {
        characterImage = match.image;
      }
    }

    return {
      ...actor,
      profile_path: profilePath,
      voiceActor: voiceActor || null,
      characterImage
    };
  });
});

useHead({
  title: computed(() => {
    let base = movie.value ? `${movie.value.title}` : 'Film';
    if (activeDubProject.value) {
      base += ` - Doublage ${getDisplayLanguage(activeDubProject.value.language)}`;
    }
    return `${base} - DubbingBase`;
  }),
  meta: [
    {
      name: 'description',
      content: computed(() => {
        let desc = movie.value?.overview || `Découvrez le casting et les voix françaises du film ${movie.value?.title}.`;
        if (activeDubProject.value) {
          desc = `Découvrez le casting complet des voix françaises pour le doublage ${getDisplayLanguage(activeDubProject.value.language)} du film ${movie.value?.title}. ` + desc;
        }
        return desc;
      })
    },
    {
      property: 'og:image',
      content: computed(() => backdropUrl.value || posterUrl.value || '')
    }
  ],
  link: [
    {
      rel: 'canonical',
      href: computed(() => {
        const baseUrl = 'https://dubbingbase.com/movie/' + movieId;
        return activeDubId.value ? `${baseUrl}?dub=${activeDubId.value}` : baseUrl;
      })
    }
  ],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Movie',
        url: `https://dubbingbase.com/movie/${movieId}`,
        name: movie.value?.title || 'Film',
        image: posterUrl.value || backdropUrl.value || '',
        description: movie.value?.overview || `Découvrez le casting et les voix françaises du film ${movie.value?.title}.`,
      }))
    }
  ]
});
</script>
