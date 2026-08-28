<template>
  <DetailsPage v-if="studio">
    <DetailsHero
      :title="studio.name"
      :backdrop-url="null"
      :image-url="studio.logo_url"
      image-aspect-ratio="logo"
    >
      <template #metadata v-if="studio.city || studio.country">
        <span class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 opacity-75" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          {{ [studio.city, studio.country].filter(Boolean).join(', ') }}
        </span>
      </template>
    </DetailsHero>

    <DetailsActionBar>
      <template #left v-if="studio.website_url">
        <a
          :href="studio.website_url"
          target="_blank"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1d1d1d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] flex items-center gap-2"
        >
          Visiter le site web
          <ExternalLinkIcon class="w-4 h-4 opacity-70" />
        </a>
      </template>
      <template #right v-if="isAdmin">
        <NuxtLink :to="localePath(`/studio/${studio.id}/edit`)" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span class="hidden sm:inline">Éditer le studio</span>
        </NuxtLink>
      </template>
    </DetailsActionBar>

    <div class="w-full p-4 md:p-8 max-w-6xl mx-auto">
      <!-- Overview -->
      <div class="mb-12 max-w-4xl" v-if="studio.description">
        <section>
          <h2 class="text-2xl font-bold mb-4">À propos</h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
            {{ studio.description }}
          </p>
        </section>
      </div>

      <!-- Dubbed Projects -->
      <section class="mb-12" v-if="dubbedProjects.length > 0">
        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-bold">Projets de doublage ({{ dubbedProjects.length }})</h2>
            <div class="text-gray-500 dark:text-gray-400 text-sm mt-1">
              {{ visibleProjects.length }} / {{ filteredProjects.length }} affichés
            </div>
          </div>
          <div class="relative w-full sm:w-64" v-if="dubbedProjects.length > 8">
            <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              v-model="searchInput"
              type="search"
              :placeholder="$t('search.placeholder', 'Rechercher...')"
              class="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-[#00E5FF] transition-all text-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          <NuxtLink
            v-for="project in visibleProjects"
            :key="project.id"
            :to="localePath(getMediaLink(project.content_type, project.content_id))"
            class="group transition-transform hover:-translate-y-1 block flex flex-col"
          >
            <div class="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-gray-200 dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-[#2a2a2a] group-hover:border-cyan-500 transition-colors">
              <NuxtImg 
                v-if="project.media?.poster_path" 
                :src="project.media.poster_path.startsWith('http') ? project.media.poster_path : 'https://image.tmdb.org/t/p/w342' + project.media.poster_path" 
                :alt="project.media?.title || project.media?.name" 
                format="webp" 
                loading="lazy"
                decoding="async"
                class="object-cover w-full h-full transition duration-300" 
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
              {{ getMediaTypeLabel(project.content_type) }}
            </div>
          </NuxtLink>
        </div>

        <!-- Sentinel / Load more for projects -->
        <div
          v-if="hasMoreProjects"
          ref="projectsSentinel"
          class="py-8 flex flex-col items-center justify-center gap-2"
        >
          <button
            @click="loadMoreProjects"
            class="px-5 py-2 bg-white dark:bg-[#1d1d1d] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-sm font-medium rounded-xl text-gray-700 dark:text-gray-200 transition-all border border-gray-200 dark:border-[#2a2a2a] shadow-sm cursor-pointer"
          >
            {{ $t('common.loadMore', 'Load more') }}
          </button>
          <span class="text-xs text-gray-400">
            {{ visibleProjects.length }} / {{ filteredProjects.length }} projets
          </span>
        </div>
      </section>

      <!-- Voice Actors Roster -->
      <section v-if="voiceActorsRoster.length > 0">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold">Comédiens ({{ voiceActorsRoster.length }})</h2>
            <div class="text-gray-500 dark:text-gray-400 text-sm mt-1" v-if="voiceActorsRoster.length > 20">
              {{ visibleVoiceActors.length }} / {{ voiceActorsRoster.length }} affichés
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <NuxtLink
            v-for="va in visibleVoiceActors"
            :key="va.id"
            :to="localePath(`/voice-actor/${va.id}`)"
            class="group"
          >
            <div class="bg-white dark:bg-[#1d1d1d] border border-gray-200 dark:border-[#2a2a2a] rounded-xl overflow-hidden hover:border-cyan-500 transition-colors flex flex-col items-center p-4 text-center">
              <div class="w-20 h-20 rounded-full overflow-hidden mb-3 bg-gray-200 dark:bg-[#2a2a2a] shrink-0 border-2 border-transparent group-hover:border-cyan-500 transition-colors">
                <img
                  v-if="va.profile_picture"
                  :src="getProfileUrl(va.profile_picture)"
                  loading="lazy"
                  decoding="async"
                  class="w-full h-full object-cover"
                  :alt="`${va.firstname} ${va.lastname}`"
                />
                <div v-else class="w-full h-full flex items-center justify-center font-bold text-xl text-gray-400">
                  {{ va.firstname?.charAt(0) || '' }}{{ va.lastname?.charAt(0) || '' }}
                </div>
              </div>
              <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-1 group-hover:text-cyan-500 transition-colors">
                {{ va.firstname }} {{ va.lastname }}
              </h3>
            </div>
          </NuxtLink>
        </div>

        <!-- Sentinel / Load more for voice actors -->
        <div
          v-if="hasMoreVoiceActors"
          ref="vaSentinel"
          class="py-8 flex flex-col items-center justify-center gap-2"
        >
          <button
            @click="loadMoreVoiceActors"
            class="px-5 py-2 bg-white dark:bg-[#1d1d1d] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-sm font-medium rounded-xl text-gray-700 dark:text-gray-200 transition-all border border-gray-200 dark:border-[#2a2a2a] shadow-sm cursor-pointer"
          >
            {{ $t('common.loadMore', 'Load more') }}
          </button>
          <span class="text-xs text-gray-400">
            {{ visibleVoiceActors.length }} / {{ voiceActorsRoster.length }} comédiens
          </span>
        </div>
      </section>
    </div>
  </DetailsPage>

  <PersonSkeleton v-else-if="loading" />
  
  <div v-else-if="error" class="container mx-auto p-8 text-center text-red-500">
    {{ error }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStudioData, fetchStudioDetails } from '@app/shared-logic';
