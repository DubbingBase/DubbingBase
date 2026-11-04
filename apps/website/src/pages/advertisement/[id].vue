<template>
  <div>
    <!-- Skeleton loader during SSR/fetch -->
    <MediaSkeleton v-if="pending && !data" />

    <!-- Main Content -->
    <MediaDetailsLayout
      v-else-if="advertisement"
      :title="advertisement.title"
      :backdrop-url="null"
      :poster-url="posterUrl"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip v-if="advertisement.year">{{ advertisement.year }}</DetailsMetaChip>
        <DetailsMetaChip
          v-if="advertisement.brand && advertisement.brand !== activeDubProject?.studio_data?.name"
          variant="text"
          :title="advertisement.brand"
        >
          {{ advertisement.brand }}
        </DetailsMetaChip>
        <DetailsMetaChip
          v-if="advertisement.agency"
          variant="tag"
          :label="$t('advertisement.agencyLabel')"
        >
          {{ advertisement.agency }}
        </DetailsMetaChip>
        <DetailsMetaChip
          v-if="advertisement.country"
          variant="tag"
          :label="$t('advertisement.countryBroadcast')"
        >
          {{ advertisement.country }}
        </DetailsMetaChip>
      </template>

      <template #actions-left>
        <DetailsDubTabs
          :projects="dubbingProjects"
          :active-id="activeDubId"
          :language-label="getDisplayLanguage"
        />
      </template>

      <template #actions-right>
        <DetailsStudioLink
          v-if="activeDubProject?.studio_data"
          :studio="activeDubProject.studio_data"
        />

        <ClientOnly>
          <DetailsEditLink
            v-if="isAdmin"
            :to="
              localePath(
                activeDubProject
                  ? `/advertisement/${advertisement.id}/projects/${activeDubProject.id}/edit`
                  : `/advertisement/${advertisement.id}/projects/new`,
              )
            "
            :label="activeDubProject ? $t('common.edit') : $t('common.create')"
          />
        </ClientOnly>

        <ForceEnqueueButton
          v-if="advertisement?.id"
          media-type="advertisement"
          :media-id="advertisement.id"
        />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis v-if="advertisement.description" :text="advertisement.description" />

        <section
          v-if="advertisement.video_id"
          class="theme-surface-overlay border theme-border-subtle theme-border rounded-2xl p-6 space-y-4 mb-10 shadow-xl"
        >
          <h2 class="text-xs font-bold theme-text-muted uppercase tracking-wider">
            {{ $t("advertisement.videoSpot") }}
          </h2>
          <div class="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
            <iframe
              :src="`https://www.youtube.com/embed/${advertisement.video_id}`"
              :title="advertisement.title"
              class="w-full h-full"
              loading="lazy"
              allowfullscreen
              allow="
                accelerometer;
                autoplay;
                clipboard-write;
                encrypted-media;
                gyroscope;
                picture-in-picture;
              "
            ></iframe>
          </div>
        </section>

        <DetailsCrewCard :title="$t('podcast.productionTeam')" :crew="advertisementCrew" />

        <section>
          <DetailsCastHeader
            :title="$t('advertisementEditor.voiceOffActors')"
            :subtitle="
              $t('media.rolesCount', {
                shown: castItems.length,
                total: castTotal,
              })
            "
            :searchable="false"
          />

          <DetailsEmptyState v-if="castTotal === 0">
            {{ $t("advertisement.noVoicesYet") }}
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
              <DetailsVoiceCastCard :item="item" :fallback-role="$t('advertisement.voiceOver')" />
            </template>
          </PaginatedResponsiveGrid>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="text-center py-24 theme-text-muted">
      {{ $t("advertisement.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import { toCrewCardMembers } from "../../utils/detail-dub-projects";
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
  fetchAdvertisementData,
  fetchDetailCollection,
  resolveDetailCollectionProject,
} from "@app/shared-logic";
import type { Advertisement, MediaWorkCastCard } from "@app/shared-logic";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === "admin";
});

const adId = computed(() => {
  const idParam = route.params.id;
  const num = parseInt(String(idParam), 10);
  return isNaN(num) ? 0 : num;
});

const isReportModalOpen = ref(false);
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");
const currentUrl = computed(() => route.fullPath);

// Instant Hydration Data Fetching
const { data, pending, error } = await useAsyncData(
  `ad-${adId.value}-${locale.value}`,
  () =>
    fetchAdvertisementData(adId.value, locale.value, {
      projection: "media-summary",
    }),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);
if (import.meta.server && error.value) throw error.value;

const advertisement = computed<Advertisement | null>(() => data.value?.advertisement || null);
const dubbingProjects = computed(() => data.value?.dubbingProjects || []);
const getDisplayLanguage = useDubbingLanguageLabel();

const activeDubProject = computed(() =>
  resolveDetailCollectionProject(dubbingProjects.value, route.query.dub),
);
const activeDubId = computed(() => activeDubProject.value?.id || 0);

watch(activeDubId, (dub, previousDub) => {
  if (previousDub > 0 && dub > 0 && dub !== previousDub) void setCastPage(1);
});

const posterUrl = computed(() => {
  return advertisement.value?.poster_url || null;
});

const { data: castData } = await useAsyncData(
  () => `advertisement-cast-${adId.value}-${activeDubId.value}-${castPage.value}`,
  () =>
    activeDubId.value
      ? fetchDetailCollection<MediaWorkCastCard>({
          collection: "media-cast",
          id: adId.value,
          type: "advertisement",
          projectId: activeDubId.value,
          page: castPage.value,
          pageSize: 12,
        })
      : Promise.resolve(null),
  { watch: [activeDubId, castPage] },
);
const castTotal = computed(() => castData.value?.pagination.totalItems || 0);
const castItems = computed(() => castData.value?.data || []);

const advertisementCrew = computed(() =>
  toCrewCardMembers(activeDubProject.value?.dubbing_project_crew),
);

useHead({
  title: computed(() =>
    advertisement.value
      ? advertisement.value.title + " - " + t("advertisement.title")
      : t("advertisement.title"),
  ),
  meta: [
    {
      name: "description",
      content: computed(
        () =>
          advertisement.value?.description?.substring(0, 160) ||
          (advertisement.value?.title
            ? t("seo.advertisementDescription", {
                title: advertisement.value.title,
              })
            : t("seo.advertisementDescriptionFallback")),
      ),
    },
  ],
});
</script>
