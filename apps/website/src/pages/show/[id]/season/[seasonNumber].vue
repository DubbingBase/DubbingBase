<template>
  <div>
    <MediaSkeleton v-if="pending && !season" />
    <MediaDetailsLayout
      v-else-if="season"
      :title="season.name || $t('details.season', { number: season.season_number })"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <span class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          {{ $t('details.season', { number: season.season_number }) }}
          <template v-if="season.air_date"> &bull; {{ formatDate(season.air_date) }}</template>
          <template v-if="season.episode_count"> &bull; {{ season.episode_count }} {{ $t('details.episodes') }}</template>
        </span>
        <span v-if="season.overview" class="text-gray-800 dark:text-gray-300 font-medium text-sm md:text-base bg-white/40 dark:bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg">
          {{ season.overview }}
        </span>
        <span class="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-bold text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg">
          <StarIcon class="w-4 h-4 text-yellow-500 fill-current" />
          {{ season.vote_average?.toFixed(1) }}
        </span>
      </template>

      <template #actions-left>
        <div v-if="dubbingProjects.length > 0" class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="project in dubbingProjects"
            :key="project.id"
            :to="$localePath(`/show/${showId}/season/${seasonNumber}?dub=${project.id}`)"
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
        <NuxtLink v-show="isAdmin" :to="$localePath(`/show/${showId}/edit/${activeDubId || 'new'}`)" class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span class="hidden sm:inline">{{ $t("details.modify") }}</span>
        </NuxtLink>
        
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
          <section v-if="season.overview">
            <h2 class="text-2xl font-bold mb-4">
              {{ $t("details.synopsis") }}
            </h2>
            <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
              {{ season.overview }}
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

          <div v-if="episodes.length === 0" class="text-center py-12 text-gray-500 dark:text-gray-400">
            {{ $t('details.noEpisodes') }}
          </div>

          <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            <NuxtLink
              v-for="ep in episodes"
              :key="ep.episode_number"
              :to="$localePath(`/show/${showId}/season/${seasonNumber}/episode/${ep.episode_number}${activeDubId ? `?dub=${activeDubId}` : ''}")"
              class="group cursor-pointer block bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md"
            >
              <div class="relative w-full aspect-video rounded-xl overflow-hidden mb-4 bg-gray-200 dark:bg-[#222]">
                <NuxtImg
                  format="webp"
                  v-if="ep.still_path"
                  :src="'https://image.tmdb.org/t/p/w780' + ep.still_path"
                  class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  :alt="ep.name"
                />
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1">
                  <ClapperboardIcon class="w-3 h-3 flex-shrink-0" />
                  <span class="truncate block w-full">
                    {{ $t("details.episode", { number: ep.episode_number }) }}
                  </span>
                </div>
                <h3 class="font-bold text-sm text-gray-900 dark:text-white truncate hover:underline group-hover:text-cyan-500 transition-colors block w-full">
                  {{ ep.name }}
                </h3>
                <div v-if="ep.air_date" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ formatDate(ep.air_date) }}
                </div>
                <div v-if="ep.vote_average" class="flex items-center gap-1 text-xs text-yellow-500 mt-1">
                  <StarIcon class="w-3 h-3 fill-current" />
                  {{ ep.vote_average.toFixed(1) }}
                </div>
              </div>
            </NuxtLink>
          </div>
        </section>
      </template>
    </MediaDetailsLayout>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from "vue-router";

import { fetchSeasonData, fetchShowData } from "@app/shared-logic";
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
const showId = Array.isArray(route.params.id)
  ? route.params.id[0]
  : route.params.id;
const seasonNumber = Array.isArray(route.params.seasonNumber)
  ? route.params.seasonNumber[0]
  : route.params.seasonNumber;
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});

const { locale, t } = useI18n();

const cacheKey = `season-${showId}-${seasonNumber}-${locale.value}`;

