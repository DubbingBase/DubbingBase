<template>
  <div v-if="route.params.episodeNumber === undefined">
    <MediaSkeleton v-if="pending && !season" />
    <MediaDetailsLayout
      v-else-if="season"
      :share-dub="isOriginalVersion ? 'original' : activeDubId"
      :title="seasonPageTitle"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip>
          {{ season.air_date ? season.air_date.split("-")[0] : "" }}
          <template v-if="season.episode_count"
            >{{ $t("common.separator") }}{{ season.episode_count }}
            {{ $t("details.episodes") }}</template
          >
        </DetailsMetaChip>
        <DetailsMetaChip variant="rating">
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ season.vote_average?.toFixed(1) }}
        </DetailsMetaChip>
        <div class="flex gap-2 ml-2">
          <DetailsExternalLink
            :href="`https://www.themoviedb.org/tv/${showId}/season/${seasonNumber}`"
            :label="$t('common.tmdb')"
          />
        </div>
      </template>

      <template #actions-left>
        <DetailsDubTabs
          :projects="dubbingProjects"
          :active-id="activeDubId ?? 0"
          :language-label="getDisplayLanguage"
          :count="projectVoiceActorCount"
        />
      </template>

      <template #actions-right>
        <DetailsStudioLink
          v-if="activeDubProject?.studio_data"
          :studio="activeDubProject.studio_data"
        />

        <DetailsBackLink
          :to="{
            path: localePath(`/show/${showId}`),
            query: isOriginalVersion ? { dub: 'original' } : {},
          }"
          :label="$t('details.backToShow')"
        />

        <DetailsEditLink
          v-show="isAdmin && !isOriginalVersion"
          :to="
            localePath(
              activeDubId
                ? `/show/${showId}/projects/${activeDubId}/edit`
                : `/show/${showId}/projects/new`,
            )
          "
          :label="$t('common.edit')"
        />

        <ForceEnqueueButton
          v-if="showId"
          media-type="season"
          :media-id="showId"
          :season-number="seasonNumber"
        />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis :text="season.overview" />

        <!-- Episodes List -->
        <section>
          <DetailsCastHeader :title="$t('details.episodes')" :searchable="false" />

          <PaginatedResponsiveGrid
            :items="episodeItems"
            :total-items="episodeTotal"
            :page="episodesPage"
            :page-size="12"
            grid-class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
            :item-key="(episode) => episode.episode_number"
            @update:page="setEpisodesPage"
          >
            <template #default="{ item: episode }">
              <NuxtLink
                :key="episode.episode_number"
                :to="episode.detailLocation"
                class="group cursor-pointer block theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-primary-border hover:shadow-md"
              >
                <div
                  class="relative w-full aspect-video mb-3 rounded-lg overflow-hidden theme-surface-muted"
                >
                  <NuxtImg
                    format="webp"
                    loading="lazy"
                    v-if="episode.still_path"
                    :src="episode.stillUrl"
                    decoding="async"
                    class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    alt="Episode"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center theme-text-muted"
                  >
                    <ClapperboardIcon class="w-12 h-12 opacity-50" />
                  </div>
                  <div
                    class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2"
                  >
                    <span class="text-white text-xs font-bold">
                      {{ $t("details.episode", { num: episode.episode_number }) }}
                    </span>
                  </div>
                </div>
                <h3
                  class="font-semibold text-sm theme-text line-clamp-2 theme-hover-primary-text transition-colors mb-1"
                >
                  {{ episode.name || $t("details.episode", { num: episode.episode_number }) }}
                </h3>
                <div class="flex items-center gap-2 text-xs theme-text-muted">
                  <span v-if="episode.air_date">
                    {{ episode.airDateLabel }}
                  </span>
                  <span v-if="episode.vote_average">
                    <StarIcon class="w-3 h-3 theme-rating fill-current" />
                    {{ episode.vote_average.toFixed(1) }}
                  </span>
                </div>
              </NuxtLink>
            </template>
          </PaginatedResponsiveGrid>
        </section>
      </template>
    </MediaDetailsLayout>

    <div
      v-else-if="requestError"
      class="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center"
    >
      <h1 class="text-2xl font-bold theme-text mb-2">
        {{ $t("common.error") }}
      </h1>
      <p class="theme-text-secondary theme-text-muted mb-6">
        {{ $t("details.requestError") }}
      </p>
      <NuxtLink
        :to="localePath(`/show/${showId}`)"
        class="px-4 py-2 theme-primary-bg font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {{ $t("details.backToShow") }}
      </NuxtLink>
    </div>

    <div
      v-else-if="!pending"
      class="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center"
    >
      <h1 class="text-2xl font-bold theme-text mb-2">
        {{ $t("details.seasonNotFound") }}
      </h1>
      <p class="theme-text-secondary theme-text-muted mb-6">
        {{ $t("details.notFoundDesc") }}
      </p>
      <NuxtLink
        :to="localePath(`/show/${showId}`)"
        class="px-4 py-2 theme-primary-bg font-semibold rounded-lg"
      >
        {{ $t("details.backToShow") }}
      </NuxtLink>
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
  <NuxtPage v-else />
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../../../components/layout/MediaDetailsLayout.vue";
import DetailsDubTabs from "../../../../components/layout/details/DetailsDubTabs.vue";
import DetailsStudioLink from "../../../../components/layout/details/DetailsStudioLink.vue";
import DetailsEditLink from "../../../../components/layout/details/DetailsEditLink.vue";
import DetailsReportButton from "../../../../components/layout/details/DetailsReportButton.vue";
import DetailsBackLink from "../../../../components/layout/details/DetailsBackLink.vue";
import DetailsMetaChip from "../../../../components/layout/details/DetailsMetaChip.vue";
import DetailsExternalLink from "../../../../components/layout/details/DetailsExternalLink.vue";
import DetailsSynopsis from "../../../../components/layout/details/DetailsSynopsis.vue";
import DetailsCastHeader from "../../../../components/layout/details/DetailsCastHeader.vue";
import { useRoute, useRouter } from "vue-router";
import type { Link as HeadLink } from "@unhead/vue";
import { fetchSeasonPageData, type SeasonPageDubbingProject } from "../../../../utils/season-data";
import { computed, ref } from "vue";
import { ClapperboardIcon, StarIcon } from "lucide-vue-next";
import ReportModal from "../../../../components/ReportModal.vue";
import { isOriginalVersionQuery } from "../../../../utils/media-cast";