import { ExternalLinkIcon, SearchIcon } from 'lucide-vue-next';
import { useIntersectionObserver, refDebounced } from '@vueuse/core';
import DetailsPage from '../../components/layout/details/DetailsPage.vue';
import DetailsHero from '../../components/layout/details/DetailsHero.vue';
import DetailsActionBar from '../../components/layout/details/DetailsActionBar.vue';
import PersonSkeleton from '../../components/PersonSkeleton.vue';

import { useI18n } from 'vue-i18n';

const route = useRoute();
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const localePath = useLocalePath();
const { t } = useI18n();

function getMediaLink(contentType?: string, mediaId?: number | string) {
  if (contentType === 'tv') return `/show/${mediaId}`;
  if (contentType === 'video_game') return `/game/${mediaId}`;
  if (contentType === 'audiobook') return `/audiobook/${mediaId}`;
  if (contentType === 'podcast') return `/podcast/${mediaId}`;
  if (contentType === 'advertisement') return `/advertisement/${mediaId}`;
  if (contentType === 'toy') return `/toy/${mediaId}`;
  return `/movie/${mediaId}`;
}

function getMediaTypeLabel(contentType?: string) {
  if (contentType === 'movie') return t('search.movie') || 'Film';
  if (contentType === 'tv') return t('search.tv') || 'Série';
  if (contentType === 'video_game') return t('search.videoGame') || 'Jeu vidéo';
  if (contentType === 'audiobook') return t('search.audiobook') || 'Livre audio';
  if (contentType === 'podcast') return t('search.podcast') || 'Podcast';
  if (contentType === 'advertisement') return t('search.advertisement') || 'Publicité';
  if (contentType === 'toy') return t('search.toy') || 'Jouet / Objet';
  return contentType || 'Média';
}

const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const { data: initialStudioDetails } = await useAsyncData(
  `studio-${route.params.id}`,
  () => fetchStudioDetails(route.params.id as string),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const { studio, dubbedProjects, voiceActorsRoster, loading, error } = useStudioData([], initialStudioDetails.value);

const searchInput = ref('');
const debouncedSearch = refDebounced(searchInput, 150);

const filteredProjects = computed(() => {
  if (!debouncedSearch.value.trim()) return dubbedProjects.value;
  const query = debouncedSearch.value.toLowerCase().trim();
  return dubbedProjects.value.filter((p: any) => {
    const title = (p.media?.title || p.media?.name || '').toLowerCase();
    return title.includes(query);
  });
});

const displayedProjectsCount = ref(20);
const visibleProjects = computed(() => {
  return filteredProjects.value.slice(0, displayedProjectsCount.value);
});
const hasMoreProjects = computed(() => {
  return displayedProjectsCount.value < filteredProjects.value.length;
});
const loadMoreProjects = () => {
  displayedProjectsCount.value += 20;
};
const projectsSentinel = ref<HTMLElement | null>(null);
useIntersectionObserver(
  projectsSentinel,
  ([entry]) => {
    if (entry?.isIntersecting && hasMoreProjects.value) {
      loadMoreProjects();
    }
  },
  { rootMargin: '400px' },
);

watch(debouncedSearch, () => {
  displayedProjectsCount.value = 20;
});

const displayedVACount = ref(25);
const visibleVoiceActors = computed(() => {
  return voiceActorsRoster.value.slice(0, displayedVACount.value);
});
const hasMoreVoiceActors = computed(() => {
  return displayedVACount.value < voiceActorsRoster.value.length;
});
const loadMoreVoiceActors = () => {
  displayedVACount.value += 25;
};
const vaSentinel = ref<HTMLElement | null>(null);
useIntersectionObserver(
  vaSentinel,
  ([entry]) => {
    if (entry?.isIntersecting && hasMoreVoiceActors.value) {
      loadMoreVoiceActors();
    }
  },
  { rootMargin: '400px' },
);

const getProfileUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("voice_actor_profile_pictures").getPublicUrl(path);
  return data.publicUrl;
};

useHead({
  title: computed(() => studio.value ? `${studio.value.name} - DubbingBase` : 'Studio - DubbingBase'),
  link: [
    { rel: 'preconnect', href: 'https://image.tmdb.org', crossorigin: '' },
    { rel: 'dns-prefetch', href: 'https://image.tmdb.org' },
  ],
});
</script>
