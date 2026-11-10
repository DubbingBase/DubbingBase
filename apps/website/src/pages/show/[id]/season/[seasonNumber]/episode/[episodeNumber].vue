<template>
  <div>
    <MediaSkeleton v-if="pending && !episode" />
    <MediaDetailsLayout
      v-else-if="episode"
      :share-dub="activeIsOriginal ? 'original' : activeDubProject?.id"
      :title="title"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip>
          {{ $t("details.season", { num: seasonNumber }) }}{{ $t("common.separator")
          }}{{ $t("details.episode", { num: episode.episode_number }) }}
          <template v-if="episode.air_date"
            >{{ $t("common.separator") }}{{ formatDate(episode.air_date) }}</template
          >
        </DetailsMetaChip>
        <DetailsMetaChip v-if="episode.overview" variant="secondary">
          {{ episode.overview }}
        </DetailsMetaChip>
        <DetailsMetaChip variant="rating">
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ episode.vote_average?.toFixed(1) }}
        </DetailsMetaChip>
        <div class="flex gap-2 ml-2">
          <DetailsExternalLink
            :href="`https://www.themoviedb.org/tv/${showId}/season/${seasonNumber}/episode/${episodeNumber}`"
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
          :original="
            canShowOriginalVersion
              ? { active: isOriginalVersion, count: episodeCast.length || 0 }
              : null
          "
          :path="localePath(`/show/${showId}/season/${seasonNumber}/episode/${episodeNumber}`)"
        />
      </template>

      <template #actions-right>
        <DetailsStudioLink
          v-if="activeDubProject?.studio_data"
          :studio="activeDubProject.studio_data"
        />

        <DetailsBackLink
          :to="{
            path: localePath(`/show/${showId}/season/${seasonNumber}`),
            query: isOriginalVersion
              ? { dub: 'original' }
              : activeDubId
                ? { dub: activeDubId }
                : {},
          }"
          :label="$t('details.backToSeason')"
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
          media-type="episode"
          :media-id="showId"
          :season-number="seasonNumber"
          :episode-number="episodeNumber"
        />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis v-if="episode.overview" :text="episode.overview" />

        <!-- Voice Cast -->
        <section
          v-if="activeProjectError"
          role="alert"
          class="theme-surface border theme-border-subtle theme-border rounded-xl p-6 text-center"
        >
          <p class="theme-text-secondary mb-4">{{ $t("details.requestError") }}</p>
          <button
            type="button"
            class="px-4 py-2 theme-primary-bg font-semibold rounded-lg hover:opacity-90 transition-opacity"
            @click="retryActiveProjectWorks"
          >
            {{ $t("common.retry") }}
          </button>
        </section>
        <section v-else-if="castTotal > 0">
          <DetailsCastHeader v-model:search="searchQuery" :title="$t('details.castAndCrew')">
            <span v-if="isOriginalVersion" class="theme-text-muted text-sm">
              {{ $t("details.originalAudio") }}
            </span>
          </DetailsCastHeader>

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
                <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4">
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
                      <CharacterPhoto
                        :image="imageFor(actor.characterImageRequest)"
                        :alt="actor.character || actor.workCharacterName || ''"
                        @error="reportImageError(actor.characterImageRequest)"
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
                        :title="actor.roleLabel || actor.workCharacterName || ''"
                      >
                        {{
                          actor.roleLabel ||
                          actor.workCharacterName ||
                          $t("details.unknownCharacter")
                        }}
                      </div>
                    </div>
                  </div>

                  <!-- Voice Actor, or the original actor for the original version -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0"
                  >
                    <template v-if="actor.voiceActor && !isOriginalVersion">
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
                    <template v-else-if="isOriginalVersion">
                      <component
                        :is="actor.actorId ? NuxtLink : 'div'"
                        :to="actor.actorPath"
                        class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                        :aria-label="actor.name"
                      >
                        <NuxtImg
                          format="webp"
                          decoding="async"
                          loading="lazy"
                          v-if="actor.profile_path"
                          :src="actor.profile_path"
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
      <button
        type="button"
        class="px-4 py-2 mb-4 theme-primary-bg font-semibold rounded-lg hover:opacity-90 transition-opacity"
        @click="retryPageData"
      >
        {{ $t("common.retry") }}
      </button>
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
import DetailsDubTabs from "../../../../../../components/layout/details/DetailsDubTabs.vue";
import DetailsStudioLink from "../../../../../../components/layout/details/DetailsStudioLink.vue";
import DetailsEditLink from "../../../../../../components/layout/details/DetailsEditLink.vue";
import DetailsReportButton from "../../../../../../components/layout/details/DetailsReportButton.vue";
import DetailsBackLink from "../../../../../../components/layout/details/DetailsBackLink.vue";
import DetailsMetaChip from "../../../../../../components/layout/details/DetailsMetaChip.vue";
import DetailsExternalLink from "../../../../../../components/layout/details/DetailsExternalLink.vue";
import DetailsSynopsis from "../../../../../../components/layout/details/DetailsSynopsis.vue";
import DetailsCastHeader from "../../../../../../components/layout/details/DetailsCastHeader.vue";
import { useRoute, useRouter } from "vue-router";
import type { Link as HeadLink } from "@unhead/vue";
import { NuxtLink } from "#components";