const { data, pending } = useAsyncData(cacheKey, async () => {
  const nuxtApp = useNuxtApp();
  const cachedData = nuxtApp.payload.data[cacheKey];

  const newData = await fetchSeasonData(showId, seasonNumber, locale.value);
  
  return newData;
});

const season = computed(() => data.value?.season);
const dubbingProjects = computed(() => {
  const projects = [...(data.value?.dubbingProjects || [])];
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
const characterProfilePictures = computed(
  () => data.value?.characterProfilePictures || [],
);
const episodes = computed(() => season.value?.episodes || []);

const backdropUrl = computed(() => {
  if (!season.value?.backdrop_path) return null;
  if (season.value.backdrop_path.startsWith('http')) return season.value.backdrop_path;
  return `https://image.tmdb.org/t/p/original${season.value.backdrop_path}`;
});

const posterUrl = computed(() => {
  if (!season.value?.poster_path) return null;
  if (season.value.poster_path.startsWith('http')) return season.value.poster_path;
  return `https://image.tmdb.org/t/p/original${season.value.poster_path}`;
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

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return t('details.notSpecified', 'Not specified');
  try {
    const displayNames = new Intl.DisplayNames([locale.value || 'en'], { type: "language" });
    const name = displayNames.of(langCode);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : langCode;
  } catch (e) {
    return langCode;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' });
};

useHead({
  title: computed(() => {
    const seasonNum = season.value?.season_number;
    let base = season.value ? `${$t('details.season', { number: seasonNum })} - ${season.value.name || ''}` : $t('search.tv', 'Series');
    if (activeDubProject.value) {
      base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
    }
    return base.length > 55 ? base.substring(0, 52) + "..." : base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const seasonName = season.value?.name || $t('details.season', { number: season.value?.season_number });
        let desc = season.value?.overview || (seasonName ? t('seo.showDescription', { title: seasonName }) : t('seo.showDescriptionFallback', 'Découvrez les épisodes de la saison.'));
        if (activeDubProject.value && seasonName) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title: seasonName }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "keywords",
      content: computed(() => {
        const seasonName = season.value?.name || $t('details.season', { number: season.value?.season_number });
        if (!seasonName) return t("home.meta.keywords");
        return t("seo.showKeywords", { title: seasonName });
      }),
    },
    {
      property: "og:title",
      content: computed(() => {
        const seasonNum = season.value?.season_number;
        let base = season.value ? `${$t('details.season', { number: seasonNum })} - ${season.value.name || ''}` : t('search.tv', 'Series');
        if (activeDubProject.value) {
          base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      property: "og:description",
      content: computed(() => {
        const seasonName = season.value?.name || $t('details.season', { number: season.value?.season_number });
        let desc = season.value?.overview || (seasonName ? t('seo.showDescription', { title: seasonName }) : t('seo.showDescriptionFallback', 'Découvrez les épisodes de la saison.'));
        if (activeDubProject.value && seasonName) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title: seasonName }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      property: "og:type",
      content: "video.tv_season",
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
        const seasonNum = season.value?.season_number;
        let base = season.value ? `${$t('details.season', { number: seasonNum })} - ${season.value.name || ''}` : t('search.tv', 'Series');
        if (activeDubProject.value) {
          base += ` - ${t('details.dubbing', { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      name: "twitter:description",
      content: computed(() => {
        const seasonName = season.value?.name || $t('details.season', { number: season.value?.season_number });
        let desc = season.value?.overview || (seasonName ? t('seo.showDescription', { title: seasonName }) : t('seo.showDescriptionFallback', 'Découvrez les épisodes de la saison.'));
        if (activeDubProject.value && seasonName) {
          desc = t('seo.showDescriptionDubbing', { lang: getDisplayLanguage(activeDubProject.value.language), title: seasonName }) + ' ' + desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "twitter:image",
      content: computed(() => backdropUrl.value || posterUrl.value || ""),
    },
  ],
  link: computed(() => {
    const links = [
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