<template>
  <div>
    <MediaSkeleton v-if="pending && !season" />
    <MediaDetailsLayout
      v-else-if="season"
      :title="`${serieName} - ${season.name || $t('details.season', { num: seasonNumber })}`"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <span class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          {{ season.air_date ? season.air_date.split('-')[0] : '' }}
          <template v-if="season.episode_count"> &bull; {{ season.episode_count }} {{ $t('details.episodes') }}</template>
        </span>
        <span class="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-bold text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          <StarIcon class="w-4 h-4 text-yellow-500 fill-current" />
          {{ season.vote_average?.toFixed(1) }}
        </span>
        <div class="flex gap-2 ml-2">
          <a :href="`https://www.themoviedb.org/tv/${showId}/season/${seasonNumber}`" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white/40 dark:bg-black/40 text-gray-800 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-black/60 transition-colors backdrop-blur-md uppercase tracking-wider">
            TMDB <ExternalLinkIcon class="w-3 h-3 opacity-70" />
          </a>
        </div>
      </template>

      <template #actions-left>
        <div v-if="dubbingProjects.length > 0" class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="project in dubbingProjects"
            :key="project.id"
            :to="{ query: { dub: project.id } }"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-[#2a2a2a]"
            :class="
              activeDubId === project.id
                ? 'bg-cyan-600 dark:bg-[#00E5FF] text-white dark:text-black border-cyan-600 dark:border-[#00E5FF]'
                : 'bg-white dark:bg-[#1d1d1d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
            "
          >
            {{
              $t("details.dubbing", {
                lang: getDisplayLanguage(project.language),
              })
            }}
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
          :to="localePath(`/show/${showId}`)"
          class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
          </svg>
          <span class="hidden sm:inline">{{ $t("details.backToShow", "Retour à la série") }}</span>
        </NuxtLink>

        <NuxtLink v-show="isAdmin" :to="localePath(`/show/${showId}/edit/${activeDubId || 'new'}`)" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span class="hidden sm:inline">{{ $t("details.modify") }}</span>
        </NuxtLink>
        
        <ForceEnqueueButton
          v-if="showId"
          media-type="season"
          :media-id="showId"
          :season-number="seasonNumber"
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
            <path
              d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
            />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
        </button>
      </template>

      <template #content>
        <!-- Overview -->
        <div class="mb-12 max-w-4xl">
        <section>
          <h2 class="text-2xl font-bold mb-4">
            {{ $t("details.synopsis") }}
          </h2>
          <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
            {{ season.overview || $t("details.noSynopsis") }}
          </p>
        </section>
      </div>

      <!-- Episodes List -->
      <section>
        <div class="flex flex-col mb-6 gap-2">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div>
              <h2 class="text-2xl font-bold">
                {{ $t("details.episodes") }}
              </h2>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          <NuxtLink
            v-for="episode in episodes"
            :key="episode.episode_number"
            :to="{ path: localePath(`/show/${showId}/season/${seasonNumber}/episode/${episode.episode_number}`), query: activeDubId ? { dub: activeDubId } : {} }"
            class="group cursor-pointer block bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-cyan-400 hover:shadow-md"
          >
            <div class="relative w-full aspect-video mb-3 rounded-lg overflow-hidden bg-gray-200 dark:bg-[#222]">
              <NuxtImg
                format="webp"
                v-if="episode.still_path"
                :src="episode.still_path.startsWith('http') ? episode.still_path : ('https://image.tmdb.org/t/p/w342' + episode.still_path)"
                loading="lazy"
                decoding="async"
                class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                alt="Episode"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-400">
                <ClapperboardIcon class="w-12 h-12 opacity-50" />
              </div>
              <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <span class="text-white text-xs font-bold">
                  {{ $t("details.episode", { num: episode.episode_number }) }}
                </span>
              </div>
            </div>
            <h3 class="font-semibold text-sm text-gray-900 dark:text-white line-clamp-2 group-hover:text-cyan-500 transition-colors mb-1">
              {{ episode.name || $t("details.episode", { num: episode.episode_number }) }}
            </h3>
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span v-if="episode.air_date">
                {{ formatDate(episode.air_date) }}
              </span>
              <span v-if="episode.vote_average">
                <StarIcon class="w-3 h-3 text-yellow-500 fill-current" />
                {{ episode.vote_average.toFixed(1) }}
              </span>
            </div>
          </NuxtLink>
        </div>
      </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {{ $t("details.notFound", "Saison introuvable") }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mb-6">
        {{ $t("details.notFoundDesc", "Impossible de charger les informations de cette saison.") }}
      </p>
      <NuxtLink
        :to="localePath(`/show/${showId}`)"
        class="px-4 py-2 bg-cyan-600 dark:bg-[#00E5FF] text-white dark:text-black font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {{ $t("details.backToShow", "Retour à la série") }}
      </NuxtLink>
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from "vue-router";

import { fetchShowData, fetchSeasonData } from "@app/shared-logic";
import { computed, ref } from "vue";
import {
  ClapperboardIcon,
  ExternalLinkIcon,
  StarIcon
} from "lucide-vue-next";
import ReportModal from "../../../../components/ReportModal.vue";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const showId = String(Array.isArray(route.params.id)
  ? route.params.id[0]
  : route.params.id);
const seasonNumber = Number(Array.isArray(route.params.seasonNumber)
  ? route.params.seasonNumber[0]
  : route.params.seasonNumber);
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const { locale, t } = useI18n();
const localePath = useLocalePath();

// Fetch show data for basic info
const showCacheKey = `show-${showId}-${locale.value}`;
const { data: showData, pending: showPending } = useAsyncData(
  showCacheKey,
  async () => {
    const nuxtApp = useNuxtApp();
    const cachedData = nuxtApp.payload.data[showCacheKey];
    const newData = await fetchShowData(showId, locale.value);
    
    if (
      newData && 
      newData.serie?.title === "Information indisponible (Timeout)" && 
      cachedData?.serie &&
      cachedData.serie.title !== "Information indisponible (Timeout)"
    ) {
      newData.serie = cachedData.serie;
      newData.characterProfilePictures = cachedData.characterProfilePictures;
    }
    
    return newData;
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const serie = computed(() => showData.value?.serie);
const serieName = computed(() => serie.value?.name || `Show ${showId}`);

// Fetch season data
const seasonCacheKey = `season-${showId}-${seasonNumber}-${locale.value}`;
const { data: seasonData, pending: seasonPending } = useAsyncData(
  seasonCacheKey,
  async () => {
    return await fetchSeasonData(showId, seasonNumber, locale.value);
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const season = computed(() => seasonData.value?.season);
const dubbingProjects = computed(() => {
  const projects = [...(seasonData.value?.dubbingProjects || [])];
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

const episodes = computed(() => {
  return season.value?.episodes || [];
});

const backdropUrl = computed(() => {
  const path = season.value?.backdrop_path || serie.value?.backdrop_path;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/original${path}`;
});

const posterUrl = computed(() => {
  const path = season.value?.poster_path || serie.value?.poster_path;
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/original${path}`;
});

const pending = computed(() => seasonPending.value);

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

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(locale.value, { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

useHead({
  title: computed(() => {
    const year = season.value?.air_date
      ? ` (${new Date(season.value.air_date).getFullYear()})`
      : "";
    let base = `${serieName.value} - Saison ${seasonNumber}${year}`;
    if (activeDubProject.value) {
      base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
    }
    return base.length > 55 ? base.substring(0, 52) + "..." : base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const title = `${serieName.value} - Saison ${seasonNumber}`;
        let desc = season.value?.overview || (title ? t('seo.showDescription', { title }) : t('seo.showDescriptionFallback', 'Découvrez le casting et les voix de la série.'));
        if (activeDubProject.value && title) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "keywords",
      content: computed(() => {
        const title = serieName.value || "";
        if (!title) return t("home.meta.keywords");
        return t("seo.showKeywords", { title });
      }),
    },
    {
      property: "og:title",
      content: computed(() => {
        const year = season.value?.air_date
          ? ` (${new Date(season.value.air_date).getFullYear()})`
          : "";
        let base = `${serieName.value} - Saison ${seasonNumber}${year}`;
        if (activeDubProject.value) {
          base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      property: "og:description",
      content: computed(() => {
        const title = `${serieName.value} - Saison ${seasonNumber}`;
        let desc = season.value?.overview || (title ? t('seo.showDescription', { title }) : t('seo.showDescriptionFallback', 'Découvrez le casting et les voix de la série.'));
        if (activeDubProject.value && title) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      property: "og:type",
      content: "video.tv_show",
    },
    {
      property: "og:url",
      content: computed(() => `https://dubbingbase.com/show/${showId}/season/${seasonNumber}${activeDubId.value ? `?dub=${activeDubId.value}` : ''}`),
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
        const year = season.value?.air_date
          ? ` (${new Date(season.value.air_date).getFullYear()})`
          : "";
        let base = `${serieName.value} - Saison ${seasonNumber}${year}`;
        if (activeDubProject.value) {
          base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      name: "twitter:description",
      content: computed(() => {
        const title = `${serieName.value} - Saison ${seasonNumber}`;
        let desc = season.value?.overview || (title ? t('seo.showDescription', { title }) : t('seo.showDescriptionFallback', 'Découvrez le casting et les voix de la série.'));
        if (activeDubProject.value && title) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title }) + ' ' + desc;
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
          const baseUrl = `https://dubbingbase.com/show/${showId}/season/${seasonNumber}`;
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