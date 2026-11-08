<template>
  <div>
    <MediaSkeleton v-if="pending && !toy" />

    <MediaDetailsLayout
      v-else-if="toy"
      :share-dub="activeDubProject?.id"
      :title="toy.name"
      :backdrop-url="null"
      :poster-url="toy.cover_url"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip v-if="toy.manufacturer">{{ toy.manufacturer }}</DetailsMetaChip>
        <DetailsMetaChip v-if="toy.release_year">{{ toy.release_year }}</DetailsMetaChip>
        <DetailsMetaChip v-if="toy.product_line" variant="tag" :label="$t('toy.productLine')">
          {{ toy.product_line }}
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
                  ? `/toy/${toy.id}/projects/${activeDubProject.id}/edit`
                  : `/toy/${toy.id}/projects/new`,
              )
            "
            :label="activeDubProject ? $t('common.edit') : $t('common.addVoice')"
          />
        </ClientOnly>
        <ForceEnqueueButton media-type="toy" :media-id="toy.id" />
        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis v-if="toy.description" :text="toy.description" />

        <DetailsCrewCard :title="$t('podcast.productionTeam')" :crew="toyCrew" />

        <section>
          <DetailsCastHeader
            :title="$t('toyEditor.voiceNarrators')"
            :subtitle="
              $t('media.rolesCount', {
                shown: castItems.length,
                total: castTotal,
              })
            "
            :searchable="false"
          />

          <DetailsEmptyState v-if="castTotal === 0">{{ $t("toy.noVoicesYet") }}</DetailsEmptyState>

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

    <div v-else-if="!pending" class="text-center py-24 theme-text-muted">
      {{ $t("toy.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import MediaSkeleton from "../../components/MediaSkeleton.vue";
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
  fetchToyData,
  fetchDetailCollection,
  resolveDetailCollectionProject,
} from "@app/shared-logic";
import type { DetailCollectionProject, MediaWorkCastCard, Toy } from "@app/shared-logic";

const route = useRoute();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const user = useSupabaseUser();
const isAdmin = computed(() => user.value?.app_metadata?.role === "admin");
const toyId = computed(() => {
  const idParam = route.params.id;
  const num = Number.parseInt(String(idParam), 10);
  return Number.isSafeInteger(num) ? num : 0;
});
const isReportModalOpen = ref(false);
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");
const currentUrl = computed(() => route.fullPath);

const { data, pending, error } = await useAsyncData(
  `toy-${toyId.value}-${locale.value}`,
  () => fetchToyData(toyId.value, locale.value, "media-summary"),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
    watch: [toyId, locale],
  },
);
if (import.meta.server && error.value) throw error.value;

const toy = computed<Toy | null>(() => data.value?.toy || null);
const dubbingProjects = computed<DetailCollectionProject[]>(
  () => data.value?.dubbingProjects || [],
);
const activeDubProject = computed(() =>
  resolveDetailCollectionProject(dubbingProjects.value, route.query.dub),
);
const activeDubId = computed(() => activeDubProject.value?.id || 0);
watch(activeDubId, (dub, previousDub) => {
  if (previousDub > 0 && dub > 0 && dub !== previousDub) void setCastPage(1);
});

const { data: castData } = await useAsyncData(
  () => `toy-cast-${toyId.value}-${activeDubId.value}-${castPage.value}`,
  () =>
    activeDubId.value
      ? fetchDetailCollection<MediaWorkCastCard>({
          collection: "media-cast",
          id: toyId.value,
          type: "toy",
          projectId: activeDubId.value,
          page: castPage.value,
          pageSize: 12,
        })
      : Promise.resolve(null),
  { watch: [activeDubId, castPage] },
);
const castTotal = computed(() => castData.value?.pagination.totalItems || 0);
const castItems = computed(() => castData.value?.data || []);

const getDisplayLanguage = useDubbingLanguageLabel();

const toyCrew = computed(() =>
  (activeDubProject.value?.crew ?? []).map((member) => ({
    id: member.id,
    role: member.job?.name,
    personId: member.person?.id,
    name: `${member.person?.firstname ?? ""} ${member.person?.lastname ?? ""}`.trim(),
  })),
);

useHead({
  title: computed(() => (toy.value ? toy.value.name + " - " + t("toy.title") : t("toy.title"))),
  meta: [
    {
      name: "description",
      content: computed(
        () =>
          toy.value?.description?.substring(0, 160) ||
          (toy.value?.name
            ? t("seo.toyDescription", { title: toy.value.name })
            : t("seo.toyDescriptionFallback")),
      ),
    },
  ],
});
</script>
