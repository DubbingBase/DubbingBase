<template>
  <div v-if="route.params.seasonNumber === undefined">
    <MediaSkeleton v-if="pending && !serie" />
    <MediaDetailsLayout
      v-else-if="serie"
      :share-dub="activeIsOriginal ? 'original' : activeDubProject?.id"
      :title="serie.name"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip>
          {{ serie.first_air_date ? serie.first_air_date.split("-")[0] : "" }}
          <template v-if="serie.number_of_seasons"
            >{{ $t("common.separator") }}{{ serie.number_of_seasons }}
            {{ $t("details.seasons") }}</template
          >
        </DetailsMetaChip>
        <DetailsMetaChip v-if="serie.original_name !== serie.name" variant="secondary">
          {{ serie.original_name }}
        </DetailsMetaChip>
        <DetailsMetaChip variant="rating">
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ serie.vote_average?.toFixed(1) }}
        </DetailsMetaChip>
        <div class="flex gap-2 ml-2">
          <DetailsExternalLink
            :href="`https://www.themoviedb.org/tv/${serie.id}`"
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
                  count: aggregateCredits.cast?.length || 0,
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
          v-if="isAdmin && serie?.id && !isOriginalVersion"
          :to="
            localePath(
              activeDubId
                ? `/show/${serie.id}/projects/${activeDubId}/edit`
                : `/show/${serie.id}/projects/new`,
            )
          "
          :label="$t('common.edit')"
        />

        <ForceEnqueueButton v-if="serie?.id" media-type="tv" :media-id="serie.id" />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis :text="serie.overview" />

        <!-- Seasons -->
        <section v-if="seasonTotal > 0" class="mb-10">
          <h2 class="text-2xl font-bold mb-6">
            {{ $t("details.seasons") }}
          </h2>
          <PaginatedResponsiveGrid
            :items="seasonItems"
            :total-items="seasonTotal"
            :page="seasonsPage"
            :page-size="12"
            grid-class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6"
            :item-key="(season) => season.season_number"
            @update:page="setSeasonsPage"
          >
            <template #default="{ item: season }">
              <NuxtLink
                :key="season.season_number"
                :to="{
                  path: localePath(`/show/${serie.id}/season/${season.season_number}`),
                  query: isOriginalVersion
                    ? { dub: 'original' }
                    : activeDubId
                      ? { dub: activeDubId }
                      : {},
                }"
                class="group cursor-pointer block theme-input border theme-border-subtle theme-border rounded-2xl p-3 shadow-sm transition-colors theme-hover-border hover:shadow-md"
              >
                <div
                  class="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 theme-surface-muted"
                >
                  <NuxtImg
                    format="webp"
                    decoding="async"
                    loading="lazy"
                    v-if="season.poster_path"
                    :src="season.poster_path"
                    class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    :alt="season.name"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center theme-text-muted theme-text-secondary"
                  >
                    <ClapperboardIcon class="w-8 h-8" />
                  </div>
                </div>
                <div class="flex flex-col">
                  <h3
                    class="font-bold text-sm theme-text truncate theme-hover-primary-text transition-colors"
                  >
                    {{ season.name }}
                  </h3>
                  <div v-if="season.episode_count" class="text-xs theme-text-muted mt-0.5">
                    {{ season.episode_count }} {{ $t("details.episodes") }}
                  </div>
                </div>
              </NuxtLink>
            </template>
          </PaginatedResponsiveGrid>
        </section>

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
            :items="castItems"
            :total-items="castTotal"
            :page="castPage"
            :page-size="12"
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
                      :is="actor.actorId ? NuxtLink : 'div'"
                      :to="actor.actorLinkPath"
                      class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
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
                        :to="actor.actorLinkPath"
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
                        decoding="async"
                        loading="lazy"
                        v-if="actor.characterImage"
                        :src="actor.characterImage"
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
                      <NuxtLink
                        v-if="actor.characterDetailPath"
                        :to="actor.characterDetailPath"
                        class="font-bold text-sm theme-text truncate block w-full hover:underline"
                        :title="actor.roleLabels.join(', ') || actor.workCharacterName || ''"
                      >
                        {{
                          actor.roleLabels.join(", ") ||
                          actor.workCharacterName ||
                          $t("details.unknownCharacter")
                        }}
                      </NuxtLink>
                      <div
                        v-else
                        class="font-bold text-sm theme-text truncate block w-full"
                        :title="actor.roleLabels.join(', ') || actor.workCharacterName || ''"
                      >
                        {{
                          actor.roleLabels.join(", ") ||
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
                        :to="actor.voiceActorLinkPath"
                        class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <NuxtImg
                          format="webp"
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
                          <span class="truncate block w-full">{{ $t("details.voiceActor") }}</span>
                        </div>
                        <NuxtLink
                          :to="actor.voiceActorLinkPath"
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
                        :to="actor.actorLinkPath"
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
                          :to="actor.actorLinkPath"
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
      </template>
    </MediaDetailsLayout>

    <div v-else-if="!pending" class="text-center py-20 theme-text-muted min-h-screen">
      {{ $t("series.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
  <NuxtPage v-else />
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

import type {
  MediaDetailCharacterProfilePicture,
  MediaDetailCredits,
  MediaDetailDubbingProject,
} from "@app/shared-logic";
import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import { ArrowLeftIcon, ClapperboardIcon, UserIcon, MicIcon, StarIcon } from "lucide-vue-next";
import ReportModal from "../../components/ReportModal.vue";
import {
  hasOriginalVersion,
  isOriginalVersionQuery,
  matchCastWorks,
  originalVersionCast,
  type DisplayCastActor,
  type MediaProjectView,
} from "../../utils/media-cast";
import { findCharacterImage, indexCharacterPictures } from "../../utils/show-character-pictures";

const isReportModalOpen = ref(false);

const route = useRoute();
const isShowRoute = computed(() => route.params.seasonNumber === undefined);
const router = useRouter();
const supabase = useSupabaseClient();
const showId = computed(
  () => (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) || "",
);
const siteUrl = useSiteConfig().url;
const currentUrl = computed(() => new URL(route.fullPath, siteUrl).href);

const { isAdmin } = useClientUser();

const { locale, t } = useI18n();
const localePath = useLocalePath();
const pageUrl = computed(() => new URL(localePath(`/show/${showId.value}`), siteUrl).href);

const showPageRequest = useShowPageData(showId, locale);
await showPageRequest;
const { currentData: data, pending, error } = showPageRequest;
if (import.meta.server && error.value) throw error.value;

const serie = computed(() => {
  const show = data.value?.serie;
  return show && String(show.id) === showId.value ? show : undefined;
});
type ShowSeasonItem = {
  season_number: number;
  name?: string | null;
  poster_path?: string | null;
  episode_count?: number | null;
};
const seasons = computed<ShowSeasonItem[]>(() => serie.value?.seasons || []);
const { page: seasonsPage, setPage: setSeasonsPage } = useUrlPagination("seasonsPage");
const seasonTotal = computed(() => seasons.value.length);
const seasonItems = computed(() => {
  const start = (seasonsPage.value - 1) * 12;
  return seasons.value.slice(start, start + 12);
});
const projectVoiceActorMetrics = computed(() => {
  const visibleProjects: MediaDetailDubbingProject[] = [];
  const actorCounts = new Map<number, number>();

  for (const project of data.value?.dubbingProjects || []) {
    let hasVoiceActor = false;
    const actorIds = new Set<number>();

    for (const work of project.works || []) {
      const voiceActorId = work.voice_actor_id ?? work.voice_actor?.id;
      if (voiceActorId !== undefined && voiceActorId !== null) {
        hasVoiceActor = true;
        if (voiceActorId) actorIds.add(voiceActorId);
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
const dubbingProjects = computed(() => projectVoiceActorMetrics.value.projects);
const voiceActorsById = computed(
  () => new Map((data.value?.voiceActors || []).map((voiceActor) => [voiceActor.id, voiceActor])),
);

function projectVoiceActorCount(project: MediaDetailDubbingProject): number {
  return projectVoiceActorMetrics.value.actorCounts.get(project.id) || 0;
}
const characterProfilePictures = computed<MediaDetailCharacterProfilePicture[]>(
  () => data.value?.characterProfilePictures || [],
);
const characterPictureIndex = computed(() =>
  indexCharacterPictures(characterProfilePictures.value),
);
const aggregateCredits = computed<MediaDetailCredits>(
  () => data.value?.aggregateCredits || { cast: [] },
);
const canShowOriginalVersion = computed(() =>
  hasOriginalVersion(serie.value?.original_language, aggregateCredits.value.cast),
);
const originalVersionRequested = computed(() => isOriginalVersionQuery(route.query.dub));
const isOriginalVersion = computed(
  () => canShowOriginalVersion.value && originalVersionRequested.value,
);
const tvdbId = computed(() => data.value?.tvdbId);

const backdropUrl = computed(() => {
  if (!serie.value?.backdrop_path) return null;
  if (serie.value.backdrop_path.startsWith("http")) return serie.value.backdrop_path;
  return `https://image.tmdb.org/t/p/original${serie.value.backdrop_path}`;
});

const posterUrl = computed(() => {
  if (!serie.value?.poster_path) return null;
  if (serie.value.poster_path.startsWith("http")) return serie.value.poster_path;
  return `https://image.tmdb.org/t/p/original${serie.value.poster_path}`;
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
    if (!isOriginalVersion.value || !serie.value?.original_language) return undefined;
    return {
      kind: "original",
      key: "original",
      language: serie.value.original_language,
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
type ShowDisplayCastActor = DisplayCastActor & {
  actorLinkPath?: string;
  characterDetailPath?: string;
  roleLabels: string[];
  voiceActorLinkPath: string;
};

const formattedCast = computed<DisplayCastActor[]>(() => {
  const cast = aggregateCredits.value.cast;
  if (!cast) return [];

  if (activeIsOriginal.value) return originalVersionCast(cast);

  // Get works (dubbing links) for the currently active dubbing project
  const works = activeDubProject.value?.works || [];

  const { matches, unmatchedWorks } = matchCastWorks(cast, works);

  const matchedCards = matches.flatMap(({ actor, works: actorWorks }) => {
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
      // Fallback character name from DB when TMDB returns no roles
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
      characterImage: null,
      workCharacterName: work.character_name || null,
    };
  });

  return [...matchedCards, ...unmatchedCards];
});

const searchQuery = ref("");
const searchInput = ref("");
const { page: requestedCastPage, setPage: setCastPage } = useUrlPagination("castPage");
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
// Keep pending or smaller result sets from handing an invalid page to the grid,
// which would otherwise replace the active route while clamping it.
const castPage = computed(() => {
  const totalPages = Math.max(1, Math.ceil(castTotal.value / 12));
  return requestedCastPage.value <= totalPages ? requestedCastPage.value : 1;
});
const castItems = computed<ShowDisplayCastActor[]>(() => {
  const start = (castPage.value - 1) * 12;
  return filteredCast.value.slice(start, start + 12).map((actor) => {
    const roles = actor.roles || [];
    const roleNames = roles.map((role) => role.character);
    const roleLabel = roleNames.join(", ");
    let characterImage: string | null = null;
    let characterDetailPath: string | undefined;
    if (roleLabel || actor.workCharacterName) {
      // Try to match any of the roles, then fallback to workCharacterName
      const namesToTry = [
        ...roleNames.filter(Boolean),
        ...(actor.workCharacterName ? [actor.workCharacterName] : []),
      ];
      characterImage = findCharacterImage(characterPictureIndex.value, namesToTry);
      const matches = characterProfilePictures.value.filter((picture) =>
        namesToTry.some((name) => name && picture.name?.toLowerCase() === name.toLowerCase()),
      );
      const uniqueCharacters = new Map(
        matches
          .filter((picture) => typeof picture.id === "number" || typeof picture.id === "string")
          .map((picture) => [String(picture.id), picture]),
      );
      if (uniqueCharacters.size === 1) {
        const [characterId] = uniqueCharacters.keys();
        if (
          characterId &&
          /^\d+$/.test(characterId) &&
          Number.isSafeInteger(Number(characterId)) &&
          Number(characterId) > 0
        ) {
          characterDetailPath = localePath({
            path: `/character/tvdb/${characterId}`,
            query: { mediaType: "tv", mediaId: route.params.id },
          });
        }
      }
    }

    return {
      ...actor,
      actorLinkPath: actor.actorId ? localePath(`/actor/${actor.actorId}`) : undefined,
      voiceActorLinkPath: actor.voiceActor ? localePath(`/voice-actor/${actor.voiceActor.id}`) : "",
      roleLabels: roles.map((role) =>
        role.episode_count ? `${role.character} (${role.episode_count} eps)` : role.character,
      ),
      characterImage,
      characterDetailPath,
    };
  });
});

useHead({
  title: computed(() => {
    if (!isShowRoute.value) return undefined;
    const year = serie.value?.first_air_date
      ? ` (${new Date(serie.value.first_air_date).getFullYear()})`
      : "";
    let base = serie.value ? `${serie.value.name}${year}` : t("search.tv");
    if (activeDubProject.value) {
      base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
    }
    return base.length > 55 ? base.substring(0, 52) + "..." : base;
  }),
  meta: computed(() =>
    isShowRoute.value
      ? [
          {
            name: "description",
            content: computed(() => {
              const title = serie.value?.name || "";
              let desc =
                serie.value?.overview ||
                (title ? t("seo.showDescription", { title }) : t("seo.showDescriptionFallback"));
              if (activeDubProject.value && title) {
                desc =
                  t("seo.showDescriptionDubbing", {
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
              const title = serie.value?.name || "";
              if (!title) return t("home.meta.keywords");
              return t("seo.showKeywords", { title });
            }),
          },
          {
            property: "og:title",
            content: computed(() => {
              const year = serie.value?.first_air_date
                ? ` (${new Date(serie.value.first_air_date).getFullYear()})`
                : "";
              let base = serie.value ? `${serie.value.name}${year}` : t("search.tv");
              if (activeDubProject.value) {
                base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
              }
              return base.length > 55 ? base.substring(0, 52) + "..." : base;
            }),
          },
          {
            property: "og:description",
            content: computed(() => {
              const title = serie.value?.name || "";
              let desc =
                serie.value?.overview ||
                (title ? t("seo.showDescription", { title }) : t("seo.showDescriptionFallback"));
              if (activeDubProject.value && title) {
                desc =
                  t("seo.showDescriptionDubbing", {
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
            content: computed(() => {
              const year = serie.value?.first_air_date
                ? ` (${new Date(serie.value.first_air_date).getFullYear()})`
                : "";
              let base = serie.value ? `${serie.value.name}${year}` : t("search.tv");
              if (activeDubProject.value) {
                base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
              }
              return base.length > 55 ? base.substring(0, 52) + "..." : base;
            }),
          },
          {
            name: "twitter:description",
            content: computed(() => {
              const title = serie.value?.name || "";
              let desc =
                serie.value?.overview ||
                (title ? t("seo.showDescription", { title }) : t("seo.showDescriptionFallback"));
              if (activeDubProject.value && title) {
                desc =
                  t("seo.showDescriptionDubbing", {
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
        ]
      : [],
  ),
  link: computed<HeadLink[]>(() => {
    if (!isShowRoute.value) return [];
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
  script: computed(() =>
    isShowRoute.value
      ? [
          {
            type: "application/ld+json",
            innerHTML: computed(() => {
              const title = serie.value?.name || "";
              const json = JSON.stringify({
                "@context": "https://schema.org",
                "@type": "TVSeries",
                url: pageUrl.value,
                name: title || t("search.tv"),
                image: posterUrl.value || backdropUrl.value || "",
                description:
                  serie.value?.overview ||
                  (title ? t("seo.showDescription", { title }) : t("seo.showDescriptionFallback")),
                startDate: serie.value?.first_air_date || undefined,
                actor: formattedCast.value.map((actor) => ({
                  "@type": "PerformanceRole",
                  actor: {
                    "@type": "Person",
                    name: actor.name,
                  },
                  characterName: actor.character,
                })),
              });
              return json
                .replace(/</g, "\\u003c")
                .replace(/>/g, "\\u003e")
                .replace(/&/g, "\\u0026");
            }),
          },
        ]
      : [],
  ),
});
</script>
