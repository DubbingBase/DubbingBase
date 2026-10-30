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
        <span
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ $t("details.season", { num: seasonNumber }) }}{{ $t("common.separator")
          }}{{ $t("details.episode", { num: episode.episode_number }) }}
          <template v-if="episode.air_date"
            >{{ $t("common.separator") }}{{ formatDate(episode.air_date) }}</template
          >
        </span>
        <span
          v-if="episode.overview"
          class="theme-text-secondary font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1.5 rounded-lg"
        >
          {{ episode.overview }}
        </span>
        <span
          class="flex items-center gap-1.5 theme-text font-bold text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ episode.vote_average?.toFixed(1) }}
        </span>
        <div class="flex gap-2 ml-2">
          <a
            :href="`https://www.themoviedb.org/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg theme-surface-overlay theme-text theme-hover-surface-muted transition-colors backdrop-blur-md uppercase tracking-wider"
            >{{ $t("common.tmdb") }}<ExternalLinkIcon class="w-3 h-3 opacity-70" />
          </a>
        </div>
      </template>

      <template #actions-left>
        <div v-if="dubbingProjects.length > 0" class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="project in dubbingProjects"
            :key="project.id"
            :to="{
              path: localePath(`/show/${showId}/season/${seasonNumber}/episode/${episodeNumber}`),
              query: { dub: project.id },
            }"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border theme-border-subtle theme-border flex items-center gap-1.5"
            :class="
              activeDubId === project.id
                ? 'theme-primary-bg theme-primary-border'
                : 'theme-surface theme-text-secondary theme-hover-surface-muted'
            "
          >
            {{ getDisplayLanguage(project.language) }}
            <span
              class="text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors"
              :class="
                activeDubId === project.id
                  ? 'bg-black/15 text-black'
                  : 'theme-surface-raised theme-surface-muted theme-text-muted'
              "
            >
              {{ projectVoiceActorCount(project) }}
            </span>
          </NuxtLink>
        </div>
        <div v-else class="text-sm theme-text-muted font-medium">
          {{ $t("details.noDubbingProjects") }}
        </div>
      </template>

      <template #actions-right>
        <template v-if="activeDubProject?.studio_data">
          <NuxtLink
            :to="localePath(`/studio/${activeDubProject.studio_data.id}`)"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border theme-border-subtle theme-border theme-hover-primary-border transition-colors group theme-surface-raised theme-surface"
            :title="$t('details.dubbingStudio')"
          >
            <div
              class="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 theme-surface-muted"
            >
              <img
                v-if="activeDubProject.studio_data.logo_url"
                :src="activeDubProject.studio_data.logo_url"
                class="w-full h-full object-contain p-0.5"
              />
              <span v-else class="font-bold text-xs theme-text-muted">{{
                activeDubProject.studio_data.name?.charAt(0) || ""
              }}</span>
            </div>
            <span
              class="font-medium text-xs theme-hover-primary-text transition-colors truncate max-w-[120px]"
              >{{ activeDubProject.studio_data.name }}</span
            >
          </NuxtLink>
          <div class="h-6 w-px theme-surface-muted"></div>
        </template>

        <NuxtLink
          :to="{
            path: localePath(`/show/${showId}/season/${seasonNumber}`),
            query: activeDubId ? { dub: activeDubId } : {},
          }"
          class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>
          <span class="hidden sm:inline">{{ $t("details.backToSeason") }}</span>
        </NuxtLink>

        <NuxtLink
          v-show="isAdmin"
          :to="
            localePath(
              activeDubId
                ? `/show/${showId}/projects/${activeDubId}/edit`
                : `/show/${showId}/projects/new`,
            )
          "
          class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
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
          class="text-sm theme-text-muted theme-hover-danger-text transition-colors flex items-center gap-1.5"
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
            <p class="theme-text-secondary leading-relaxed text-lg">
              {{ episode.overview }}
            </p>
          </section>
        </div>

        <!-- Voice Cast -->
        <section v-if="castTotal > 0">
          <div class="flex flex-col mb-6 gap-2">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
              <div>
                <h2 class="text-2xl font-bold">
                  {{ $t("details.castAndCrew") }}
                </h2>
              </div>

              <div class="relative w-full sm:w-64">
                <SearchIcon
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted"
                />
                <input
                  v-model="searchQuery"
                  type="search"
                  :placeholder="$t('search.placeholder')"
                  class="w-full theme-input border theme-border-subtle theme-border rounded-xl pl-10 pr-4 py-2 text-sm theme-focus transition-all theme-text"
                />
              </div>
            </div>
          </div>

          <PaginatedResponsiveGrid
            :items="castItems"
            :total-items="castTotal"
            :page="castPage"
            :page-size="12"
            grid-class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
            :item-key="(actor) => actor.id"
            @update:page="setCastPage"
          >
            <template #default="{ item: actor }">
              <div
                :key="actor.id"
                class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-border"
              >
                <div
                  class="flex flex-col sm:grid gap-4"
                  :class="isOriginalLanguage ? 'sm:grid-cols-2' : 'sm:grid-cols-3'"
                >
                  <!-- Original Actor -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start"
                  >
                    <component
                      :is="actor.actorId ? NuxtLink : 'div'"
                      :to="actor.actorPath"
                      class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        v-if="actor.profile_path"
                        :src="actor.profile_path"
                        decoding="async"
                        loading="lazy"
                        class="w-full h-full object-cover transition-transform duration-300"
                        alt="Actor"
                      />
                    </component>
                    <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                      <div
                        class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                      >
                        <ClapperboardIcon class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate block w-full">{{ $t("details.actor") }}</span>
                      </div>
                      <component
                        :is="actor.actorId ? NuxtLink : 'div'"
                        :to="actor.actorPath"
                        class="font-bold text-sm theme-text truncate hover:underline block w-full"
                        :title="actor.name"
                      >
                        {{ actor.name }}
                      </component>
                    </div>
                  </div>

                  <!-- Character -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start"
                  >
                    <div
                      class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        v-if="actor.characterImage"
                        :src="actor.characterImage"
                        decoding="async"
                        loading="lazy"
                        class="w-full h-full object-cover"
                        alt="Character"
                      />
                    </div>
                    <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                      <div
                        class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                      >
                        <UserIcon class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate block w-full">{{ $t("details.character") }}</span>
                      </div>
                      <div
                        class="font-bold text-sm theme-text truncate block w-full"
                        :title="actor.roleNames.join(', ') || actor.workCharacterName || ''"
                      >
                        {{
                          actor.roleNames.join(", ") ||
                          actor.workCharacterName ||
                          $t("details.unknownCharacter")
                        }}
                      </div>
                    </div>
                  </div>

                  <!-- Voice Actor (hidden when viewing in original language) -->
                  <div
                    v-if="!isOriginalLanguage"
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0"
                  >
                    <template v-if="actor.voiceActor">
                      <NuxtLink
                        :to="actor.voiceActorPath"
                        class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <NuxtImg
                          format="webp"
                          v-if="actor.voiceActor.profile_picture"
                          :src="actor.voiceActor.profile_picture"
                          decoding="async"
                          loading="lazy"
                          class="w-full h-full object-cover transition-transform duration-300"
                          alt="Voice Actor"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center text-2xl font-bold theme-text-muted"
                        >
                          {{ actor.voiceActor.firstname?.[0] }}{{ actor.voiceActor.lastname?.[0] }}
                        </div>
                      </NuxtLink>
                      <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                        <div
                          class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                        >
                          <MicIcon class="w-3 h-3 flex-shrink-0" />
                          <span class="truncate block w-full">{{ $t("details.voiceActor") }}</span>
                        </div>
                        <NuxtLink
                          :to="actor.voiceActorPath"
                          class="font-bold text-sm theme-text truncate hover:underline block w-full"
                          :title="actor.voiceActor.firstname + ' ' + actor.voiceActor.lastname"
                        >
                          {{ actor.voiceActor.firstname }}
                          {{ actor.voiceActor.lastname }}
                        </NuxtLink>
                        <div v-if="actor.voiceActor.note" class="text-xs theme-text-muted mt-1">
                          {{ actor.voiceActor.note }}
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div
                        class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-raised theme-input sm:mb-3 flex items-center justify-center border border-dashed theme-border-subtle theme-border flex-shrink-0"
                      >
                        <span class="theme-text-muted theme-text-secondary text-xs text-center px-2"
                          >?</span
                        >
                      </div>
                      <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                        <div
                          class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                        >
                          <MicIcon class="w-3 h-3 opacity-50 flex-shrink-0" />
                          <span class="truncate block w-full">{{ $t("details.voiceActor") }}</span>
                        </div>
                        <div class="text-sm theme-text-muted italic truncate block w-full">
                          {{ $t("details.notSpecified") }}
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </PaginatedResponsiveGrid>
        </section>
        <section v-else class="text-center py-12 theme-text-muted">
          {{ $t("details.noCast") }}
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
        :to="localePath(`/show/${showId}/season/${seasonNumber}`)"
        class="px-4 py-2 theme-primary-bg font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        {{ $t("details.backToSeason") }}
      </NuxtLink>
    </div>

    <div
      v-else-if="!pending"
      class="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center"
    >
      <h1 class="text-2xl font-bold theme-text mb-2">
        {{ $t("details.episodeNotFound") }}
      </h1>
      <p class="text-sm theme-text-secondary theme-text-muted mb-6">
        {{ $t("details.episodeNotFoundDesc") }}
      </p>
      <NuxtLink
        :to="localePath(`/show/${showId}/season/${seasonNumber}`)"
        class="px-4 py-2 theme-primary-bg font-semibold rounded-lg"
      >
        {{ $t("details.backToSeason") }}
      </NuxtLink>
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../../../../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from "vue-router";
import type { Link as HeadLink } from "@unhead/vue";
import { NuxtLink } from "#components";

