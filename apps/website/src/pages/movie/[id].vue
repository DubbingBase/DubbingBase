<template>
  <div>
    <MediaSkeleton v-if="pending && !movie" />
    <MediaDetailsLayout
      v-else-if="movie"
      :title="movie.title"
      :backdrop-url="backdropUrl"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <span
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ movie.release_date ? movie.release_date.split("-")[0] : "" }}
        </span>
        <span
          v-if="movie.original_title !== movie.title"
          class="theme-text-secondary font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1.5 rounded-lg"
        >
          {{ movie.original_title }}
        </span>
        <span
          class="flex items-center gap-1.5 theme-text font-bold text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ movie.vote_average?.toFixed(1) }}
        </span>
        <div class="flex gap-2 ml-2">
          <a
            :href="`https://www.themoviedb.org/movie/${movie.id}`"
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
          v-if="isAdmin && movie?.id"
          :to="
            localePath(
              activeDubId
                ? `/movie/${movie.id}/projects/${activeDubId}/edit`
                : `/movie/${movie.id}/projects/new`,
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
          v-if="movie?.id"
          media-type="movie"
          :media-id="movie.id"
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
              {{ movie.overview || $t("details.noSynopsis") }}
            </p>
          </section>
        </div>

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
                      shown: filteredCast.length,
                      total: formattedCast.length,
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
            :items="filteredCast"
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
                      :aria-label="actor.name"
                    >
                      <NuxtImg
                        format="webp"
                        loading="lazy"
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
                        loading="lazy"
                        decoding="async"
                        v-if="actor.characterImage"
                        :src="actor.characterImage"
                        class="w-full h-full object-cover"
                        alt="Character"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center theme-text-muted"
                      >
                        <UserIcon class="w-8 h-8 opacity-50" />
                      </div>
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
                          actor.character || actor.workCharacterName || ''
                        "
                      >
                        {{
                          actor.character ||
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
                        :aria-label="`${actor.voiceActor.firstname} ${actor.voiceActor.lastname}`"
                      >
                        <NuxtImg
                          format="webp"
                          loading="lazy"
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
                        class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <div
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <UserIcon class="w-8 h-8 opacity-50" />
                        </div>
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
          <span class="block text-xs theme-text-muted mt-4">{{
            $t("media.rolesCount", {
              shown: filteredCast.length,
              total: filteredCast.length,
            })
          }}</span>
        </section>
      </template>
    </MediaDetailsLayout>

    <div
      v-else-if="!pending"
      class="text-center py-20 theme-text-muted min-h-screen"
    >
      {{ $t("movie.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from "vue-router";

import { fetchMovieData, findCharacter } from "@app/shared-logic";
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
const movieId =
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

const cacheKey = `movie-${movieId}-${locale.value}`;

const { data, pending, refresh } = useAsyncData(
  cacheKey,
  async () => {
    const nuxtApp = useNuxtApp();
    // We only have cached data on the client side after hydration
    const cachedData = nuxtApp.payload.data[cacheKey];

    const newData = await fetchMovieData(movieId, locale.value);

    // If TMDB fetch fails on the edge function (e.g., timeout during auth resolution)
    // but we already have valid TMDB data from SSR, we preserve the TMDB data
    // while still accepting the fresh database data (votes, dubbing projects).
    if (
      newData &&
      newData.movie?.title === "Information indisponible (Timeout)" &&
      cachedData?.movie &&
      cachedData.movie.title !== "Information indisponible (Timeout)"
    ) {
      newData.movie = cachedData.movie;
      newData.collection = cachedData.collection;
      newData.characterProfilePictures = cachedData.characterProfilePictures;
      newData.tvdbId = cachedData.tvdbId;
    }

    return newData;
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const movie = computed(() => data.value?.movie);
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
const tvdbId = computed(() => data.value?.tvdbId);

const backdropUrl = computed(() => {
  if (!movie.value?.backdrop_path) return null;
  if (movie.value.backdrop_path.startsWith("http"))
    return movie.value.backdrop_path;
  return `https://image.tmdb.org/t/p/original${movie.value.backdrop_path}`;
});

const posterUrl = computed(() => {
  if (!movie.value?.poster_path) return null;
  if (movie.value.poster_path.startsWith("http"))
    return movie.value.poster_path;
  return `https://image.tmdb.org/t/p/original${movie.value.poster_path}`;
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
  const orig = movie.value?.original_language?.toLowerCase();
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
  if (!movie.value?.credits?.cast) return [];

  // Get works (dubbing links) for the currently active dubbing project
  const works = activeDubProject.value?.works || [];

  const { matches, unmatchedWorks } = matchCastWorks(
    movie.value.credits.cast,
    works,
  );

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

    return cards.map((work: any) => {
      const voiceActor = work?.voice_actor;
      // Fallback character name from DB when TMDB returns no character
      const workCharacterName = work?.character_name || null;

      // Find character picture matching the character name
      let characterImage = null;
      const characterName = actor.character || workCharacterName;
      if (characterName) {
        const match = characterProfilePictures.value.find(
          (c: any) => c.name && findCharacter(c.name, characterName),
        );
        if (match && match.image) {
          characterImage = match.image;
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
const { page: castPage, setPage: setCastPage } =
  useUrlPagination("castPage");
const debouncedSearch = refDebounced(searchInput, 150);
watch(debouncedSearch, (val) => {
  searchQuery.value = val;
});
watch(searchQuery, () => {
  void setCastPage(1);
});

const filteredCast = computed(() => {
  if (!searchQuery.value) return formattedCast.value;
  const query = searchQuery.value.toLowerCase().trim();
  return formattedCast.value.filter((actor: any) => {
    const actorName = actor.name?.toLowerCase() || "";
    const characterName = actor.character?.toLowerCase() || "";
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

watch([searchQuery, activeDubId], () => {
  void refresh();
});

useHead({
  title: computed(() => {
    const year = movie.value?.release_date
      ? ` (${new Date(movie.value.release_date).getFullYear()})`
      : "";
    let base = movie.value
      ? `${movie.value.title}${year}`
      : t("search.movie", "Movie");
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
          (title
            ? t("seo.movieDescription", { title })
            : t(
                "seo.movieDescriptionFallback",
                "Découvrez le casting et les voix du film.",
              ));
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
        let base = movie.value
          ? `${movie.value.title}${year}`
          : t("search.movie", "Movie");
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
          (title
            ? t("seo.movieDescription", { title })
            : t(
                "seo.movieDescriptionFallback",
                "Découvrez le casting et les voix du film.",
              ));
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
      property: "og:url",
      content: computed(
        () =>
          `https://dubbingbase.com/movie/${movieId}${activeDubId.value ? `?dub=${activeDubId.value}` : ""}`,
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
        const year = movie.value?.release_date
          ? ` (${new Date(movie.value.release_date).getFullYear()})`
          : "";
        let base = movie.value
          ? `${movie.value.title}${year}`
          : t("search.movie", "Movie");
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
          (title
            ? t("seo.movieDescription", { title })
            : t(
                "seo.movieDescriptionFallback",
                "Découvrez le casting et les voix du film.",
              ));
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
  link: computed<any[]>(() => {
    const links: {
      rel: "canonical" | "preload" | "preconnect" | "dns-prefetch";
      href: string;
      as?: "image";
      crossorigin?: string;
    }[] = [
      {
        rel: "canonical",
        href: (() => {
          const baseUrl = "https://dubbingbase.com/movie/" + movieId;
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
          url: `https://dubbingbase.com/movie/${movieId}`,
          name: title || t("search.movie", "Film"),
          image: posterUrl.value || backdropUrl.value || "",
          description:
            movie.value?.overview ||
            (title
              ? t("seo.movieDescription", { title })
              : t(
                  "seo.movieDescriptionFallback",
                  "Découvrez le casting et les voix du film.",
                )),
          datePublished: movie.value?.release_date || undefined,
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