const isReportModalOpen = ref(false);

const route = useRoute();
const isSeasonRoute = computed(() => route.params.episodeNumber === undefined);
const router = useRouter();
const supabase = useSupabaseClient();
const showId = computed(() =>
  String(Array.isArray(route.params.id) ? route.params.id[0] : route.params.id),
);
const seasonNumber = computed(() =>
  Number(
    Array.isArray(route.params.seasonNumber)
      ? route.params.seasonNumber[0]
      : route.params.seasonNumber,
  ),
);
const siteUrl = useSiteConfig().url;
const currentUrl = computed(() => new URL(route.fullPath, siteUrl).href);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === "admin";
});
const isOriginalVersion = computed(() => isOriginalVersionQuery(route.query.dub));

const { locale, t } = useI18n();
const localePath = useLocalePath();
const pageUrl = computed(
  () => new URL(localePath(`/show/${showId.value}/season/${seasonNumber.value}`), siteUrl).href,
);

const seasonLabel = computed(
  () => season.value?.name || t("details.season", { num: seasonNumber.value }),
);
const localizedSeasonNumber = computed(() => t("details.season", { num: seasonNumber.value }));
const seasonPageTitle = computed(() =>
  serieName.value ? `${serieName.value} - ${seasonLabel.value}` : seasonLabel.value,
);
const seasonSeoTitle = computed(() => {
  const year = season.value?.air_date ? ` (${new Date(season.value.air_date).getFullYear()})` : "";
  let base = serieName.value
    ? `${serieName.value} - ${localizedSeasonNumber.value}${year}`
    : `${localizedSeasonNumber.value}${year}`;
  if (activeDubProject.value) {
    base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
  }
  return base.length > 55 ? base.substring(0, 52) + "..." : base;
});
const seasonSeoDescription = computed(() => {
  const title = serieName.value ? `${serieName.value} - ${localizedSeasonNumber.value}` : "";
  let description =
    season.value?.overview ||
    (title ? t("seo.showDescription", { title }) : t("seo.showDescriptionFallback"));
  if (activeDubProject.value && title) {
    description =
      t("seo.showDescriptionDubbing", {
        lang: getDisplayLanguage(activeDubProject.value.language),
        title,
      }) +
      " " +
      description;
  }
  return description.length > 160 ? description.substring(0, 157) + "..." : description;
});