import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import {
  ArrowLeftIcon,
  ClapperboardIcon,
  UserIcon,
  MicIcon,
  SearchIcon,
  ExternalLinkIcon,
  StarIcon,
} from "lucide-vue-next";
import ReportModal from "../../../../../../components/ReportModal.vue";
import {
  fetchEpisodePageData,
  type EpisodePageDubbingProject,
} from "../../../../../../utils/season-data";
import {
  type CastActorReference,
  type CastWorkReference,
  matchCastWorks,
  type DisplayCastActor,
} from "../../../../../../utils/media-cast";
import {
  indexCharacterPictures,
  type CharacterProfilePicture,
} from "../../../../../../utils/show-character-pictures";

const isReportModalOpen = ref(false);
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const showId = computed(
  () => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) || "",
);
const seasonNumber = computed(
  () =>
    (Array.isArray(route.params.seasonNumber)
      ? route.params.seasonNumber[0]
      : route.params.seasonNumber) || "1",
);
const episodeNumber = computed(
  () =>
    (Array.isArray(route.params.episodeNumber)
      ? route.params.episodeNumber[0]
      : route.params.episodeNumber) || "1",
);
const siteUrl = useSiteConfig().url;
const currentUrl = computed(() => new URL(route.fullPath, siteUrl).href);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === "admin";
});

