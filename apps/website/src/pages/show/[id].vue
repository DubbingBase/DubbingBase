<template>
  <div>
    <MediaSkeleton v-if="pending && !serie" />
    <MediaDetailsLayout
      v-else-if="serie"
      :title="serie.name"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <span
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ serie.first_air_date ? serie.first_air_date.split("-")[0] : "" }}
          <template v-if="serie.number_of_seasons"
            >{{ $t("common.separator") }}{{ serie.number_of_seasons }}
            {{ $t("details.seasons") }}</template
          >
        </span>
        <span
          v-if="serie.original_name !== serie.name"
          class="theme-text-secondary font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1.5 rounded-lg"
        >
          {{ serie.original_name }}
        </span>
        <span
          class="flex items-center gap-1.5 theme-text font-bold text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ serie.vote_average?.toFixed(1) }}
        </span>
        <div class="flex gap-2 ml-2">
          <a
            :href="`https://www.themoviedb.org/tv/${serie.id}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg theme-surface-overlay theme-text theme-hover-surface-muted transition-colors backdrop-blur-md uppercase tracking-wider"
            >{{ $t("common.tmdb")
            }}<ExternalLinkIcon class="w-3 h-3 opacity-70" />
          </a>
          <a
            v-if="tvdbId"
            :href="`https://thetvdb.com/search?query=${tvdbId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg theme-surface-overlay theme-text theme-hover-surface-muted transition-colors backdrop-blur-md uppercase tracking-wider"
            >{{ $t("common.tvdb")
            }}<ExternalLinkIcon class="w-3 h-3 opacity-70" />
          </a>
        </div>
      </template>

      <template #actions-left>
        <div v-if="dubbingProjects.length > 0" class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="project in dubbingProjects"
            :key="project.id"
            :to="{ query: { dub: project.id } }"
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
          v-if="isAdmin && serie?.id"
          :to="
            localePath(
              activeDubId
                ? `/show/${serie.id}/projects/${activeDubId}/edit`
                : `/show/${serie.id}/projects/new`,
            )
          "
          class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
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
          v-if="serie?.id"
          media-type="tv"
          :media-id="serie.id"
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
            <p class="theme-text-secondary leading-relaxed text-lg">
              {{ serie.overview || $t("details.noSynopsis") }}
            </p>
          </section>
        </div>

        <!-- Seasons -->
        <section v-if="seasonTotal > 0" class="mb-12">
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
                :to="
                  localePath(
                    `/show/${serie.id}/season/${season.season_number}${activeDubId ? `?dub=${activeDubId}` : ''}`,
                  )
                "
                class="group cursor-pointer block theme-input border theme-border-subtle theme-border rounded-2xl p-3 shadow-sm transition-colors theme-hover-border hover:shadow-md"
              >
                <div
                  class="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 theme-surface-muted"
                >
                  <NuxtImg
                    format="webp"
                    decoding="async"
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
                  <div
                    v-if="season.episode_count"
                    class="text-xs theme-text-muted mt-0.5"
                  >
                    {{ season.episode_count }} {{ $t("details.episodes") }}
                  </div>
                </div>
              </NuxtLink>
            </template>
          </PaginatedResponsiveGrid>
        </section>

        <!-- Voice Cast -->
        <section>
          <div class="flex flex-col mb-6 gap-2">
            <div
              class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4"
            >
              <div>
                <h2 class="text-2xl font-bold">
                  {{ $t("details.castAndCrew") }}
                </h2>
                <div class="theme-text-muted text-sm mt-1">
                  {{
                    $t("media.rolesCount", {
                      shown: castItems.length,
                      total: castTotal,
                    })
                  }}
                </div>
              </div>

              <div class="relative w-full sm:w-64">
                <SearchIcon
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted"
                />
                <input
                  v-model="searchInput"
                  type="search"
                  :placeholder="$t('search.placeholder')"
                  class="w-full theme-input border theme-border-subtle theme-border rounded-xl pl-10 pr-4 py-2 text-sm theme-focus transition-all theme-text"
                />
              </div>
            </div>
          </div>

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
                <div
                  class="flex flex-col sm:grid gap-4"
                  :class="
                    isOriginalLanguage ? 'sm:grid-cols-2' : 'sm:grid-cols-3'
                  "
                >
                  <!-- Original Actor -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start"
                  >
                    <NuxtLink
                      :to="localePath(`/actor/${actor.id}`)"
                      class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        decoding="async"
                        v-if="actor.profile_path"
                        :src="actor.profile_path"
                        class="w-full h-full object-cover transition-transform duration-300"
                        alt="Actor"
                      />
                    </NuxtLink>
                    <div
                      class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                    >
                      <div
                        class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                      >
                        <ClapperboardIcon class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate block w-full">{{
                          $t("details.actor")
                        }}</span>
                      </div>
                      <NuxtLink
                        :to="localePath(`/actor/${actor.id}`)"
                        class="font-bold text-sm theme-text truncate hover:underline block w-full"
                        :title="actor.name"
                      >
                        {{ actor.name }}
                      </NuxtLink>
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
                        v-if="actor.characterImage"
                        :src="actor.characterImage"
                        class="w-full h-full object-cover"
                        alt="Character"
                      />
                    </div>
                    <div
                      class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                    >
                      <div
                        class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                      >
                        <UserIcon class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate block w-full">{{
                          $t("details.character")
                        }}</span>
                      </div>
                      <div
                        class="font-bold text-sm theme-text truncate block w-full"
                        :title="
                          actor.roles
                            ?.map((r: any) =>
                              r.episode_count
                                ? `${r.character} (${r.episode_count} eps)`
                                : r.character,
                            )
                            .join(', ') ||
                          actor.workCharacterName ||
                          ''
                        "
                      >
                        {{
                          actor.roles
                            ?.map((r: any) =>
                              r.episode_count
                                ? `${r.character} (${r.episode_count} eps)`
                                : r.character,
                            )
                            .join(", ") ||
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
                        :to="localePath(`/voice-actor/${actor.voiceActor.id}`)"
                        class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <NuxtImg
                          format="webp"
                          decoding="async"
                          v-if="actor.voiceActor.profile_picture"
                          :src="actor.voiceActor.profile_picture"
                          class="w-full h-full object-cover transition-transform duration-300"
                          alt="Voice Actor"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center text-2xl font-bold theme-text-muted"
                        >
                          {{ actor.voiceActor.firstname?.[0]
                          }}{{ actor.voiceActor.lastname?.[0] }}
                        </div>
                      </NuxtLink>
                      <div
                        class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                      >
                        <div
                          class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                        >
                          <MicIcon class="w-3 h-3 flex-shrink-0" />
                          <span class="truncate block w-full">{{
                            $t("details.voiceActor")
                          }}</span>
                        </div>
                        <NuxtLink
                          :to="
                            localePath(`/voice-actor/${actor.voiceActor.id}`)
                          "
                          class="font-bold text-sm theme-text truncate hover:underline block w-full"
                          :title="
                            actor.voiceActor.firstname +
                            ' ' +
                            actor.voiceActor.lastname
                          "
                        >
                          {{ actor.voiceActor.firstname }}
                          {{ actor.voiceActor.lastname }}
                        </NuxtLink>
                        <div
                          v-if="actor.voiceActor.note"
                          class="text-xs theme-text-muted mt-1"
                        >
                          {{ actor.voiceActor.note }}
                        </div>
                      </div>
                    </template>
                    <template v-else>
                      <div
                        class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-raised theme-input sm:mb-3 flex items-center justify-center border border-dashed theme-border-subtle theme-border flex-shrink-0"
                      >
                        <span
                          class="theme-text-muted theme-text-secondary text-xs text-center px-2"
                          >?</span
                        >
                      </div>
                      <div
                        class="flex flex-col min-w-0 flex-1 w-full overflow-hidden"
                      >
                        <div
                          class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                        >
                          <MicIcon class="w-3 h-3 opacity-50 flex-shrink-0" />
                          <span class="truncate block w-full">{{
                            $t("details.voiceActor")
                          }}</span>
                        </div>
                        <div
                          class="text-sm theme-text-muted italic truncate block w-full"
                        >
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

    <div
      v-else-if="!pending"
      class="text-center py-20 theme-text-muted min-h-screen"
    >
      {{ $t("series.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from "vue-router";

import { fetchShowData, fetchDetailCollection } from "@app/shared-logic";
import type { PaginatedResponse } from "@app/shared-logic";
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
import ReportModal from "../../components/ReportModal.vue";
import { matchCastWorks } from "../../utils/media-cast";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const showId =
  (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) || "";
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const { locale, t } = useI18n();
const localePath = useLocalePath();

const cacheKey = `show-${showId}-${locale.value}`;

const { data, pending } = useAsyncData(
  cacheKey,
  async () => {
    const nuxtApp = useNuxtApp();
    // We only have cached data on the client side after hydration
    const cachedData = nuxtApp.payload.data[cacheKey];

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

const serie = computed(() => data.value?.serie);
const seasons = computed(() => serie.value?.seasons || []);
const { page: seasonsPage, setPage: setSeasonsPage } =
  useUrlPagination("seasonsPage");
type ShowSeasonItem = Record<string, any>;
const seasonsRequest = computed(() => ({
  collection: "show-seasons" as const,
  id: showId,
  page: seasonsPage.value,
  pageSize: 12,
}));
const { data: seasonsPageData } = useAsyncData<
  PaginatedResponse<ShowSeasonItem>
>(
  `show-seasons-${showId}-${locale.value}`,
  () => fetchDetailCollection<ShowSeasonItem>(seasonsRequest.value),
  {
    watch: [seasonsRequest],
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);
const seasonItems = computed(() => seasonsPageData.value?.data || []);
const seasonTotal = computed(
  () => seasonsPageData.value?.pagination.totalItems || 0,
);
const dubbingProjects = computed(() => {
  const projects = [...(data.value?.dubbingProjects || [])].filter((p) =>
    projectHasVoiceActor(p),
  );
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
const aggregateCredits = computed(
  () => data.value?.aggregateCredits || { cast: [] },
);
const tvdbId = computed(() => data.value?.tvdbId);

const backdropUrl = computed(() => {
  if (!serie.value?.backdrop_path) return null;
  if (serie.value.backdrop_path.startsWith("http"))
    return serie.value.backdrop_path;
  return `https://image.tmdb.org/t/p/original${serie.value.backdrop_path}`;
});

const posterUrl = computed(() => {
  if (!serie.value?.poster_path) return null;
  if (serie.value.poster_path.startsWith("http"))
    return serie.value.poster_path;
  return `https://image.tmdb.org/t/p/original${serie.value.poster_path}`;
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
  const orig = serie.value?.original_language?.toLowerCase();
  const dub = activeDubProject.value?.language?.toLowerCase();
  if (!orig || !dub) return false;
  return (
    orig === dub || dub.startsWith(`${orig}-`) || orig.startsWith(`${dub}-`)
  );
});

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return t("details.notSpecified", "Not specified");
  try {
    const displayNames = new Intl.DisplayNames([locale.value || "en"], {
      type: "language",
    });
    const name = displayNames.of(langCode);
    return typeof name === "string" && name.length > 0
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch (e) {
    return langCode;
  }
};

// Format cast and attach voice actors
const formattedCast = computed(() => {
  if (!aggregateCredits.value?.cast) return [];

  // Get works (dubbing links) for the currently active dubbing project
  const works = activeDubProject.value?.works || [];

  const { matches, unmatchedWorks } = matchCastWorks(
    aggregateCredits.value.cast,
    works,
  );

  const matchedCards = matches.flatMap(({ actor, works: actorWorks }) => {
    let profilePath = actor.profile_path;
    if (profilePath && profilePath.startsWith("/")) {
      profilePath = `https://image.tmdb.org/t/p/w185${profilePath}`;
    }

    // Find the voice actor work for this physical actor
    const cards = actorWorks.length > 0 ? actorWorks : [null];

    return cards.map((work: any) => {
      const voiceActor = work?.voice_actor;
      // Fallback character name from DB when TMDB returns no roles
      const workCharacterName = work?.character_name || null;

      // Find character picture matching the character name
      let characterImage = null;
      const characterName =
        actor.roles?.map((r: any) => r.character).join(", ") ||
        workCharacterName;
      if (characterName) {
        // Try to match any of the roles, then fallback to workCharacterName
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
        id: work ? `${actor.id}-${work.id}` : actor.id,
        profile_path: profilePath,
        voiceActor: voiceActor ? { ...voiceActor, note: work.note } : null,
        characterImage,
        workCharacterName,
      };
    });
  });

  // Keep manually entered works visible even when TMDB no longer returns the
  // linked actor (or the work has no TMDB actor id).
  const unmatchedCards = unmatchedWorks.map((work: any) => ({
    id: `work-${work.id}`,
    name: work.character_name || t("details.unknownCharacter"),
    profile_path: null,
    character: work.character_name || null,
    voiceActor: work.voice_actor
      ? { ...work.voice_actor, note: work.note }
      : null,
    characterImage: null,
    workCharacterName: work.character_name || null,
  }));

  return [...matchedCards, ...unmatchedCards];
});

const searchQuery = ref("");
const searchInput = ref("");
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");
const debouncedSearch = refDebounced(searchInput, 150);
watch(debouncedSearch, (val) => {
  searchQuery.value = val;
});
watch([searchQuery, activeDubId], () => void setCastPage(1));

type ShowCastItem = Record<string, any>;
const castRequest = computed(() => ({
  collection: "media-cast" as const,
  type: "show",
  id: showId,
  projectId: activeDubId.value || undefined,
  query: searchQuery.value,
  page: castPage.value,
  pageSize: 12,
}));
const { data: castPageData } = useAsyncData<PaginatedResponse<ShowCastItem>>(
  `show-cast-${showId}-${locale.value}`,
  () => fetchDetailCollection<ShowCastItem>(castRequest.value),
  {
    watch: [castRequest],
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);
const castItems = computed(() => castPageData.value?.data || []);
const castTotal = computed(
  () => castPageData.value?.pagination.totalItems || 0,
);

useHead({
  title: computed(() => {
    const year = serie.value?.first_air_date
      ? ` (${new Date(serie.value.first_air_date).getFullYear()})`
      : "";
    let base = serie.value
      ? `${serie.value.name}${year}`
      : t("search.tv", "Series");
    if (activeDubProject.value) {
      base += ` - ${t("details.dubbing", { lang: getDisplayLanguage(activeDubProject.value.language) })}`;
    }
    return base.length > 55 ? base.substring(0, 52) + "..." : base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const title = serie.value?.name || "";
        let desc =
          serie.value?.overview ||
          (title
            ? t("seo.showDescription", { title })
            : t(
                "seo.showDescriptionFallback",
                "Découvrez le casting et les voix de la série.",
              ));
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
        let base = serie.value
          ? `${serie.value.name}${year}`
          : t("search.tv", "Series");
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
          (title
            ? t("seo.showDescription", { title })
            : t(
                "seo.showDescriptionFallback",
                "Découvrez le casting et les voix de la série.",
              ));
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
      property: "og:url",
      content: computed(
        () =>
          `https://dubbingbase.com/show/${showId}${activeDubId.value ? `?dub=${activeDubId.value}` : ""}`,
      ),
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
        let base = serie.value
          ? `${serie.value.name}${year}`
          : t("search.tv", "Series");
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
          (title
            ? t("seo.showDescription", { title })
            : t(
                "seo.showDescriptionFallback",
                "Découvrez le casting et les voix de la série.",
              ));
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
  ],
  link: computed<any[]>(() => {
    const links = [
      {
        rel: "canonical",
        href: (() => {
          const baseUrl = "https://dubbingbase.com/show/" + showId;
          return activeDubId.value
            ? `${baseUrl}?dub=${activeDubId.value}`
            : baseUrl;
        })(),
      },
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
      } as any);
    }
    return links;
  }),
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() => {
        const title = serie.value?.name || "";
        const json = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TVSeries",
          url: `https://dubbingbase.com/show/${showId}`,
          name: title || t("search.tv", "Série"),
          image: posterUrl.value || backdropUrl.value || "",
          description:
            serie.value?.overview ||
            (title
              ? t("seo.showDescription", { title })
              : t(
                  "seo.showDescriptionFallback",
                  "Découvrez le casting et les voix de la série.",
                )),
          startDate: serie.value?.first_air_date || undefined,
          actor: formattedCast.value.map((actor: any) => ({
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
  ],
});
</script>