import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import { ArrowLeftIcon, ClapperboardIcon, UserIcon, MicIcon, StarIcon } from "lucide-vue-next";
import ReportModal from "../../../../../../components/ReportModal.vue";
import {
  fetchEpisodePageData,
  fetchEpisodeProjectWorks,
  type EpisodePageDubbingProject,
  type EpisodePageProjectWorksResponse,
} from "../../../../../../utils/season-data";
import {
  type CastActorReference,
  type CastWorkReference,
  matchCastWorks,
  hasOriginalVersion,
  isOriginalVersionQuery,
  originalVersionCast,
  type DisplayCastActor,
  type MediaProjectView,
} from "../../../../../../utils/media-cast";
import CharacterPhoto from "../../../../../../components/CharacterPhoto.vue";
import {
  useCharacterImages,
  type CharacterImageRequest,
} from "../../../../../../composables/useCharacterImages";

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
  refresh: refreshPageData,
} = useAsyncData(
  cacheKey,
  async () => {
    const requestKey = cacheKey.value;
    const requestedProjectId =
      typeof route.query.dub === "string" &&
      Number.isSafeInteger(Number(route.query.dub)) &&
      Number(route.query.dub) > 0
        ? Number(route.query.dub)
        : undefined;
    const response = await fetchEpisodePageData(
      showId.value,
      seasonNumber.value,
      episodeNumber.value,
      locale.value,
      requestedProjectId,
    );
    return { requestKey, response };
  },
  {
    lazy: true,
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);

function retryPageData(): void {
  void refreshPageData();
}

const data = computed(() =>
  pageData.value?.requestKey === cacheKey.value ? pageData.value.response : undefined,
);
const episode = computed(() => data.value?.episode);
const projectDataById = ref(new Map<number, EpisodePageProjectWorksResponse>());
const projectDataErrors = ref(new Set<number>());
watch(data, (response) => {
  projectDataById.value.clear();
  projectDataErrors.value.clear();
  if (response?.activeProjectId !== null && response?.activeProjectId !== undefined) {
    projectDataById.value.set(response.activeProjectId, {
      projectId: response.activeProjectId,
      works: response.activeProjectWorks,
      voiceActors: response.voiceActors,
    });
  }
});
const requestError = computed(() => Boolean(error.value && error.value.statusCode !== 404));
const dubbingProjects = computed<EpisodePageDubbingProject[]>(
  () => data.value?.dubbingProjects || [],
);
const episodeCast = computed<CastActorReference[]>(
  () => data.value?.aggregateCredits?.cast || episode.value?.credits?.cast || [],
);
const canShowOriginalVersion = computed(() =>
  hasOriginalVersion(
    episode.value?.original_language || episode.value?.show_original_language,
    episodeCast.value,
  ),
);
const originalVersionRequested = computed(() => isOriginalVersionQuery(route.query.dub));
const isOriginalVersion = computed(
  () => canShowOriginalVersion.value && originalVersionRequested.value,
);

function projectVoiceActorCount(project: EpisodePageDubbingProject): number {
  return project.voiceActorCount;
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
  if (originalVersionRequested.value) return null;
  if (route.query.dub) {
    return Number(route.query.dub);
  }
  return dubbingProjects.value[0]?.id || null;
});