const { locale, t } = useI18n();
const localePath = useLocalePath();
const languageDisplayNames = computed(() => {
  try {
    return new Intl.DisplayNames([locale.value || "en"], { type: "language" });
  } catch {
    return undefined;
  }
});
const pageUrl = computed(
  () =>
    new URL(
      localePath(
        `/show/${showId.value}/season/${seasonNumber.value}/episode/${episodeNumber.value}`,
      ),
      siteUrl,
    ).href,
);

const cacheKey = computed(
  () => `episode-${showId.value}-${seasonNumber.value}-${episodeNumber.value}-${locale.value}`,
);

const {
  data: pageData,
  pending,
  error,
} = useAsyncData(
  cacheKey,
  async () => {
    const requestKey = cacheKey.value;
    const response = await fetchEpisodePageData(
      showId.value,
      seasonNumber.value,
      episodeNumber.value,
      locale.value,
    );
    return { requestKey, response };
  },
  {
    lazy: true,
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);

const data = computed(() =>
  pageData.value?.requestKey === cacheKey.value ? pageData.value.response : undefined,
);
const characterProfilePictures = computed<CharacterProfilePicture[]>(
  () => data.value?.characterProfilePictures || [],
);
const characterPictureIndex = computed(() =>
  indexCharacterPictures(characterProfilePictures.value),
);
const episode = computed(() => data.value?.episode);
const voiceActorsById = computed(
  () => new Map((data.value?.voiceActors || []).map((voiceActor) => [voiceActor.id, voiceActor])),
);
const requestError = computed(() => Boolean(error.value && error.value.statusCode !== 404));
const projectVoiceActorMetrics = computed(() => {
  const visibleProjects: EpisodePageDubbingProject[] = [];
  const actorCounts = new Map<number, number>();

  for (const project of data.value?.dubbingProjects || []) {
    let hasVoiceActor = false;
    const actorIds = new Set<number>();

    for (const work of project.works || []) {
      const voiceActorId = work.voice_actor_id ?? work.voice_actor?.id;
      if (voiceActorId !== undefined && voiceActorId !== null) {
        hasVoiceActor = true;
        actorIds.add(voiceActorId);
      }
    }

    actorCounts.set(project.id, actorIds.size);
    if (hasVoiceActor) visibleProjects.push(project);
  }

  const currentLocale = locale.value.toLowerCase();
  visibleProjects.sort((a, b) => {
    const aIsPref = a.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;
    const bIsPref = b.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;

    if (aIsPref !== bIsPref) {
      return bIsPref - aIsPref;
    }

    const aWorks = a.works?.length || 0;
    const bWorks = b.works?.length || 0;
    return bWorks - aWorks;
  });

  return { projects: visibleProjects, actorCounts };
});
const dubbingProjects = computed<EpisodePageDubbingProject[]>(
  () => projectVoiceActorMetrics.value.projects,
);

function projectVoiceActorCount(project: EpisodePageDubbingProject): number {
  return projectVoiceActorMetrics.value.actorCounts.get(project.id) || 0;
}
const title = computed(() => {
  if (!episode.value) return t("search.tv");
  const episodeName =
    episode.value.name || t("details.episode", { num: episode.value.episode_number });
  return `${t("details.season", { num: seasonNumber.value })} · ${t("details.episode", { num: episode.value.episode_number })} - ${episodeName}`;
});

const backdropUrl = computed(() => {
  if (!episode.value?.still_path) return null;
  if (episode.value.still_path.startsWith("http")) return episode.value.still_path;
  return `https://image.tmdb.org/t/p/original${episode.value.still_path}`;
});

const posterUrl = computed(() => {
  if (!episode.value?.still_path) return null;
  if (episode.value.still_path.startsWith("http")) return episode.value.still_path;
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
    dubbingProjects.value.find((project) => project.id === activeDubId.value) ||
    dubbingProjects.value[0]
  );
});

