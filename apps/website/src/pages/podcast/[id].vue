<template>
  <div>
    <!-- Skeleton loader during SSR/fetch -->
    <MediaSkeleton v-if="pending && !data" />

    <!-- Main Content -->
    <MediaDetailsLayout
      v-else-if="podcast"
      :backdrop-url="null"
      :poster-url="coverUrl"
      :title="podcast.title"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip v-if="podcast.release_date">
          {{ podcast.release_date.substring(0, 4) }}
        </DetailsMetaChip>
        <DetailsMetaChip v-if="podcast.author" variant="text" :title="podcast.author">
          {{ podcast.author }}
        </DetailsMetaChip>
      </template>

      <template #actions-left>
        <DetailsDubTabs
          :projects="dubbingProjects"
          :active-id="activeDubId"
          :language-label="getDisplayLanguage"
          :count="detailProjectVoiceActorCount"
        />
      </template>

      <template #actions-right>
        <button
          v-if="podcast.feed_url"
          type="button"
          @click="openExternalUrl(podcast.feed_url)"
          class="px-3 py-1.5 theme-surface-muted theme-hover-surface-muted text-xs font-semibold theme-text rounded-xl border theme-border flex items-center gap-1.5 transition-colors"
        >
          <RadioIcon class="w-3.5 h-3.5 theme-primary-text" />
          <span>{{ $t("podcast.rssFeed") }}</span>
          <ExternalLinkIcon class="w-3 h-3 opacity-60" />
        </button>

        <DetailsStudioLink
          v-if="activeDubProject?.studio_data"
          :studio="activeDubProject.studio_data"
        />

        <ClientOnly>
          <DetailsEditLink
            v-if="isAdmin"
            :to="
              localePath(
                podcast?.id
                  ? activeDubId
                    ? `/podcast/${podcast.id}/projects/${activeDubId}/edit`
                    : `/podcast/${podcast.id}/projects/new`
                  : '/podcast/new',
              )
            "
            :label="activeDubId ? $t('common.edit') : $t('common.create')"
          />
        </ClientOnly>

        <ForceEnqueueButton v-if="podcast?.id" media-type="podcast" :media-id="podcast.id" />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis v-if="podcast.description" :text="podcast.description" />

        <DetailsCrewCard
          :title="$t('podcast.productionTeam')"
          :studio-label="$t('studio.recordingStudio')"
          :studio="activeDubProject?.studios"
          :crew="podcastCrew"
        />

        <section>
          <DetailsCastHeader
            v-model:search="castSearchQuery"
            :title="$t('podcast.castSection')"
            :subtitle="
              $t('media.rolesCount', {
                shown: castItems.length,
                total: castTotal,
              })
            "
            :searchable="castTotal > 8 || castSearchQuery.length > 0"
            :placeholder="$t('podcast.castSearchPlaceholder')"
          />

          <DetailsEmptyState v-if="castTotal === 0">
            {{
              dubbingProjects.length === 0 ? $t("podcast.noCastInfo") : $t("podcast.noCastMatch")
            }}
          </DetailsEmptyState>

          <PaginatedResponsiveGrid
            v-else
            :items="castItems"
            :total-items="castTotal"
            :page="castPage"
            :page-size="12"
            grid-class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            :item-key="(item) => item.work_id"
            @update:page="setCastPage"
          >
            <template #default="{ item }">
              <DetailsVoiceCastCard :item="item" :fallback-role="$t('common.roleCharacter')" />
            </template>
          </PaginatedResponsiveGrid>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="text-center py-24 theme-text-muted">
      {{ $t("podcast.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { refDebounced } from "@vueuse/core";
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import { detailProjectVoiceActorCount, toCrewCardMembers } from "../../utils/detail-dub-projects";
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import DetailsDubTabs from "../../components/layout/details/DetailsDubTabs.vue";
import DetailsStudioLink from "../../components/layout/details/DetailsStudioLink.vue";
import DetailsEditLink from "../../components/layout/details/DetailsEditLink.vue";
import DetailsReportButton from "../../components/layout/details/DetailsReportButton.vue";
import DetailsMetaChip from "../../components/layout/details/DetailsMetaChip.vue";
import DetailsSynopsis from "../../components/layout/details/DetailsSynopsis.vue";
import DetailsCrewCard from "../../components/layout/details/DetailsCrewCard.vue";
import DetailsCastHeader from "../../components/layout/details/DetailsCastHeader.vue";
import DetailsEmptyState from "../../components/layout/details/DetailsEmptyState.vue";
import DetailsVoiceCastCard from "../../components/layout/details/DetailsVoiceCastCard.vue";
import ReportModal from "../../components/ReportModal.vue";
import {
  fetchPodcastData,
  fetchDetailCollection,
  resolveDetailCollectionProject,
} from "@app/shared-logic";
import type { DetailCollectionProject, MediaWorkCastCard, Podcast } from "@app/shared-logic";
import {
  ExternalLink as ExternalLinkIcon,
  Search as SearchIcon,
  Radio as RadioIcon,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === "admin";
});

const podcastId = computed(() => {
  const idParam = route.params.id;
  const num = parseInt(String(idParam), 10);
  return isNaN(num) ? 0 : num;
});

const isReportModalOpen = ref(false);
const currentUrl = computed(() => route.fullPath);
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");

// Instant Hydration Data Fetching
const { data, pending, error } = await useAsyncData(
  `podcast-${podcastId.value}-${locale.value}`,
  () =>
    fetchPodcastData(podcastId.value, locale.value, {
      projection: "media-summary",
    }),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);
if (import.meta.server && error.value) throw error.value;

const podcast = computed<Podcast | null>(() => data.value?.podcast || null);
const dubbingProjects = computed(() => {
  return (data.value?.dubbingProjects || []).filter(
    (p: DetailCollectionProject) =>
      p.has_voice_actor || (p.works || []).some((w) => w.voice_actor || w.voice_actor_id),
  );
});

const activeDubProject = computed(() =>
  resolveDetailCollectionProject(dubbingProjects.value, route.query.dub),
);
const activeDubId = computed(() => activeDubProject.value?.id || 0);

const getDisplayLanguage = useDubbingLanguageLabel();

const podcastCrew = computed(() => toCrewCardMembers(activeDubProject.value?.dubbing_project_crew));

const coverUrl = computed(() => {
  return podcast.value?.cover_url || null;
});

// Keep search responsive without fetching the same detail payload again.
const castSearchQuery = ref("");
const debouncedCastSearch = refDebounced(castSearchQuery, 150);

watch([debouncedCastSearch, activeDubId], ([search, dub], [previousSearch, previousDub]) => {
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

const { data: castData } = await useAsyncData(
  () =>
    `podcast-cast-${podcastId.value}-${activeDubId.value}-${castPage.value}-${debouncedCastSearch.value}`,
  () =>
    activeDubId.value
      ? fetchDetailCollection<MediaWorkCastCard>({
          collection: "media-cast",
          id: podcastId.value,
          type: "podcast",
          projectId: activeDubId.value,
          page: castPage.value,
          pageSize: 12,
          query: debouncedCastSearch.value,
        })
      : Promise.resolve(null),
  { watch: [activeDubId, castPage, debouncedCastSearch] },
);
const castTotal = computed(() => castData.value?.pagination.totalItems || 0);
const castItems = computed(() => castData.value?.data || []);

function openExternalUrl(url?: string) {
  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank");
  }
}

useHead({
  title: computed(() =>
    podcast.value ? podcast.value.title + " - " + t("podcast.castSection") : t("podcast.title"),
  ),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const title = podcast.value?.title || "";
        const description =
          podcast.value?.description ||
          (title ? t("seo.podcastDescription", { title }) : t("seo.podcastDescriptionFallback"));
        return description.length > 160 ? description.substring(0, 157) + "..." : description;
      }),
    },
  ],
});
</script>