const activeProjectView = computed<MediaProjectView<EpisodePageDubbingProject> | undefined>(() => {
  const originalLanguage =
    episode.value?.original_language || episode.value?.show_original_language;
  if (originalVersionRequested.value) {
    if (!isOriginalVersion.value || !originalLanguage) return undefined;
    return { kind: "original", key: "original", language: originalLanguage };
  }
  const project =
    dubbingProjects.value.find((candidate) => candidate.id === activeDubId.value) ||
    dubbingProjects.value[0];
  return project ? { kind: "dubbing", key: project.id, project } : undefined;
});
const activeDubProject = computed(() =>
  activeProjectView.value?.kind === "dubbing" ? activeProjectView.value.project : undefined,
);
const activeIsOriginal = computed(() => activeProjectView.value?.kind === "original");
const activeProjectId = computed(() => activeDubProject.value?.id ?? null);
const voiceActorsById = computed(() => {
  const activeData = activeProjectId.value
    ? projectDataById.value.get(activeProjectId.value)
    : undefined;
  const voiceActors =
    activeData?.voiceActors ||
    (activeProjectId.value === data.value?.activeProjectId ? data.value.voiceActors : []);
  return new Map(voiceActors.map((voiceActor) => [voiceActor.id, voiceActor]));
});

async function loadProjectWorks(projectId: number): Promise<void> {
  if (projectDataById.value.has(projectId)) return;
  projectDataErrors.value.delete(projectId);
  try {
    const projectData = await fetchEpisodeProjectWorks(showId.value, projectId, locale.value);
    projectDataById.value.set(projectId, projectData);
  } catch (error) {
    console.error("Failed to load episode project works:", error);
    projectDataErrors.value.add(projectId);
  }
}

watch([data, activeProjectId], ([response, projectId]) => {
  if (!response || projectId === null || projectDataById.value.has(projectId)) return;
  void loadProjectWorks(projectId);
});
const activeProjectError = computed(
  () => activeProjectId.value !== null && projectDataErrors.value.has(activeProjectId.value),
);

function retryActiveProjectWorks(): void {
  const projectId = activeProjectId.value;
  if (projectId === null) return;
  void loadProjectWorks(projectId);
}

const getDisplayLanguage = useDubbingLanguageLabel();

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
  roleLabel: string;
  characterImageRequest: CharacterImageRequest;
  voiceActorPath: string;
};

const formattedCast = computed<DisplayCastActor[]>(() => {
  const cast = episodeCast.value;
  if (activeIsOriginal.value) return originalVersionCast(cast);
  const activeData = activeProjectId.value
    ? projectDataById.value.get(activeProjectId.value)
    : undefined;
  const works: CastWorkReference[] = activeProjectId.value
    ? activeData?.works ||
      (activeProjectId.value === data.value?.activeProjectId ? data.value.activeProjectWorks : [])
    : [];
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
    return {
      ...actor,
      actorPath: actor.actorId ? localePath(`/actor/${actor.actorId}`) : undefined,
      roleLabel: (actor.roles || []).map((role) => role.character).join(", "),
      characterImageRequest: characterRequest(actor),
      voiceActorPath: actor.voiceActor ? localePath(`/voice-actor/${actor.voiceActor.id}`) : "",
    };
  });
});

// Only original cast members have a production-scoped character image here.
function characterRequest(actor: {
  actorId?: number;
  character?: string | null;
  workCharacterName?: string | null;
}) {
  return {
    mediaType: "tv" as const,
    mediaId: showId.value,
    names: actor.actorId === undefined ? [] : [actor.character, actor.workCharacterName],
  };
}
const { imageFor, reportImageError } = useCharacterImages(
  computed(() => castItems.value.map((actor) => actor.characterImageRequest)),
);

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