const isOriginalLanguage = computed(() => {
  const orig = (
    episode.value?.original_language || episode.value?.show_original_language
  )?.toLowerCase();
  const dub = activeDubProject.value?.language?.toLowerCase();
  if (!orig || !dub) return false;
  return orig === dub || dub.startsWith(`${orig}-`) || orig.startsWith(`${dub}-`);
});

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return t("details.notSpecified");
  try {
    const name = languageDisplayNames.value?.of(langCode);
    return typeof name === "string" && name.length > 0
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch {
    return langCode;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale.value, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const searchQuery = ref("");
const debouncedSearch = refDebounced(searchQuery, 150);

watch([debouncedSearch, activeDubId], () => {
  void setCastPage(1);
});

type EpisodeDisplayCastActor = DisplayCastActor & {
  actorPath?: string;
  roleNames: string[];
  voiceActorPath: string;
};

const formattedCast = computed<DisplayCastActor[]>(() => {
  const cast: CastActorReference[] =
    data.value?.aggregateCredits?.cast || episode.value?.credits?.cast || [];
  const works: CastWorkReference[] = activeDubProject.value?.works || [];
  const { matches, unmatchedWorks } = matchCastWorks(cast, works);
  const matchedCards = matches.flatMap(({ actor, works: actorWorks }) =>
    actorWorks.map((work) => {
      let profilePath = actor.profile_path;
      if (profilePath?.startsWith("/")) {
        profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
      }
      const voiceActor =
        work.voice_actor_id === undefined
          ? work.voice_actor
          : work.voice_actor_id === null
            ? null
            : voiceActorsById.value.get(work.voice_actor_id);

      return {
        ...actor,
        actorId: actor.id,
        id: `${actor.id}-${work.id}`,
        profile_path: profilePath,
        voiceActor: voiceActor ? { ...voiceActor, note: work.note } : null,
        workCharacterName: work.character_name || null,
      };
    }),
  );
  const unmatchedCards = unmatchedWorks.map((work) => {
    const voiceActor =
      work.voice_actor_id === undefined
        ? work.voice_actor
        : work.voice_actor_id === null
          ? null
          : voiceActorsById.value.get(work.voice_actor_id);

    return {
      id: `work-${work.id}`,
      name: work.character_name || t("details.unknownCharacter"),
      profile_path: null,
      character: work.character_name || null,
      voiceActor: voiceActor ? { ...voiceActor, note: work.note } : null,
      characterImage: null,
      workCharacterName: work.character_name || null,
    };
  });
  return [...matchedCards, ...unmatchedCards];
});
const filteredCast = computed(() => {
  const cast = formattedCast.value;
  const query = debouncedSearch.value.trim().toLowerCase();
  if (!query) return cast;

  return cast.filter((actor: DisplayCastActor) => {
    const searchable = [
      actor.name,
      actor.character,
      actor.workCharacterName,
      actor.voiceActor?.firstname,
      actor.voiceActor?.lastname,
      `${actor.voiceActor?.firstname || ""} ${actor.voiceActor?.lastname || ""}`.trim(),
      ...(actor.roles || []).map((role) => role.character),
    ];
    return searchable.some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    );
  });
});
const castTotal = computed(() => filteredCast.value.length);
const castItems = computed<EpisodeDisplayCastActor[]>(() => {
  const start = (castPage.value - 1) * 12;
  return filteredCast.value.slice(start, start + 12).map((actor) => {
    const characterName = actor.character || actor.workCharacterName;
    let characterImage: string | null = null;
    if (actor.actorId !== undefined) {
      characterImage = characterName
        ? characterPictureIndex.value.get(characterName.toLowerCase()) || null
        : characterProfilePictures.value.find((picture) => !picture.name)?.image || null;
    }

    return {
      ...actor,
      actorPath: actor.actorId ? localePath(`/actor/${actor.actorId}`) : undefined,
      roleNames: (actor.roles || []).map((role) => role.character),
      voiceActorPath: actor.voiceActor ? localePath(`/voice-actor/${actor.voiceActor.id}`) : "",
      characterImage: characterImage || null,
    };
  });
});

useHead({
  title: computed(() => {
    let base = title.value;
    if (activeDubProject.value) {
      base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
    }
    return base.length > 55 ? base.substring(0, 52) + "..." : base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const episodeName =
          episode.value?.name || t("details.episode", { num: episode.value?.episode_number });
        let desc =
          episode.value?.overview ||
          (episodeName
            ? t("seo.showDescription", { title: episodeName })
            : t("seo.showDescriptionFallback"));
        if (activeDubProject.value && episodeName) {
          desc =
            t("seo.showDescriptionDubbing", {
              lang: getDisplayLanguage(activeDubProject.value.language),
              title: episodeName,
            }) +
            " " +
            desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "keywords",
      content: computed(() => {
        const episodeName =
          episode.value?.name || t("details.episode", { num: episode.value?.episode_number });
        if (!episodeName) return t("home.meta.keywords");
        return t("seo.showKeywords", { title: episodeName });
      }),
    },
    {
      property: "og:title",
      content: computed(() => {
        let base = title.value;
        if (activeDubProject.value) {
          base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      property: "og:description",
      content: computed(() => {
        const episodeName =
          episode.value?.name || t("details.episode", { num: episode.value?.episode_number });
        let desc =
          episode.value?.overview ||
          (episodeName
            ? t("seo.showDescription", { title: episodeName })
            : t("seo.showDescriptionFallback"));
        if (activeDubProject.value && episodeName) {
          desc =
            t("seo.showDescriptionDubbing", {
              lang: getDisplayLanguage(activeDubProject.value.language),
              title: episodeName,
            }) +
            " " +
            desc;
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
      content: pageUrl,
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
          base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      name: "twitter:description",
      content: computed(() => {
        const episodeName =
          episode.value?.name || t("details.episode", { num: episode.value?.episode_number });
        let desc =
          episode.value?.overview ||
          (episodeName
            ? t("seo.showDescription", { title: episodeName })
            : t("seo.showDescriptionFallback"));
        if (activeDubProject.value && episodeName) {
          desc =
            t("seo.showDescriptionDubbing", {
              lang: getDisplayLanguage(activeDubProject.value.language),
              title: episodeName,
            }) +
            " " +
            desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "twitter:image",
      content: computed(() => backdropUrl.value || posterUrl.value || ""),
    },
  ],
  link: computed<HeadLink[]>(() => {
    const links: HeadLink[] = [
      { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
      { rel: "dns-prefetch", href: "https://image.tmdb.org" },
      { rel: "preconnect", href: "https://thetvdb.com", crossorigin: "" },
      { rel: "dns-prefetch", href: "https://thetvdb.com" },
    ];
    if (backdropUrl.value) {
      links.push({
        rel: "preload",
        as: "image",
        href: backdropUrl.value,
      });
    }
    return links;
  }),
});
</script>
