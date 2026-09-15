<template>
  <div>
    <MediaSkeleton v-if="pending && !game" />
    <MediaDetailsLayout
      v-else-if="game"
      :title="game.name"
      :backdrop-url="
        game.artworks?.[0]?.url || game.screenshots?.[0]?.url || null
      "
      :poster-url="coverUrl"
      :loading="pending"
    >
      <template #metadata>
        <span
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ formatReleaseYear(game.first_release_date) }}
        </span>
        <span
          v-if="game.rating"
          class="flex items-center gap-1.5 theme-text font-bold text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ (game.rating / 10).toFixed(1) }}
        </span>
        <div class="flex gap-2 ml-2">
          <a
            :href="`https://www.igdb.com/games/${game.slug}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg theme-surface-overlay theme-text theme-hover-surface-muted transition-colors backdrop-blur-md uppercase tracking-wider"
            >{{ $t("game.igdb")
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
          {{ $t("game.noDubbingProjects") }}
        </div>
      </template>

      <template #actions-right>
        <template v-if="activeDubProject?.studio_data">
          <NuxtLink
            :to="localePath(`/studio/${activeDubProject.studio_data.id}`)"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border theme-border-subtle theme-border theme-hover-primary-border transition-colors group theme-surface-raised theme-surface"
            title="Studio de doublage"
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

        <ClientOnly>
          <button
            v-if="isAdmin"
            @click="triggerPrepareGame"
            :disabled="isPreparing"
            class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
          >
            <Loader2Icon v-if="isPreparing" class="w-4 h-4 animate-spin" />
            <Gamepad2Icon v-else class="w-4 h-4" />
            <span class="hidden sm:inline">{{
              $t("game.prepareCredits", "Extraire les crédits")
            }}</span>
          </button>

          <NuxtLink
            v-if="isAdmin && game?.id"
            :to="
              localePath(
                activeDubId
                  ? `/game/${game.id}/projects/${activeDubId}/edit`
                  : `/game/${game.id}/projects/new`,
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
            <span class="hidden sm:inline">{{ $t("common.edit") }}</span>
          </NuxtLink>
        </ClientOnly>

        <ForceEnqueueButton
          v-if="game?.id"
          media-type="video_game"
          :media-id="game.id"
        />

        <button
          @click="isReportModalOpen = true"
          class="text-sm theme-text-muted theme-hover-danger-text transition-colors flex items-center gap-1.5"
          title="Signaler cette fiche"
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
              {{ $t("details.synopsis", "Synopsis") }}
            </h2>
            <p class="theme-text-secondary leading-relaxed text-lg mb-8">
              {{
                game.summary ||
                $t("details.noSynopsis", "Aucun synopsis disponible.")
              }}
            </p>

            <div
              class="grid grid-cols-2 md:grid-cols-4 gap-6 theme-surface p-6 rounded-xl border theme-border-subtle theme-border shadow-sm"
            >
              <div>
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("game.developer", "Développeur") }}
                </h3>
                <p class="font-medium text-sm">
                  {{ getDevelopers(game) || "-" }}
                </p>
              </div>
              <div>
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("game.publisher", "Éditeur") }}
                </h3>
                <p class="font-medium text-sm">
                  {{ getPublishers(game) || "-" }}
                </p>
              </div>
              <div class="col-span-2 md:col-span-1">
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("game.genres", "Genres") }}
                </h3>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="genre in game.genres"
                    :key="genre.id"
                    class="px-2 py-0.5 theme-surface-raised theme-surface-muted text-xs font-medium rounded-md theme-text-secondary"
                  >
                    {{ genre.name }}
                  </span>
                </div>
              </div>
              <div class="col-span-2 md:col-span-1">
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("game.platforms", "Plateformes") }}
                </h3>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="platform in game.platforms"
                    :key="platform.id"
                    class="px-2 py-0.5 theme-surface-raised theme-surface-muted text-xs font-medium rounded-md theme-text-secondary"
                  >
                    {{ platform.name }}
                  </span>
                </div>
              </div>
            </div>
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
                  {{ $t("details.castAndCrew", "Casting") }}
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
                  :placeholder="$t('search.placeholder', 'Rechercher...')"
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
            :item-key="(character) => character.id"
            @update:page="setCastPage"
          >
            <template #default="{ item: char }">
              <div
                :key="char.id"
                class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-border"
              >
                <!-- 2 Column Layout for Games (Character -> Voice Actor) -->
                <div class="flex flex-col sm:grid sm:grid-cols-2 gap-4">
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
                        v-if="char.mug_shot?.url"
                        :src="char.mug_shot.url"
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
                          $t("details.character", "Personnage")
                        }}</span>
                      </div>
                      <div
                        class="font-bold text-sm theme-text truncate block w-full"
                        :title="char.name"
                      >
                        {{ char.name }}
                      </div>
                    </div>
                  </div>

                  <!-- Voice Actor -->
                  <div
                    class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0"
                  >
                    <template v-if="char.voiceActor">
                      <NuxtLink
                        :to="localePath(`/voice-actor/${char.voiceActor.id}`)"
                        class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <NuxtImg
                          format="webp"
                          decoding="async"
                          v-if="char.voiceActor.profile_picture"
                          :src="char.voiceActor.profile_picture"
                          class="w-full h-full object-cover transition-transform duration-300"
                          alt="Voice Actor"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center text-2xl font-bold theme-text-muted uppercase theme-surface-muted"
                        >
                          {{ char.voiceActor.firstname?.[0]
                          }}{{ char.voiceActor.lastname?.[0] }}
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
                            $t("details.voiceActor", "Voice Actor")
                          }}</span>
                        </div>
                        <NuxtLink
                          :to="localePath(`/voice-actor/${char.voiceActor.id}`)"
                          class="font-bold text-sm theme-text truncate hover:underline block w-full"
                          :title="
                            char.voiceActor.firstname +
                            ' ' +
                            char.voiceActor.lastname
                          "
                        >
                          {{ char.voiceActor.firstname }}
                          {{ char.voiceActor.lastname }}
                        </NuxtLink>
                        <div
                          v-if="char.voiceActor.performance"
                          class="text-xs theme-primary-text truncate mt-1"
                        >
                          {{ char.voiceActor.performance }}
                        </div>
                        <div
                          v-if="char.voiceActor.note"
                          class="text-xs theme-text-muted mt-1"
                        >
                          {{ char.voiceActor.note }}
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
                            $t("details.voiceActor", "Voice Actor")
                          }}</span>
                        </div>
                        <div
                          class="text-sm theme-text-muted italic truncate block w-full"
                        >
                          {{ $t("details.notSpecified", "Non spécifié") }}
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

    <div
      v-else-if="!pending"
      class="text-center py-20 theme-text-muted min-h-screen"
    >
      {{ $t("details.notFound", "Jeu vidéo introuvable.") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import { useRoute, useRouter } from "vue-router";
import { fetchGameData, fetchDetailCollection } from "@app/shared-logic";
import type { PaginatedResponse } from "@app/shared-logic";
import type { IgdbGame } from "@app/shared-logic";
import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import {
  ArrowLeftIcon,
  UserIcon,
  MicIcon,
  SearchIcon,
  Gamepad2Icon,
  Loader2Icon,
  StarIcon,
  ExternalLinkIcon,
} from "lucide-vue-next";
import ReportModal from "../../components/ReportModal.vue";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const gameId =
  (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) || "";
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);

const user = useSupabaseUser();
const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const isPreparing = ref(false);

const { locale, t } = useI18n();
const localePath = useLocalePath();

const cacheKey = `game-${gameId}-${locale.value}`;
const { data, pending, refresh } = useAsyncData(
  cacheKey,
  async () => {
    const nuxtApp = useNuxtApp();
    // We only have cached data on the client side after hydration
    const cachedData = nuxtApp.payload.data[cacheKey];

    const newData = await fetchGameData(gameId, locale.value);

    // If IGDB fetch fails on the edge function (e.g., timeout)
    // but we already have valid data from SSR, we preserve the IGDB data
    // while still accepting the fresh database data (votes, dubbing projects).
    if (
      newData &&
      newData.game?.name === "Information indisponible (Timeout)" &&
      cachedData?.game &&
      cachedData.game.name !== "Information indisponible (Timeout)"
    ) {
      return {
        ...newData,
        game: cachedData.game,
        characters: cachedData.characters,
      };
    }

    return newData;
  },
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const game = computed(() => data.value?.game);
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

const coverUrl = computed(() => {
  if (!game.value?.cover?.url) return null;
  return game.value.cover.url;
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
  if (!langCode) return "Unknown";
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

const getDevelopers = (g: IgdbGame) =>
  g.involved_companies
    ?.filter((c) => c.developer)
    .map((c) => c.company.name)
    .join(", ");
const getPublishers = (g: IgdbGame) =>
  g.involved_companies
    ?.filter((c) => c.publisher)
    .map((c) => c.company.name)
    .join(", ");
const formatReleaseYear = (ts?: number) =>
  ts ? new Date(ts * 1000).getFullYear().toString() : "";

const searchQuery = ref("");
const searchInput = ref("");
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");
const debouncedSearch = refDebounced(searchInput, 150);
watch(debouncedSearch, (val) => {
  searchQuery.value = val;
});
watch([searchQuery, activeDubId], () => void setCastPage(1));

type GameCastItem = Record<string, any>;
const castRequest = computed(() => ({
  collection: "media-cast" as const,
  type: "game",
  id: gameId,
  projectId: activeDubId.value || undefined,
  query: searchQuery.value,
  page: castPage.value,
  pageSize: 12,
}));
const { data: castPageData } = useAsyncData<PaginatedResponse<GameCastItem>>(
  computed(
    () =>
      `game-cast-${gameId}-${locale.value}-${castPage.value}-${activeDubId.value}-${searchQuery.value}`,
  ),
  () => fetchDetailCollection<GameCastItem>(castRequest.value),
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

async function triggerPrepareGame() {
  if (!isAdmin.value) return;
  isPreparing.value = true;
  try {
    const result = await $fetch("/api/prepare_game", {
      method: "POST",
      body: { igdbId: Number(gameId) },
    });
    if (result.ok) {
      console.info(
        `[prepare_game] LLM: ${result.llmModel ?? "unknown"} | ${result.note ?? `${result.creditsAdded} credits added`}`,
      );
    } else {
      console.error("prepare_game failed:", result.error);
    }
    await refresh();
  } catch (err) {
    console.error("prepare_game failed:", err);
  } finally {
    isPreparing.value = false;
  }
}

useHead({
  titleTemplate: null,
  title: computed(() => {
    const year = game.value?.first_release_date
      ? ` (${formatReleaseYear(game.value.first_release_date)})`
      : "";
    let base = game.value ? `${game.value.name}${year}` : "Jeu Vidéo";
    if (activeDubProject.value) {
      base += ` - Doublage ${getDisplayLanguage(activeDubProject.value.language)}`;
    }
    return base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        let desc =
          game.value?.summary ||
          `Découvrez les voix françaises et le casting du jeu vidéo ${game.value?.name}.`;
        if (activeDubProject.value) {
          desc =
            `Découvrez le casting complet des voix pour le doublage ${getDisplayLanguage(activeDubProject.value.language)} du jeu ${game.value?.name}. ` +
            desc;
        }
        return desc;
      }),
    },
    {
      property: "og:image",
      content: computed(() => coverUrl.value || ""),
    },
  ],
  link: [
    { rel: "preconnect", href: "https://images.igdb.com", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://images.igdb.com" },
  ],
});
</script>