// Fetch season data
const seasonRequestIdentity = computed(() => ({
  showId: showId.value,
  seasonNumber: seasonNumber.value,
  locale: locale.value,
  active: isSeasonRoute.value,
}));
const seasonCacheKey = computed(() => {
  const { showId, seasonNumber, locale, active } = seasonRequestIdentity.value;
  return `season-${showId}-${seasonNumber}-${locale}${active ? "" : "-nested"}`;
});
const {
  data: seasonData,
  pending: seasonPending,
  error: seasonError,
  refresh: refreshSeasonData,
} = useAsyncData(
  seasonCacheKey,
  async () => {
    const requestIdentity = seasonRequestIdentity.value;
    if (!requestIdentity.active) return { requestIdentity, response: null };

    const response = await fetchSeasonPageData(
      requestIdentity.showId,
      requestIdentity.seasonNumber,
      requestIdentity.locale,
    );

    return { requestIdentity, response };
  },
  {
    lazy: true,
    dedupe: "defer",
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);

if (import.meta.server) {
  const requestEvent = useRequestEvent();
  onServerPrefetch(async () => {
    await refreshSeasonData();
    if (seasonError.value && requestEvent) {
      setResponseStatus(requestEvent, seasonError.value.statusCode ?? 500);
    }
  });
}

const currentSeasonData = computed(() => {
  const result = seasonData.value;
  if (!result) return undefined;

  const currentIdentity = seasonRequestIdentity.value;
  const requestIdentity = result.requestIdentity;

  if (
    !currentIdentity.active ||
    !requestIdentity.active ||
    requestIdentity.showId !== currentIdentity.showId ||
    requestIdentity.seasonNumber !== currentIdentity.seasonNumber ||
    requestIdentity.locale !== currentIdentity.locale
  ) {
    return undefined;
  }

  return result.response;
});

const serie = computed(() => currentSeasonData.value?.serie);
const serieName = computed(() => serie.value?.name || "");
const season = computed(() => currentSeasonData.value?.season);
const dubbingProjects = computed(() => {
  const visibleProjects = (currentSeasonData.value?.dubbingProjects || []).filter(
    (project) => project.has_voice_actor,
  );
  const currentLocale = locale.value.toLowerCase();
  visibleProjects.sort((a, b) => {
    const aIsPref = a.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;
    const bIsPref = b.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;

    if (aIsPref !== bIsPref) {
      return bIsPref - aIsPref;
    }

    return b.work_count - a.work_count;
  });

  return visibleProjects;
});

function projectVoiceActorCount(project: SeasonPageDubbingProject): number {
  return project.voice_actor_count;
}

const { page: episodesPage, setPage: setEpisodesPage } = useUrlPagination("episodesPage");
type SeasonEpisode = {
  episode_number: number;
  name?: string | null;
  air_date?: string | null;
  still_path?: string | null;
  vote_average?: number;
};
const seasonEpisodes = computed<SeasonEpisode[]>(() =>
  Array.isArray(season.value?.episodes) ? season.value.episodes : [],
);
const episodeTotal = computed(() => seasonEpisodes.value.length);
const episodeItems = computed(() => {
  const start = (episodesPage.value - 1) * 12;
  return seasonEpisodes.value.slice(start, start + 12).map((episode) => ({
    ...episode,
    detailLocation: {
      path: localePath(
        `/show/${showId.value}/season/${seasonNumber.value}/episode/${episode.episode_number}`,
      ),
      query: isOriginalVersion.value
        ? { dub: "original" }
        : activeDubId.value
          ? { dub: activeDubId.value }
          : {},
    },
    stillUrl: episode.still_path?.startsWith("http")
      ? episode.still_path
      : episode.still_path
        ? `https://image.tmdb.org/t/p/w342${episode.still_path}`
        : undefined,
    airDateLabel: episode.air_date ? formatDate(episode.air_date) : "",
  }));
});

const backdropUrl = computed(() => {
  const path = season.value?.backdrop_path || serie.value?.backdrop_path;
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/original${path}`;
});

const posterUrl = computed(() => {
  const path = season.value?.poster_path || serie.value?.poster_path;
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/original${path}`;
});

const pending = computed(() => seasonPending.value);
const requestError = computed(() =>
  Boolean(seasonError.value && seasonError.value.statusCode !== 404),
);

const activeDubId = computed(() => {
  if (isOriginalVersion.value) return null;
  if (route.query.dub) {
    const requestedId = Number(route.query.dub);
    if (
      Number.isSafeInteger(requestedId) &&
      dubbingProjects.value.some((project) => project.id === requestedId)
    ) {
      return requestedId;
    }
  }
  return dubbingProjects.value[0]?.id || null;
});

const activeDubProject = computed(() => {
  if (isOriginalVersion.value) return undefined;
  return (
    dubbingProjects.value.find((p: SeasonPageDubbingProject) => p.id === activeDubId.value) ||
    dubbingProjects.value[0]
  );
});

const getDisplayLanguage = useDubbingLanguageLabel();

const seasonEpisodeDateFormatOptions: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};
const seasonEpisodeDateFormatter = computed<Intl.DateTimeFormat | undefined>(() => {
  try {
    return new Intl.DateTimeFormat(locale.value, seasonEpisodeDateFormatOptions);
  } catch {
    return undefined;
  }
});

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return date.toLocaleDateString(locale.value, seasonEpisodeDateFormatOptions);
  }

  return (
    seasonEpisodeDateFormatter.value?.format(date) ??
    date.toLocaleDateString(locale.value, seasonEpisodeDateFormatOptions)
  );
};

useHead({
  title: computed(() => {
    if (!isSeasonRoute.value) return undefined;
    return seasonSeoTitle.value;
  }),
  meta: computed(() =>
    isSeasonRoute.value
      ? [
          {
            name: "description",
            content: seasonSeoDescription,
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
            content: seasonSeoTitle,
          },
          {
            property: "og:description",
            content: seasonSeoDescription,
          },
          {
            property: "og:type",
            content: "video.tv_show",
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
            content: seasonSeoTitle,
          },
          {
            name: "twitter:description",
            content: seasonSeoDescription,
          },
          {
            name: "twitter:image",
            content: computed(() => backdropUrl.value || posterUrl.value || ""),
          },
        ]
      : [],
  ),
  link: computed<HeadLink[]>(() => {
    if (!isSeasonRoute.value) return [];
    const links: HeadLink[] = [
      { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
      { rel: "dns-prefetch", href: "https://image.tmdb.org" },
      { rel: "preconnect", href: "https://thetvdb.com", crossorigin: "" },
      { rel: "dns-prefetch", href: "https://thetvdb.com" },
    ];
    if (backdropUrl.value) {
      links.push({ rel: "preload", as: "image", href: backdropUrl.value });
    }
    return links;
  }),
});
</script>
