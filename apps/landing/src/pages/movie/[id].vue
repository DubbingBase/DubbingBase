<template>
  <div v-if="movie" class="bg-gray-50 dark:bg-[#1b1b1b] min-h-screen text-gray-900 dark:text-white">
    <!-- Hero Section -->
    <div class="relative w-full h-[50vh] min-h-[400px]">
      <button @click="router.back()" class="absolute top-6 left-6 z-20 flex items-center gap-2 bg-white/50 dark:bg-black/50 hover:bg-white/70 dark:hover:bg-black/70 backdrop-blur-sm text-gray-900 dark:text-white px-4 py-2 rounded-full transition-colors border border-gray-200 dark:border-gray-700">
        <ArrowLeftIcon class="w-5 h-5" />
        <span class="font-medium">{{ $t('details.back') }}</span>
      </button>
      <div class="absolute inset-0">
        <img
          v-if="backdropUrl"
          :src="backdropUrl"
          class="w-full h-full object-cover"
          alt="Backdrop"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-gray-50 dark:from-[#1b1b1b] to-transparent"></div>
        <div class="absolute inset-0 bg-black/10 dark:bg-black/40"></div>
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
          <p class="text-gray-600 dark:text-gray-300 mt-2 text-lg">
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
            <h2 class="text-2xl font-bold mb-4">{{ $t('details.synopsis') }}</h2>
            <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
              {{ movie.overview || $t('details.noSynopsis') }}
            </p>
          </section>
        </div>

        <!-- Sidebar Details -->
        <div class="space-y-6">
          <div class="bg-white dark:bg-[#1d1d1d] p-6 rounded-xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none">
            <h3 class="font-bold text-gray-500 dark:text-gray-400 mb-2">{{ $t('details.originalTitle') }}</h3>
            <p>{{ movie.original_title }}</p>

            <h3 class="font-bold text-gray-500 dark:text-gray-400 mt-4 mb-2">{{ $t('details.rating') }}</h3>
            <p>{{ movie.vote_average?.toFixed(1) }} / 10</p>
          </div>
        </div>
      </div>

      <!-- Voice Cast -->
      <section>
        <div class="flex flex-col mb-6 gap-2">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h2 class="text-2xl font-bold">{{ $t('details.castAndCrew') }}</h2>
              <div class="text-gray-500 dark:text-gray-400 text-sm font-mono mt-1">{{ filteredCast.length }} / {{ formattedCast.length }} roles</div>
            </div>
            
            <div class="relative w-full sm:w-64">
              <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                v-model="searchQuery"
                type="search"
                :placeholder="$t('search.placeholder')"
                class="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-[#00E5FF] transition-all text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Each role, shown three ways: the original performer, the character, and the voice actor.</p>
          
          <!-- Dubbing Projects Tabs -->
          <div v-if="dubbingProjects.length > 1" class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="project in dubbingProjects"
              :key="project.id"
              :to="{ query: { dub: project.id } }"
              class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-[#2a2a2a]"
              :class="activeDubId === project.id ? 'bg-cyan-600 dark:bg-[#00E5FF] text-white dark:text-black border-cyan-600 dark:border-[#00E5FF]' : 'bg-white dark:bg-[#1d1d1d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'"
            >
              {{ $t('details.dubbing', { lang: getDisplayLanguage(project.language) }) }}
              <span v-if="project.studio_data?.name" class="opacity-75 text-xs ml-1">({{ project.studio_data.name }})</span>
            </NuxtLink>
          </div>
        </div>
        
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div
            v-for="actor in filteredCast"
            :key="actor.id"
            class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700"
          >
            <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4">
              <!-- Original Actor -->
              <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start">
                <NuxtLink :to="$localePath(`/actor/${actor.id}`)" class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0">
                  <img v-if="actor.profile_path" :src="actor.profile_path" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Actor" />
                </NuxtLink>
                <div class="flex flex-col min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                    <ClapperboardIcon class="w-3 h-3" />
                    <span class="truncate">{{ $t('details.actor') }}</span>
                  </div>
                  <NuxtLink :to="$localePath(`/actor/${actor.id}`)" class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline" :title="actor.name">
                    {{ actor.name }}
                  </NuxtLink>
                </div>
              </div>

              <!-- Character -->
              <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start">
                <div class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0">
                  <img v-if="actor.characterImage" :src="actor.characterImage" class="w-full h-full object-cover" alt="Character" />
                </div>
                <div class="flex flex-col min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                    <UserIcon class="w-3 h-3" />
                    <span class="truncate">{{ $t('details.character') }}</span>
                  </div>
                  <div class="font-bold text-sm text-gray-900 dark:text-white truncate" :title="actor.character">
                    {{ actor.character || $t('details.unknownCharacter') }}
                  </div>
                </div>
              </div>

              <!-- Voice Actor -->
              <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0">
                <template v-if="actor.voiceActor">
                  <NuxtLink :to="$localePath(`/voice-actor/${actor.voiceActor.id}`)" class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0">
                    <img v-if="actor.voiceActor.profile_picture" :src="actor.voiceActor.profile_picture" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="Voice Actor" />
                    <div v-else class="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                      {{ actor.voiceActor.firstname?.[0] }}{{ actor.voiceActor.lastname?.[0] }}
                    </div>
                  </NuxtLink>
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                      <MicIcon class="w-3 h-3" />
                      <span class="truncate">{{ $t('details.voiceActor') }}</span>
                    </div>
                    <NuxtLink :to="$localePath(`/voice-actor/${actor.voiceActor.id}`)" class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline" :title="actor.voiceActor.firstname + ' ' + actor.voiceActor.lastname">
                      {{ actor.voiceActor.firstname }} {{ actor.voiceActor.lastname }}
                    </NuxtLink>
                  </div>
                </template>
                <template v-else>
                  <div class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-100 dark:bg-[#151515] sm:mb-3 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-800 flex-shrink-0">
                    <span class="text-gray-400 dark:text-gray-600 text-xs text-center px-2">?</span>
                  </div>
                  <div class="flex flex-col min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">
                      <MicIcon class="w-3 h-3 opacity-50" />
                      <span class="truncate">{{ $t('details.voiceActor') }}</span>
                    </div>
                    <div class="text-sm text-gray-400 italic truncate">{{ $t('details.notSpecified') }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
  <div v-else-if="pending" class="min-h-screen bg-gray-50 dark:bg-[#1b1b1b] flex items-center justify-center">
    <div class="w-12 h-12 border-4 border-cyan-600 dark:border-[#00E5FF] border-t-transparent rounded-full animate-spin"></div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

import { fetchMovieData } from '@app/shared-logic';
import { computed, ref } from 'vue';
import { ArrowLeftIcon, ClapperboardIcon, UserIcon, MicIcon, SearchIcon } from 'lucide-vue-next';

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

const searchQuery = ref('');

const filteredCast = computed(() => {
  if (!searchQuery.value) return formattedCast.value;
  const query = searchQuery.value.toLowerCase();
  return formattedCast.value.filter((actor: any) => {
    const actorName = actor.name?.toLowerCase() || '';
    const characterName = actor.character?.toLowerCase() || '';
    const vaName = actor.voiceActor ? `${actor.voiceActor.firstname || ''} ${actor.voiceActor.lastname || ''}`.toLowerCase() : '';
    const vaPerformance = actor.voiceActor?.performance?.toLowerCase() || '';
    return actorName.includes(query) || characterName.includes(query) || vaName.includes(query) || vaPerformance.includes(query);
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
