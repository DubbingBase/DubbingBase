<template>
  <div>
    <MediaSkeleton v-if="pending && !game" />
    <MediaDetailsLayout
      v-else-if="game"
      :title="game.name"
      :backdrop-url="game.artworks?.[0]?.url || game.screenshots?.[0]?.url || null"
      :poster-url="coverUrl"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip>{{ formatReleaseYear(game.first_release_date) }}</DetailsMetaChip>
        <DetailsMetaChip v-if="game.rating" variant="rating">
          <StarIcon class="w-4 h-4 theme-rating fill-current" />
          {{ (game.rating / 10).toFixed(1) }}
        </DetailsMetaChip>
        <DetailsMetaChip v-if="getDevelopers(game)" variant="tag" :label="$t('game.developer')">
          {{ getDevelopers(game) }}
        </DetailsMetaChip>
        <DetailsMetaChip v-if="getPublishers(game)" variant="tag" :label="$t('game.publisher')">
          {{ getPublishers(game) }}
        </DetailsMetaChip>
        <DetailsMetaChip
          v-for="genre in (game.genres ?? []).slice(0, 4)"
          :key="`g-${genre.id}`"
          variant="tag"
        >
          {{ genre.name }}
        </DetailsMetaChip>
        <DetailsMetaChip v-if="(game.genres?.length ?? 0) > 4" variant="tag">
          +{{ (game.genres?.length ?? 0) - 4 }}
        </DetailsMetaChip>
        <DetailsMetaChip
          v-for="platform in (game.platforms ?? []).slice(0, 4)"
          :key="`p-${platform.id}`"
          variant="tag"
        >
          {{ platform.name }}
        </DetailsMetaChip>
        <DetailsMetaChip v-if="(game.platforms?.length ?? 0) > 4" variant="tag">
          +{{ (game.platforms?.length ?? 0) - 4 }}
        </DetailsMetaChip>
        <div class="flex gap-2 ml-2">
          <DetailsExternalLink
            :href="`https://www.igdb.com/games/${game.slug}`"
            :label="$t('game.igdb')"
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

        <ClientOnly>
          <button
            v-if="isAdmin"
            @click="showPrepareDialog = true"
            :disabled="isPreparing"
            class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
          >
            <Loader2Icon v-if="isPreparing" class="w-4 h-4 animate-spin" />
            <Gamepad2Icon v-else class="w-4 h-4" />
            <span class="hidden sm:inline">{{ $t("game.prepareCredits") }}</span>
          </button>

          <DetailsEditLink
            v-if="isAdmin && game?.id"
            :to="
              localePath(
                activeDubId
                  ? `/game/${game.id}/projects/${activeDubId}/edit`
                  : `/game/${game.id}/projects/new`,
              )
            "
            :label="$t('common.edit')"
          />
        </ClientOnly>

        <ForceEnqueueButton v-if="game?.id" media-type="video_game" :media-id="game.id" />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis :text="game.summary" />

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
          />

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
                        loading="lazy"
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
                    <div class="flex flex-col min-w-0 flex-1 w-full overflow-hidden">
                      <div
                        class="flex items-center gap-1.5 text-[10px] theme-text-muted uppercase tracking-widest font-semibold mb-1"
                      >
                        <UserIcon class="w-3 h-3 flex-shrink-0" />
                        <span class="truncate block w-full">{{ $t("details.character") }}</span>
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
                          loading="lazy"
                          v-if="char.voiceActor.profile_picture"
                          :src="char.voiceActor.profile_picture"
                          class="w-full h-full object-cover transition-transform duration-300"
                          alt="Voice Actor"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center text-2xl font-bold theme-text-muted uppercase theme-surface-muted"
                        >
                          {{ char.voiceActor.firstname?.[0] }}{{ char.voiceActor.lastname?.[0] }}
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
                          :to="localePath(`/voice-actor/${char.voiceActor.id}`)"
                          class="font-bold text-sm theme-text truncate hover:underline block w-full"
                          :title="char.voiceActor.firstname + ' ' + char.voiceActor.lastname"
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
                        <div v-if="char.voiceActor.note" class="text-xs theme-text-muted mt-1">
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
      {{ $t("game.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />

    <div
      v-if="showPrepareDialog && isAdmin"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      @click.self="showPrepareDialog = false"
    >
      <form
        class="w-full max-w-lg space-y-5 rounded-2xl border theme-border theme-surface-overlay p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prepare-game-dialog-title"
        @submit.prevent="triggerPrepareGame"
      >
        <div class="space-y-2">
          <h2 id="prepare-game-dialog-title" class="text-lg font-bold theme-text">
            {{ $t("game.prepareDialogTitle") }}
          </h2>
          <p class="text-sm theme-text-muted">
            {{ $t("game.prepareDialogDescription") }}
          </p>
        </div>
        <label for="prepare-game-wikipedia-language" class="block space-y-2">
          <span class="text-sm font-semibold theme-text">
            {{ $t("game.wikipediaSourceLanguage") }}
          </span>
          <input
            id="prepare-game-wikipedia-language"
            v-model="prepareWikipediaLanguage"
            type="text"
            required
            pattern="[a-z][a-z0-9-]*"
            autocomplete="off"
            class="w-full rounded-xl border theme-border theme-input px-4 py-2.5 text-sm theme-text"
          />
          <span class="block text-xs theme-text-muted">
            {{ $t("game.wikipediaSourceHint") }}
          </span>
        </label>
        <label for="prepare-game-dubbing-language" class="block space-y-2">
          <span class="text-sm font-semibold theme-text">
            {{ $t("admin.regionalDubbingLanguage") }}
          </span>
          <AdminLanguageSelect
            id="prepare-game-dubbing-language"
            v-model="prepareDubbingLanguage"
            required
          />
        </label>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            class="rounded-xl border theme-border px-4 py-2 text-sm theme-text"
            @click="showPrepareDialog = false"
          >
            {{ $t("common.cancel") }}
          </button>
          <button
            type="submit"
            :disabled="isPreparing || !canPrepareGame"
            class="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {{ $t("game.prepareCredits") }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import MediaSkeleton from "../../components/MediaSkeleton.vue";
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
import {
  fetchGameData,
  filterDetailCollectionItems,
  formatGameDetailCastCards,
  paginateDetailCollection,
  resolveDetailCollectionProject,
} from "@app/shared-logic";
import type { GameDetailCastCard } from "@app/shared-logic";
import type { IgdbGame } from "@app/shared-logic";
import { buildPrepareGameRequest } from "./prepare-game-request";

interface GameDubbingWork {
  voice_actor?: { id?: number | null } | null;
}

interface GameDubbingProject {
  id: number;
  language?: string | null;
  works?: GameDubbingWork[] | null;
  studio_data?: {
    id: number;
    logo_url?: string | null;
    name?: string | null;
  } | null;
}

import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import {
  ArrowLeftIcon,
  UserIcon,
  MicIcon,
  Gamepad2Icon,
  Loader2Icon,
  StarIcon,
} from "lucide-vue-next";
import ReportModal from "../../components/ReportModal.vue";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const gameId = (Array.isArray(route.params.id) ? route.params.id[0] : route.params.id) || "";
const siteUrl = useSiteConfig().url;
const currentUrl = computed(() => new URL(route.fullPath, siteUrl).href);

const { isAdmin } = useClientUser();

const isPreparing = ref(false);
const showPrepareDialog = ref(false);
const prepareWikipediaLanguage = ref("");
const prepareDubbingLanguage = ref("");
const canPrepareGame = computed(
  () =>
    buildPrepareGameRequest(
      Number(gameId),
      prepareWikipediaLanguage.value,
      prepareDubbingLanguage.value,
    ) !== null,
);

const { locale, t } = useI18n();
const localePath = useLocalePath();

const cacheKey = `game-${gameId}-${locale.value}`;
const { data, pending, refresh, error } = await useAsyncData(
  cacheKey,
  () => fetchGameData(gameId, locale.value, "media-page"),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);
if (import.meta.server && error.value) throw error.value;

const game = computed(() => data.value?.game);
const dubbingProjects = computed(() => {
  const projects: GameDubbingProject[] = [...(data.value?.dubbingProjects || [])].filter(
    projectHasVoiceActor,
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

function projectHasVoiceActor(project: GameDubbingProject): boolean {
  return (project.works || []).some((work) => work.voice_actor);
}

function projectVoiceActorCount(project: GameDubbingProject): number {
  const ids = new Set<number>();
  for (const work of project.works || []) {
    if (work.voice_actor?.id) ids.add(work.voice_actor.id);
  }
  return ids.size;
}

const coverUrl = computed(() => {
  if (!game.value?.cover?.url) return null;
  return game.value.cover.url;
});

const activeDubProject = computed(() =>
  resolveDetailCollectionProject(dubbingProjects.value, route.query.dub),
);
const activeDubId = computed(() => activeDubProject.value?.id || null);

const getDisplayLanguage = useDubbingLanguageLabel();

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
const formatReleaseYear = (ts?: number) => (ts ? new Date(ts * 1000).getFullYear().toString() : "");

const searchQuery = ref("");
const searchInput = ref("");
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");
const debouncedSearch = refDebounced(searchInput, 150);
watch(debouncedSearch, (val) => {
  searchQuery.value = val;
});
watch([searchQuery, activeDubId], ([search, dub], [previousSearch, previousDub]) => {
  if (
    search !== previousSearch ||
    (typeof previousDub === "number" &&
      previousDub > 0 &&
      typeof dub === "number" &&
      dub > 0 &&
      dub !== previousDub)
  ) {
    void setCastPage(1);
  }
});

const completeCastItems = computed<GameDetailCastCard[]>(() =>
  formatGameDetailCastCards(data.value?.characters || [], activeDubProject.value),
);
const filteredCastItems = computed(() =>
  filterDetailCollectionItems(completeCastItems.value, searchQuery.value),
);
const castTotal = computed(() => filteredCastItems.value.length);
const castItems = computed(() =>
  paginateDetailCollection(filteredCastItems.value, castPage.value, 12),
);

async function triggerPrepareGame() {
  const body = buildPrepareGameRequest(
    Number(gameId),
    prepareWikipediaLanguage.value,
    prepareDubbingLanguage.value,
  );
  if (!isAdmin.value || !body) return;
  isPreparing.value = true;
  try {
    const result = await $fetch("/api/prepare_game", {
      method: "POST",
      body,
    });
    if (result.ok) {
      console.info(
        `[prepare_game] LLM: ${result.llmModel ?? "unknown"} | ${result.note ?? `${result.creditsAdded} credits added`}`,
      );
      showPrepareDialog.value = false;
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
  title: computed(() => {
    const year = game.value?.first_release_date
      ? ` (${formatReleaseYear(game.value.first_release_date)})`
      : "";
    let base = game.value ? game.value.name + year : t("search.videoGame");
    if (activeDubProject.value) {
      base +=
        " - " +
        t("details.dubbing", {
          lang: getDisplayLanguage(activeDubProject.value.language),
        });
    }
    return base;
  }),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const title = game.value?.name || "";
        let desc =
          game.value?.summary ||
          (title ? t("seo.gameDescription", { title }) : t("seo.gameDescriptionFallback"));
        if (activeDubProject.value && title) {
          desc =
            t("seo.gameDescriptionDubbing", {
              lang: getDisplayLanguage(activeDubProject.value.language),
              title,
            }) +
            " " +
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
