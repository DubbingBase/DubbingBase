<template>
  <div>
    <MediaSkeleton v-if="pending && !movie" />
    <MediaDetailsLayout
      v-else-if="movie"
      :share-dub="activeIsOriginal ? 'original' : activeDubProject?.id"
      :title="movie.title"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip>{{
          movie.release_date ? movie.release_date.split("-")[0] : ""
        }}</DetailsMetaChip>
        <DetailsMetaChip v-if="movie.original_title !== movie.title" variant="secondary">
          {{ movie.original_title }}
        </DetailsMetaChip>
        <DetailsMetaChip variant="rating">
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ movie.vote_average?.toFixed(1) }}
        </DetailsMetaChip>
        <div class="flex gap-2 ml-2">
          <DetailsExternalLink
            :href="`https://www.themoviedb.org/movie/${movie.id}`"
            :label="$t('common.tmdb')"
          />
          <DetailsExternalLink
            v-if="tvdbId"
            :href="`https://thetvdb.com/search?query=${tvdbId}`"
            :label="$t('common.tvdb')"
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
              ? {
                  active: isOriginalVersion,
                  count: movie?.credits?.cast?.length || 0,
                }
              : null
          "
        />
      </template>

      <template #actions-right>
        <DetailsStudioLink
          v-if="activeDubProject?.studio_data"
          :studio="activeDubProject.studio_data"
        />

        <DetailsEditLink
          v-if="isAdmin && movie?.id && !isOriginalVersion"
          :to="
            localePath(
              activeDubId
                ? `/movie/${movie.id}/projects/${activeDubId}/edit`
                : `/movie/${movie.id}/projects/new`,
            )
          "
          :label="$t('common.edit')"
        />

        <ForceEnqueueButton v-if="movie?.id" media-type="movie" :media-id="movie.id" />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis :text="movie.overview" />

        <!-- Voice Cast -->
        <section>
          <DetailsCastHeader
            v-model:search="searchInput"
            :title="$t('details.castAndCrew')"
            :subtitle="
              $t('media.rolesCount', {
                shown: castItems.length,
                total: castTotal,
              })
            "
          >
            <span v-if="isOriginalVersion" class="theme-text-muted text-sm">
              {{ $t("details.originalAudio") }}
            </span>
          </DetailsCastHeader>

          <PaginatedResponsiveGrid
            :key="searchQuery"
            :items="castCards"
            :total-items="castTotal"
            :page="castPage"
            :page-size="MEDIA_CAST_PAGE_SIZE"
            grid-class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
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
                      :is="actor.actorProfilePath ? NuxtLink : 'div'"
                      :to="actor.actorProfilePath"
                      class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                      :aria-label="actor.name"
                    >
                      <img
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
                        <span class="truncate block w-full">{{ cardLabels.actor }}</span>
                      </div>
                      <component
                        :is="actor.actorProfilePath ? NuxtLink : 'div'"
                        :to="actor.actorProfilePath"
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
                      >
                        <div
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <UserIcon class="w-8 h-8 opacity-50" />
                        </div>
                      </CharacterPhoto>
                    </div>
                    <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                      <div
                        class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                      >
                        <UserIcon class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate block w-full">{{ cardLabels.character }}</span>
                      </div>
                      <NuxtLink
                        v-if="actor.characterDetailPath"
                        :to="actor.characterDetailPath"
                        class="font-bold text-sm theme-text truncate block w-full hover:underline"
                        :title="actor.character || actor.workCharacterName || ''"
                      >
                        {{
                          actor.character || actor.workCharacterName || cardLabels.unknownCharacter
                        }}
                      </NuxtLink>
                      <div
                        v-else
                        class="font-bold text-sm theme-text truncate block w-full"
                        :title="actor.character || actor.workCharacterName || ''"
                      >
                        {{
                          actor.character || actor.workCharacterName || cardLabels.unknownCharacter
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
                        :to="actor.voiceActorProfilePath"
                        class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                        :aria-label="`${actor.voiceActor.firstname} ${actor.voiceActor.lastname}`"
                      >
                        <img
                          decoding="async"
                          loading="lazy"
                          v-if="actor.voiceActor.profile_picture"
                          :src="actor.voiceActor.profile_picture"
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
                          <span class="truncate block w-full">{{ cardLabels.voiceActor }}</span>
                        </div>
                        <NuxtLink
                          :to="actor.voiceActorProfilePath"
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
                        :is="actor.actorProfilePath ? NuxtLink : 'div'"
                        :to="actor.actorProfilePath"
                        class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                        :aria-label="actor.name"
                      >
                        <img
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
                          <span class="truncate block w-full">{{ cardLabels.actor }}</span>
                        </div>
                        <component
                          :is="actor.actorProfilePath ? NuxtLink : 'div'"
                          :to="actor.actorProfilePath"
                          class="font-bold text-sm theme-text truncate hover:underline block w-full"
                          :title="actor.name"
                        >
                          {{ actor.name }}
                        </component>
                      </div>
                    </template>
                    <template v-else>
                      <div
                        class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <div
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <UserIcon class="w-8 h-8 opacity-50" />
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                        <div
                          class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                        >
                          <MicIcon class="w-3 h-3 opacity-50 flex-shrink-0" />
                          <span class="truncate block w-full">{{ cardLabels.voiceActor }}</span>
                        </div>
                        <div class="text-sm theme-text-muted italic truncate block w-full">
                          {{ cardLabels.notSpecified }}
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </template>
          </PaginatedResponsiveGrid>
          <span class="block text-xs theme-text-muted mt-4">{{
            $t("media.rolesCount", {
              shown: castItems.length,
              total: castTotal,
            })
          }}</span>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else-if="!pending" class="text-center py-20 theme-text-muted min-h-screen">
      {{ $t("movie.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import DetailsDubTabs from "../../components/layout/details/DetailsDubTabs.vue";
import DetailsStudioLink from "../../components/layout/details/DetailsStudioLink.vue";
import DetailsEditLink from "../../components/layout/details/DetailsEditLink.vue";
import DetailsReportButton from "../../components/layout/details/DetailsReportButton.vue";
import DetailsMetaChip from "../../components/layout/details/DetailsMetaChip.vue";
import DetailsExternalLink from "../../components/layout/details/DetailsExternalLink.vue";
import DetailsSynopsis from "../../components/layout/details/DetailsSynopsis.vue";
import DetailsCastHeader from "../../components/layout/details/DetailsCastHeader.vue";
import { useRoute, useRouter } from "vue-router";
import type { Link as HeadLink } from "@unhead/vue";
import { NuxtLink } from "#components";

import { fetchMovieData, type MediaDetailDubbingProject } from "@app/shared-logic";
import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import { ArrowLeftIcon, ClapperboardIcon, UserIcon, MicIcon, StarIcon } from "lucide-vue-next";
import ReportModal from "../../components/ReportModal.vue";
import CharacterPhoto from "../../components/CharacterPhoto.vue";
import {
  useCharacterImages,
  type CharacterImageRequest,
} from "../../composables/useCharacterImages";
import {
  hasOriginalVersion,
  isOriginalVersionQuery,
  matchCastWorks,
  MEDIA_CAST_PAGE_SIZE,
  originalVersionCast,
  type DisplayCastActor,
  type MediaProjectView,
} from "../../utils/media-cast";

const STRUCTURED_DATA_CAST_LIMIT = 20;
const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const movieId = (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) || "";
const siteUrl = useSiteConfig().url;
const currentUrl = computed(() => new URL(route.fullPath, siteUrl).href);

const { isAdmin } = useClientUser();

const { locale, t } = useI18n();
const localePath = useLocalePath();
const localePrefix = useLocalePathPrefix();
// Labels are resolved once per render, not once per card.
const cardLabels = computed(() => ({
  actor: t("details.actor"),
  character: t("details.character"),
  voiceActor: t("details.voiceActor"),
  unknownCharacter: t("details.unknownCharacter"),
  notSpecified: t("details.notSpecified"),
}));
const pageUrl = computed(() => new URL(localePath(`/movie/${movieId}`), siteUrl).href);
const cacheKey = `movie-${movieId}-${locale.value}`;

const { data, pending, error } = await useAsyncData(
  cacheKey,
  () => fetchMovieData(movieId, locale.value, { projection: "media-page" }),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);
if (import.meta.server && error.value) throw error.value;

const movie = computed(() => data.value?.movie);
const dubbingProjectData = computed(() => {
  const projects: MediaDetailDubbingProject[] = [];
  const projectVoiceActorCounts = new WeakMap<MediaDetailDubbingProject, number>();

  for (const project of data.value?.dubbingProjects || []) {
    let hasVoiceActor = false;
    const voiceActorIds = new Set<number>();
    for (const work of project.works || []) {
      const voiceActorId = work.voice_actor_id ?? work.voice_actor?.id;
      if (voiceActorId !== undefined && voiceActorId !== null) hasVoiceActor = true;
      if (voiceActorId) voiceActorIds.add(voiceActorId);
    }

    if (!hasVoiceActor) continue;
    projects.push(project);
    projectVoiceActorCounts.set(project, voiceActorIds.size);
  }

  const currentLocale = locale.value.toLowerCase();
  projects.sort((a, b) => {
    const aIsPref = a.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;
    const bIsPref = b.language?.toLowerCase().startsWith(currentLocale) ? 1 : 0;

    if (aIsPref !== bIsPref) {
      return bIsPref - aIsPref;
    }

    const aWorks = a.works?.length || 0;
    const bWorks = b.works?.length || 0;
    return bWorks - aWorks;
  });

  return { projects, projectVoiceActorCounts };
});
const dubbingProjects = computed(() => dubbingProjectData.value.projects);
const canShowOriginalVersion = computed(() =>
  hasOriginalVersion(movie.value?.original_language, movie.value?.credits?.cast),
);
const originalVersionRequested = computed(() => isOriginalVersionQuery(route.query.dub));
const isOriginalVersion = computed(
  () => canShowOriginalVersion.value && originalVersionRequested.value,
);
const voiceActorsById = computed(
  () => new Map((data.value?.voiceActors || []).map((voiceActor) => [voiceActor.id, voiceActor])),
);

function projectVoiceActorCount(project: MediaDetailDubbingProject): number {
  return dubbingProjectData.value.projectVoiceActorCounts.get(project) ?? 0;
}

const backdropUrl = computed(() => {
  if (!movie.value?.backdrop_path) return null;
  if (movie.value.backdrop_path.startsWith("http")) return movie.value.backdrop_path;
  return `https://image.tmdb.org/t/p/original${movie.value.backdrop_path}`;
});

const posterUrl = computed(() => {
  if (!movie.value?.poster_path) return null;
  if (movie.value.poster_path.startsWith("http")) return movie.value.poster_path;
  return `https://image.tmdb.org/t/p/original${movie.value.poster_path}`;
});

const activeDubId = computed(() => {
  if (originalVersionRequested.value) return null;
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

const activeProjectView = computed<MediaProjectView<MediaDetailDubbingProject> | undefined>(() => {
  if (originalVersionRequested.value) {
    if (!isOriginalVersion.value || !movie.value?.original_language) return undefined;
    return {
      kind: "original",
      key: "original",
      language: movie.value.original_language,
    };
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

const getDisplayLanguage = useDubbingLanguageLabel();

// Format cast and attach voice actors
const formattedCast = computed<DisplayCastActor[]>(() => {
  if (!movie.value?.credits?.cast) return [];

  if (activeIsOriginal.value) return originalVersionCast(movie.value.credits.cast);

  // Get works (dubbing links) for the currently active dubbing project
  const works = activeDubProject.value?.works || [];

  const { matches, unmatchedWorks } = matchCastWorks(movie.value.credits.cast, works);

  const matchedCards = matches.flatMap(({ actor, works: actorWorks }) => {
    // TMDB returns profile_path without full URL sometimes in raw payload,
    // but the backend processMedia adds TMDB urls to it.
    // If it's a relative path starting with /, prepend tmdb url.
    let profilePath = actor.profile_path;
    if (profilePath && profilePath.startsWith("/")) {
      profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
    }

    // Find the voice actor work for this physical actor
    const cards = actorWorks.length > 0 ? actorWorks : [null];

    return cards.map((work) => {
      const voiceActor = work
        ? (work.voice_actor_id ? voiceActorsById.value.get(work.voice_actor_id) : undefined) ||
          work.voice_actor
        : undefined;
      // Fallback character name from DB when TMDB returns no character
      const workCharacterName = work?.character_name || null;

      return {
        ...actor,
        actorId: actor.id,
        id: work ? `${actor.id}-${work.id}` : actor.id,
        profile_path: profilePath,
        voiceActor: voiceActor ? { ...voiceActor, note: work?.note } : null,
        workCharacterName,
      };
    });
  });

  // Keep manually entered works visible even when TMDB no longer returns the
  // linked actor (or the work has no TMDB actor id).
  const unmatchedCards = unmatchedWorks.map((work) => {
    const voiceActor = work.voice_actor_id
      ? voiceActorsById.value.get(work.voice_actor_id)
      : work.voice_actor;

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

const searchQuery = ref("");
const searchInput = ref("");
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");
const debouncedSearch = refDebounced(searchInput, 150);
watch(debouncedSearch, (val) => {
  searchQuery.value = val;
});
watch([searchQuery, () => route.query.dub], () => void setCastPage(1));

const filteredCast = computed(() => {
  const cast = formattedCast.value;
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return cast;

  return cast.filter((actor: DisplayCastActor) => {
    const searchable = [
      actor.name,
      actor.character,
      actor.workCharacterName,
      actor.voiceActor?.firstname,
      actor.voiceActor?.lastname,
      `${actor.voiceActor?.firstname || ""} ${actor.voiceActor?.lastname || ""}`.trim(),
    ];
    return searchable.some((value) =>
      String(value || "")
        .toLowerCase()
        .includes(query),
    );
  });
});
const castTotal = computed(() => filteredCast.value.length);
const castItems = computed(() => {
  const start = (castPage.value - 1) * MEDIA_CAST_PAGE_SIZE;
  return filteredCast.value.slice(start, start + MEDIA_CAST_PAGE_SIZE).map((actor) => {
    return {
      ...actor,
      characterImageRequest: characterRequest(actor),
      actorProfilePath: actor.actorId ? localePrefix(`/actor/${actor.actorId}`) : undefined,
      voiceActorProfilePath: actor.voiceActor
        ? localePrefix(`/voice-actor/${actor.voiceActor.id}`)
        : undefined,
    };
  });
});

function characterRequest(actor: { character?: string | null; workCharacterName?: string | null }) {
  return {
    mediaType: "movie" as const,
    mediaId: String(route.params.id),
    names: [actor.character, actor.workCharacterName],
  };
}
const { imageFor, characterIdFor, reportImageError, tvdbIds } = useCharacterImages(
  computed(() => castItems.value.map((actor) => actor.characterImageRequest)),
);
const tvdbId = computed(() => tvdbIds.value[`movie:${route.params.id}`]);
function characterDetailPath(actor: {
  characterImageRequest: CharacterImageRequest;
}): string | undefined {
  const characterId = characterIdFor(actor.characterImageRequest);
  return characterId
    ? localePath({
        path: `/character/tvdb/${characterId}`,
        query: { mediaType: "movie", mediaId: route.params.id },
      })
    : undefined;
}

// Resolve asynchronous character links once per visible card, not in each binding.
const castCards = computed(() =>
  castItems.value.map((actor) => ({
    ...actor,
    characterDetailPath: characterDetailPath(actor),
  })),
);

useHead({
  title: computed(() => {
    const year = movie.value?.release_date
      ? ` (${new Date(movie.value.release_date).getFullYear()})`
      : "";
    let base = movie.value ? `${movie.value.title}${year}` : t("search.movie");
    if (activeDubProject.value) {
      base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
    }
    return base.length > 55 ? base.substring(0, 52) + "..." : base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const title = movie.value?.title || "";
        let desc =
          movie.value?.overview ||
          (title ? t("seo.movieDescription", { title }) : t("seo.movieDescriptionFallback"));
        if (activeDubProject.value && title) {
          desc =
            t("seo.movieDescriptionDubbing", {
              lang: getDisplayLanguage(activeDubProject.value.language),
              title,
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
        const title = movie.value?.title || "";
        if (!title) return t("home.meta.keywords");
        return t("seo.movieKeywords", { title });
      }),
    },
    {
      property: "og:title",
      content: computed(() => {
        const year = movie.value?.release_date
          ? ` (${new Date(movie.value.release_date).getFullYear()})`
          : "";
        let base = movie.value ? `${movie.value.title}${year}` : t("search.movie");
        if (activeDubProject.value) {
          base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      property: "og:description",
      content: computed(() => {
        const title = movie.value?.title || "";
        let desc =
          movie.value?.overview ||
          (title ? t("seo.movieDescription", { title }) : t("seo.movieDescriptionFallback"));
        if (activeDubProject.value && title) {
          desc =
            t("seo.movieDescriptionDubbing", {
              lang: getDisplayLanguage(activeDubProject.value.language),
              title,
            }) +
            " " +
            desc;
        }
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      property: "og:type",
      content: "video.movie",
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
        const year = movie.value?.release_date
          ? ` (${new Date(movie.value.release_date).getFullYear()})`
          : "";
        let base = movie.value ? `${movie.value.title}${year}` : t("search.movie");
        if (activeDubProject.value) {
          base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
        }
        return base.length > 55 ? base.substring(0, 52) + "..." : base;
      }),
    },
    {
      name: "twitter:description",
      content: computed(() => {
        const title = movie.value?.title || "";
        let desc =
          movie.value?.overview ||
          (title ? t("seo.movieDescription", { title }) : t("seo.movieDescriptionFallback"));
        if (activeDubProject.value && title) {
          desc =
            t("seo.movieDescriptionDubbing", {
              lang: getDisplayLanguage(activeDubProject.value.language),
              title,
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
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() => {
        const title = movie.value?.title || "";
        const json = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Movie",
          url: pageUrl.value,
          name: title || t("search.movie"),
          image: posterUrl.value || backdropUrl.value || "",
          description:
            movie.value?.overview ||
            (title ? t("seo.movieDescription", { title }) : t("seo.movieDescriptionFallback")),
          datePublished: movie.value?.release_date || undefined,
          // Bounded: structured data needs a representative cast, not hundreds of entries.
          actor: (movie.value?.credits?.cast ?? [])
            .slice(0, STRUCTURED_DATA_CAST_LIMIT)
            .map((actor) => ({
              "@type": "PerformanceRole",
              actor: {
                "@type": "Person",
                name: actor.name,
              },
              characterName: actor.character,
            })),
        });
        return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
      }),
    },
  ],
});
</script>
