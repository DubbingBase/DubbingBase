<template>
  <div>
    <MediaSkeleton v-if="pending && !episode" />
    <MediaDetailsLayout
      v-else-if="episode"
      :title="title"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <span class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          {{ $t('details.season', { num: seasonNumber }) }}
          &bull; {{ $t('details.episode', { num: episode.episode_number }) }}
          <template v-if="episode.air_date"> &bull; {{ formatDate(episode.air_date) }}</template>
        </span>
        <span v-if="episode.overview" class="text-gray-800 dark:text-gray-300 font-medium text-sm md:text-base bg-white/40 dark:bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg">
          {{ episode.overview }}
        </span>
        <span class="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-bold text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          <StarIcon class="w-4 h-4 text-yellow-500 fill-current" />
          {{ episode.vote_average?.toFixed(1) }}
        </span>
        <div class="flex gap-2 ml-2">
          <a :href="`https://www.themoviedb.org/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white/40 dark:bg-black/40 text-gray-800 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-black/60 transition-colors backdrop-blur-md uppercase tracking-wider">
            TMDB <ExternalLinkIcon class="w-3 h-3 opacity-70" />
          </a>
        </div>
      </template>

      <template #actions-left>
        <div v-if="dubbingProjects.length > 0" class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="project in dubbingProjects"
            :key="project.id"
            :to="{ path: localePath(`/show/${showId}/season/${seasonNumber}/episode/${episodeNumber}`), query: { dub: project.id } }"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-[#2a2a2a] flex items-center gap-1.5"
            :class="
              activeDubId === project.id
                ? 'bg-cyan-600 dark:bg-[#00E5FF] text-white dark:text-black border-cyan-600 dark:border-[#00E5FF]'
                : 'bg-white dark:bg-[#1d1d1d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
            "
          >
            {{ getDisplayLanguage(project.language) }}
            <span
              class="text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors"
              :class="
                activeDubId === project.id
                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-[#00E5FF]'
                  : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400'
              "
            >
              {{ projectVoiceActorCount(project) }}
            </span>
          </NuxtLink>
        </div>
        <div v-else class="text-sm text-gray-500 font-medium">{{ $t('details.noDubbingProjects') }}</div>
      </template>

      <template #actions-right>
        <template v-if="activeDubProject?.studio_data">
          <NuxtLink
            :to="localePath(`/studio/${activeDubProject.studio_data.id}`)"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2a2a2a] hover:border-cyan-500 transition-colors group bg-gray-50 dark:bg-[#1d1d1d]"
            :title="$t('details.dubbingStudio')"
          >
            <div class="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 bg-white dark:bg-[#2a2a2a]">
              <img v-if="activeDubProject.studio_data.logo_url" :src="activeDubProject.studio_data.logo_url" class="w-full h-full object-contain p-0.5" />
              <span v-else class="font-bold text-xs text-gray-400">{{ activeDubProject.studio_data.name?.charAt(0) || '' }}</span>
            </div>
            <span class="font-medium text-xs group-hover:text-cyan-500 transition-colors truncate max-w-[120px]">{{ activeDubProject.studio_data.name }}</span>
          </NuxtLink>
          <div class="h-6 w-px bg-gray-200 dark:bg-[#2a2a2a]"></div>
        </template>

        <NuxtLink
          :to="{ path: localePath(`/show/${showId}/season/${seasonNumber}`), query: activeDubId ? { dub: activeDubId } : {} }"
          class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          <span class="hidden sm:inline">{{ $t("details.backToSeason") }}</span>
        </NuxtLink>
        
        <NuxtLink v-show="isAdmin" :to="localePath(`/show/${showId}/edit/${activeDubId || 'new'}`)" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span class="hidden sm:inline">{{ $t("details.modify") }}</span>
        </NuxtLink>
        
        <ForceEnqueueButton
          v-if="showId"
          media-type="episode"
          :media-id="showId"
          :season-number="seasonNumber"
          :episode-number="episodeNumber"
        />

        <button
          @click="isReportModalOpen = true"
          class="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
          :title="$t('report.title')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </button>
      </template>

      <template #content>
        <!-- Overview -->
        <div class="mb-12 max-w-4xl">
          <section v-if="episode.overview">
            <h2 class="text-2xl font-bold mb-4">
              {{ $t("details.synopsis") }}
            </h2>
            <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
              {{ episode.overview }}
            </p>
          </section>
        </div>

        <!-- Voice Cast -->
        <section v-if="formattedCast.length > 0">
          <div class="flex flex-col mb-6 gap-2">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <h2 class="text-2xl font-bold">
                  {{ $t("details.castAndCrew") }}
                </h2>
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
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            <div
              v-for="actor in visibleCast"
              :key="actor.id"
              class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700"
            >
              <div
                class="flex flex-col sm:grid gap-4"
                :class="isOriginalLanguage ? 'sm:grid-cols-2' : 'sm:grid-cols-3'"
              >
                <!-- Original Actor -->
                <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start">
                  <NuxtLink
                    :to="localePath(`/actor/${actor.id}`)"
                    class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0"
                  >
                    <NuxtImg
                      format="webp"
                      v-if="actor.profile_path"
                      :src="actor.profile_path"
                      loading="lazy"
                      decoding="async"
                      class="w-full h-full object-cover transition-transform duration-300"
                      alt="Actor"
                    />
                  </NuxtLink>
                  <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                      <ClapperboardIcon class="w-3 h-3 flex-shrink-0" />
                      <span class="truncate block w-full">{{ $t("details.actor") }}</span>
                    </div>
                    <NuxtLink
                      :to="localePath(`/actor/${actor.id}`)"
                      class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline block w-full"
                      :title="actor.name"
                    >
                      {{ actor.name }}
                    </NuxtLink>
                  </div>
                </div>

                <!-- Character -->
                <div class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start">
                  <div class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0">
                    <NuxtImg
                      format="webp"
                      v-if="actor.characterImage"
                      :src="actor.characterImage"
                      loading="lazy"
                      decoding="async"
                      class="w-full h-full object-cover"
                      alt="Character"
                    />
                  </div>
                  <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                      <UserIcon class="w-3 h-3 flex-shrink-0" />
                      <span class="truncate block w-full">{{ $t("details.character") }}</span>
                    </div>
                    <div
                      class="font-bold text-sm text-gray-900 dark:text-white truncate block w-full"
                      :title="actor.roles?.map((r: any) => r.character).join(', ') || actor.workCharacterName || ''"
                    >
                      {{
                        actor.roles?.map((r: any) => r.character).join(", ") ||
                        actor.workCharacterName ||
                        $t("details.unknownCharacter")
                      }}
                    </div>
                  </div>
                </div>

                <!-- Voice Actor (hidden when viewing in original language) -->
                <div
                  v-if="!isOriginalLanguage"
                  class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t border-gray-100 dark:border-[#2a2a2a] sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0"
                >
                  <template v-if="actor.voiceActor">
                    <NuxtLink
                      :to="localePath(`/voice-actor/${actor.voiceActor.id}`)"
                      class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-200 dark:bg-[#222] sm:mb-3 flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        v-if="actor.voiceActor.profile_picture"
                        :src="actor.voiceActor.profile_picture"
                        loading="lazy"
                        decoding="async"
                        class="w-full h-full object-cover transition-transform duration-300"
                        alt="Voice Actor"
                      />
                      <div v-else class="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                        {{ actor.voiceActor.firstname?.[0] }}{{ actor.voiceActor.lastname?.[0] }}
                      </div>
                    </NuxtLink>
                    <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                      <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                        <MicIcon class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate block w-full">{{ $t("details.voiceActor") }}</span>
                      </div>
                      <NuxtLink
                        :to="localePath(`/voice-actor/${actor.voiceActor.id}`)"
                        class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline block w-full"
                        :title="actor.voiceActor.firstname + ' ' + actor.voiceActor.lastname"
                      >
                        {{ actor.voiceActor.firstname }} {{ actor.voiceActor.lastname }}
                      </NuxtLink>
                    </div>
                  </template>
                  <template v-else>
                    <div class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-gray-100 dark:bg-[#151515] sm:mb-3 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-800 flex-shrink-0">
                      <span class="text-gray-400 dark:text-gray-600 text-xs text-center px-2">?</span>
                    </div>
                    <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                      <div class="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1">
                        <MicIcon class="w-3 h-3 opacity-50 flex-shrink-0" />
                        <span class="truncate block w-full">{{ $t("details.voiceActor") }}</span>
                      </div>
                      <div class="text-sm text-gray-400 italic truncate block w-full">
                        {{ $t("details.notSpecified") }}
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>

          <!-- Progressive load more sentinel -->
          <div
            v-if="hasMoreCast"
            ref="loadMoreSentinel"
            class="py-10 flex flex-col items-center justify-center gap-3"
          >
            <button
              @click="loadMoreCast"
              class="px-5 py-2.5 bg-white dark:bg-[#1d1d1d] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-sm font-medium rounded-xl text-gray-700 dark:text-gray-200 transition-all border border-gray-200 dark:border-[#2a2a2a] shadow-sm cursor-pointer"
            >
              {{ $t('common.loadMore', 'Load more') }}
            </button>
            <span class="text-xs text-gray-400">
              {{ visibleCast.length }} / {{ filteredCast.length }} {{ $t('details.castAndCrew') }}
            </span>
          </div>
        </section>
        <section v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
          {{ $t('details.noCast') }}
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {{ $t("details.notFound", "Épisode introuvable") }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        {{ $t("details.notFoundDesc", "Impossible de charger les informations de cet épisode.") }}
      </p>
      <NuxtLink
        :to="localePath(`/show/${showId}/season/${seasonNumber}`)"
        class="px-4 py-2 bg-cyan-600 dark:bg-[#00E5FF] text-white dark:text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {{ $t("details.backToSeason", "Retour à la saison") }}
      </NuxtLink>
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../../../../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from "vue-router";

import { fetchEpisodeData } from "@app/shared-logic";
import { computed, ref, watch } from "vue";
import { useIntersectionObserver, refDebounced } from "@vueuse/core";
import {
  ArrowLeftIcon,
  ClapperboardIcon,
  UserIcon,
  MicIcon,
  SearchIcon,
  ExternalLinkIcon,
  StarIcon
} from "lucide-vue-next";
import ReportModal from "../../../../../../components/ReportModal.vue";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const showId = (Array.isArray(route.params.id)
  ? route.params.id[0]
  : route.params.id) || '';
const seasonNumber = (Array.isArray(route.params.seasonNumber)
  ? route.params.seasonNumber[0]
  : route.params.seasonNumber) || '1';
const episodeNumber = (Array.isArray(route.params.episodeNumber)
  ? route.params.episodeNumber[0]
  : route.params.episodeNumber) || '1';
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const { locale, t } = useI18n();
const localePath = useLocalePath();

const cacheKey = `episode-${showId}-${seasonNumber}-${episodeNumber}-${locale.value}`;

const { data, pending } = useAsyncData(
  cacheKey,
  async () => {
    return await fetchEpisodeData(showId, seasonNumber, episodeNumber, locale.value);
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const episode = computed(() => data.value?.episode);
const dubbingProjects = computed(() => {
  const projects = [...(data.value?.dubbingProjects || [])]
    .filter((p) => projectHasVoiceActor(p));
  const currentLocale = locale.value.toLowerCase();
  return projects.sort((a, b) => {
    const aIsPref = a.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;
    const bIsPref = b.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;

    if (aIsPref !== bIsPref) {
      return bIsPref - aIsPref;
    }

    const aWorks = a.works?.length || 0;
    const bWorks = b.works?.length || 0;
    return bWorks - aWorks;
  });
});

function projectHasVoiceActor(project: any): boolean {
  return (project.works || []).some((w: any) => w.voice_actor);
}

function projectVoiceActorCount(project: any): number {
  const ids = new Set<number>();
  for (const w of project.works || []) {
    if (w.voice_actor?.id) ids.add(w.voice_actor.id);
  }
  return ids.size;
}
const characterProfilePictures = computed(
  () => data.value?.characterProfilePictures || [],
);
const title = computed(() => {
  if (!episode.value) return t('search.tv', 'Series');
  const episodeName = episode.value.name || t('details.episode', { num: episode.value.episode_number });
  return `${t('details.season', { num: seasonNumber })} · ${t('details.episode', { num: episode.value.episode_number })} - ${episodeName}`;
});

const backdropUrl = computed(() => {
  if (!episode.value?.still_path) return null;
  if (episode.value.still_path.startsWith('http')) return episode.value.still_path;
  return `https://image.tmdb.org/t/p/original${episode.value.still_path}`;
});

const posterUrl = computed(() => {
  if (!episode.value?.still_path) return null;
  if (episode.value.still_path.startsWith('http')) return episode.value.still_path;
  return `https://image.tmdb.org/t/p/w500${episode.value.still_path}`;
});

const activeDubId = computed(() => {
  if (route.query.dub) {
    return Number(route.query.dub);
  }
  return dubbingProjects.value[0]?.id || null;
});

const activeDubProject = computed(() => {
  return (
    dubbingProjects.value.find((p: any) => p.id === activeDubId.value) ||
    dubbingProjects.value[0]
  );
});

const isOriginalLanguage = computed(() => {
  const orig = (episode.value?.original_language || episode.value?.show_original_language)?.toLowerCase();
  const dub = activeDubProject.value?.language?.toLowerCase();
  if (!orig || !dub) return false;
  return orig === dub || dub.startsWith(`${orig}-`) || orig.startsWith(`${dub}-`);
});

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return t('details.notSpecified', 'Not specified');
  try {
    const displayNames = new Intl.DisplayNames([locale.value || 'en'], { type: "language" });
    const name = displayNames.of(langCode);
    return (typeof name === 'string' && name.length > 0)
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch (e) {
    return langCode;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' });
};

// Format cast and attach voice actors
const formattedCast = computed(() => {
  if (!episode.value?.credits?.cast) return [];

  const works = activeDubProject.value?.works || [];

  return episode.value.credits.cast.map((actor: any) => {
    let profilePath = actor.profile_path;
    if (profilePath && profilePath.startsWith("/")) {
      profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
    }

    const work = works.find((w: any) => w.actor_id === actor.id);
    const voiceActor = work?.voice_actor;
    const workCharacterName = work?.character_name || null;

    let characterImage = null;
    const characterName =
      actor.roles?.map((r: any) => r.character).join(", ") || workCharacterName;
    if (characterName) {
      const namesToTry = [
        ...(actor.roles || []).map((r: any) => r.character).filter(Boolean),
        ...(workCharacterName ? [workCharacterName] : []),
      ];
      for (const name of namesToTry) {
        const match = characterProfilePictures.value.find(
          (c: any) => c.name && c.name.toLowerCase() === name.toLowerCase(),
        );
        if (match && match.image) {
          characterImage = match.image;
          break;
        }
      }
    }

    return {
      ...actor,
      profile_path: profilePath,
      voiceActor: voiceActor || null,
      characterImage,
      workCharacterName,
    };
  });
});

const searchQuery = ref("");
const debouncedSearch = refDebounced(searchQuery, 150);

const filteredCast = computed(() => {
  if (!debouncedSearch.value.trim()) return formattedCast.value;
  const query = debouncedSearch.value.toLowerCase().trim();
  return formattedCast.value.filter((actor: any) => {
    const actorName = actor.name?.toLowerCase() || "";
    const characterName = (
      actor.roles?.map((r: any) => r.character).join(", ") || ""
    ).toLowerCase();
    const vaName = actor.voiceActor
      ? `${actor.voiceActor.firstname || ""} ${actor.voiceActor.lastname || ""}`.toLowerCase()
      : "";
    const vaPerformance = actor.voiceActor?.performance?.toLowerCase() || "";
    return (
      actorName.includes(query) ||
      characterName.includes(query) ||
      vaName.includes(query) ||
      vaPerformance.includes(query)
    );
  });
});

const displayedCastCount = ref(36);
const visibleCast = computed(() => {
  return filteredCast.value.slice(0, displayedCastCount.value);
});
const hasMoreCast = computed(() => {
  return displayedCastCount.value < filteredCast.value.length;
});
const loadMoreCast = () => {
  displayedCastCount.value += 36;
};
const loadMoreSentinel = ref<HTMLElement | null>(null);
useIntersectionObserver(
  loadMoreSentinel,
  ([entry]) => {
    if (entry?.isIntersecting && hasMoreCast.value) {
      loadMoreCast();
    }
  },
  { rootMargin: '400px' },
);

watch(debouncedSearch, () => {
  displayedCastCount.value = 36;
});

useHead({
  title: computed(() => {
    let base = title.value;
    if (activeDubProject.value) {
      base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
    }
    return base.length > 55 ? base.substring(0, 52) + "..." : base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const episodeName = episode.value?.name || t('details.episode', { num: episode.value?.episode_number });
        let desc = episode.value?.overview || (episodeName ? t('seo.showDescription', { title: episodeName }) : t('seo.showDescriptionFallback', 'Découvrez le casting et les voix de l\'épisode.'));
        if (activeDubProject.value && episodeName) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title: episodeName }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "keywords",
      content: computed(() => {
        const episodeName = episode.value?.name || t('details.episode', { num: episode.value?.episode_number });
        if (!episodeName) return t("home.meta.keywords");
        return t("seo.showKeywords", { title: episodeName });
      }),
    },
    {
      property: "og:title",
      content: computed(() => {
        let base = title.value;
        if (activeDubProject.value) {
          base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      property: "og:description",
      content: computed(() => {
        const episodeName = episode.value?.name || t('details.episode', { num: episode.value?.episode_number });
        let desc = episode.value?.overview || (episodeName ? t('seo.showDescription', { title: episodeName }) : t('seo.showDescriptionFallback', 'Découvrez le casting et les voix de l\'épisode.'));
        if (activeDubProject.value && episodeName) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title: episodeName }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      property: "og:type",
      content: "video.episode",
    },
    {
      property: "og:url",
      content: computed(() => `https://dubbingbase.com/show/${showId}/season/${seasonNumber}/episode/${episodeNumber}${activeDubId.value ? `?dub=${activeDubId.value}` : ''}`),
    },
    {
      property: "og:image",
      content: computed(() => backdropUrl.value || posterUrl.value || ""),
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: computed(() => {
        let base = title.value;
        if (activeDubProject.value) {
          base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      name: "twitter:description",
      content: computed(() => {
        const episodeName = episode.value?.name || t('details.episode', { num: episode.value?.episode_number });
        let desc = episode.value?.overview || (episodeName ? t('seo.showDescription', { title: episodeName }) : t('seo.showDescriptionFallback', 'Découvrez le casting et les voix de l\'épisode.'));
        if (activeDubProject.value && episodeName) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title: episodeName }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "twitter:image",
      content: computed(() => backdropUrl.value || posterUrl.value || ""),
    },
  ],
  link: computed<any[]>(() => {
    const links: any[] = [
      { rel: 'preconnect', href: 'https://image.tmdb.org', crossorigin: '' },
      { rel: 'dns-prefetch', href: 'https://image.tmdb.org' },
      { rel: 'preconnect', href: 'https://thetvdb.com', crossorigin: '' },
      { rel: 'dns-prefetch', href: 'https://thetvdb.com' },
      {
        rel: "canonical",
        href: (() => {
          const baseUrl = `https://dubbingbase.com/show/${showId}/season/${seasonNumber}/episode/${episodeNumber}`;
          return activeDubId.value
            ? `${baseUrl}?dub=${activeDubId.value}`
            : baseUrl;
        })(),
      },
    ];
    if (backdropUrl.value) {
      links.push({
        rel: "preload",
        as: "image",
        href: backdropUrl.value,
      } as any);
    }
    return links;
  }),
});
</script>