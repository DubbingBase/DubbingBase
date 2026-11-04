<template>
  <div>
    <MediaSkeleton v-if="pending && !audiobook" />
    <MediaDetailsLayout
      v-else-if="audiobook"
      :title="audiobook.title"
      :backdrop-url="null"
      :poster-url="coverUrl"
      :loading="pending"
    >
      <template #metadata>
        <DetailsMetaChip v-if="audiobook.first_publish_year">
          {{ audiobook.first_publish_year }}
        </DetailsMetaChip>
        <DetailsMetaChip v-if="authorsText" variant="text" :title="authorsText">
          {{ authorsText }}
        </DetailsMetaChip>
        <div class="flex gap-2 ml-2">
          <DetailsExternalLink
            v-if="audiobook.id"
            :href="`https://openlibrary.org/works/OL${audiobook.id}W`"
            :label="$t('audiobook.openLibrary')"
          />
        </div>
      </template>

      <template #actions-left>
        <DetailsDubTabs
          :projects="dubbingProjects"
          :active-id="activeDubId ?? 0"
          :language-label="getDisplayLanguage"
          :count="detailProjectVoiceActorCount"
        />
      </template>

      <template #actions-right>
        <DetailsStudioLink
          v-if="activeDubProject?.studio_data"
          :studio="activeDubProject.studio_data"
        />

        <ClientOnly>
          <DetailsEditLink
            v-if="isAdmin && audiobook?.id"
            :to="
              localePath(
                activeDubId
                  ? `/audiobook/${audiobook.id}/projects/${activeDubId}/edit`
                  : `/audiobook/${audiobook.id}/projects/new`,
              )
            "
            :label="$t('common.edit')"
          />
        </ClientOnly>

        <ForceEnqueueButton v-if="audiobook?.id" media-type="audiobook" :media-id="audiobook.id" />

        <DetailsReportButton @click="isReportModalOpen = true" />
      </template>

      <template #content>
        <DetailsSynopsis :text="audiobook.description" :empty-label="$t('audiobook.noDescription')">
          <DetailsFacts>
            <DetailsFact :label="$t('audiobook.author')" :value="authorsText" />
            <DetailsFact
              :label="$t('audiobook.publishYear')"
              :value="audiobook.first_publish_year || audiobook.first_publish_date"
            />
            <DetailsFact
              v-if="audiobook.isbn"
              :label="$t('audiobook.isbn')"
              :value="audiobook.isbn"
            />
            <DetailsFact
              v-if="audiobook.subjects && audiobook.subjects.length > 0"
              :label="$t('audiobook.subjects')"
              wide
            >
              <DetailsTagList :tags="audiobook.subjects.slice(0, 4)" />
            </DetailsFact>
          </DetailsFacts>
        </DetailsSynopsis>

        <!-- Voice Cast / Narrators -->
        <section>
          <DetailsCastHeader
            v-model:search="searchInput"
            :title="$t('details.castAndCrew')"
            :subtitle="
              $t('audiobook.castCount', {
                shown: castItems.length,
                total: castTotal,
              })
            "
          />

          <div
            v-if="castTotal === 0"
            class="theme-text-muted text-center py-12 theme-input rounded-2xl border theme-border-subtle theme-border"
          >
            {{ $t("audiobook.noCast") }}
          </div>

          <PaginatedResponsiveGrid
            v-else
            :items="castItems"
            :total-items="castTotal"
            :page="castPage"
            :page-size="12"
            grid-class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
            :item-key="(item) => item.work_id"
            @update:page="setCastPage"
          >
            <template #default="{ item }">
              <div
                :key="item.work_id"
                class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-border"
              >
                <div class="flex flex-col gap-4">
                  <div class="flex items-center gap-4">
                    <NuxtLink
                      :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                      class="w-16 h-16 rounded-xl overflow-hidden theme-surface-muted flex-shrink-0"
                    >
                      <NuxtImg
                        format="webp"
                        decoding="async"
                        v-if="item.profile_picture"
                        :src="item.profile_picture"
                        class="w-full h-full object-cover"
                        alt="Voice Actor"
                      />
                      <div
                        v-else
                        class="w-full h-full flex items-center justify-center text-lg font-bold theme-text-muted theme-surface-muted uppercase"
                      >
                        {{ item.firstname?.[0] }}{{ item.lastname?.[0] }}
                      </div>
                    </NuxtLink>

                    <div class="flex flex-col min-w-0 flex-1">
                      <NuxtLink
                        :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                        class="font-bold text-base theme-text theme-hover-primary-text transition-colors truncate block"
                      >
                        {{ item.firstname }} {{ item.lastname }}
                      </NuxtLink>
                      <span class="text-xs theme-text-muted font-medium truncate block mt-0.5">
                        {{ item.character_name || item.performance || $t("audiobook.narrator") }}
                      </span>
                      <div v-if="item.performance" class="mt-1">
                        <span
                          class="text-[10px] px-2 py-0.5 theme-surface-raised theme-surface-muted theme-text-secondary rounded-md font-medium border theme-border-subtle theme-border"
                        >
                          {{ item.performance }}
                        </span>
                      </div>
                      <div v-if="item.note" class="text-xs theme-text-muted mt-1">
                        {{ item.note }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </PaginatedResponsiveGrid>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="text-center py-20 theme-text-muted min-h-screen">
      {{ $t("audiobook.notFound") }}
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import {
  displayDubbingLanguage,
  fetchDetailCollection,
  resolveDetailCollectionProject,
} from "@app/shared-logic";
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { refDebounced } from "@vueuse/core";
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import { detailProjectVoiceActorCount } from "../../utils/detail-dub-projects";
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import DetailsDubTabs from "../../components/layout/details/DetailsDubTabs.vue";
import DetailsStudioLink from "../../components/layout/details/DetailsStudioLink.vue";
import DetailsEditLink from "../../components/layout/details/DetailsEditLink.vue";
import DetailsReportButton from "../../components/layout/details/DetailsReportButton.vue";
import DetailsMetaChip from "../../components/layout/details/DetailsMetaChip.vue";
import DetailsExternalLink from "../../components/layout/details/DetailsExternalLink.vue";
import DetailsSynopsis from "../../components/layout/details/DetailsSynopsis.vue";
import DetailsFacts from "../../components/layout/details/DetailsFacts.vue";
import DetailsFact from "../../components/layout/details/DetailsFact.vue";
import DetailsTagList from "../../components/layout/details/DetailsTagList.vue";
import DetailsCastHeader from "../../components/layout/details/DetailsCastHeader.vue";
import ReportModal from "../../components/ReportModal.vue";
import { fetchAudiobookData } from "@app/shared-logic";
import type { Audiobook, DetailCollectionProject, MediaWorkCastCard } from "@app/shared-logic";
import { ExternalLink as ExternalLinkIcon, Search as SearchIcon } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const user = useSupabaseUser();
const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === "admin";
});

const audiobookId = computed(() => {
  const idParam = route.params.id;
  const num = parseInt(String(idParam), 10);
  return isNaN(num) ? 0 : num;
});

const isReportModalOpen = ref(false);
const currentUrl = computed(() => route.fullPath);
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");

// Instant Hydration Data Fetching
const { data, pending, error } = await useAsyncData(
  `audiobook-${audiobookId.value}-${locale.value}`,
  () =>
    fetchAudiobookData(audiobookId.value, locale.value, {
      projection: "media-summary",
    }),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);
if (import.meta.server && error.value) throw error.value;

const audiobook = computed<Audiobook | null>(() => data.value?.audiobook || null);
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

const coverUrl = computed(() => {
  return audiobook.value?.cover_url || null;
});

const authorsText = computed(() => {
  if (!audiobook.value) return "";
  if (audiobook.value.authors && audiobook.value.authors.length > 0) {
    return audiobook.value.authors.map((a) => a.name).join(", ");
  }
  return audiobook.value.author_name || "";
});

const getDisplayLanguage = useDubbingLanguageLabel();

// Client-side search with debounce
const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);

watch([debouncedSearch, activeDubId], ([search, dub], [previousSearch, previousDub]) => {
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
    `audiobook-cast-${audiobookId.value}-${activeDubId.value}-${castPage.value}-${debouncedSearch.value}`,
  () =>
    activeDubId.value
      ? fetchDetailCollection<MediaWorkCastCard>({
          collection: "media-cast",
          id: audiobookId.value,
          type: "audiobook",
          projectId: activeDubId.value,
          page: castPage.value,
          pageSize: 12,
          query: debouncedSearch.value,
        })
      : Promise.resolve(null),
  { watch: [activeDubId, castPage, debouncedSearch] },
);
const castTotal = computed(() => castData.value?.pagination.totalItems || 0);
const castItems = computed(() => castData.value?.data || []);

// SEO Meta
useHead({
  title: computed(() =>
    audiobook.value ? audiobook.value.title + " - " + t("audiobook.title") : t("audiobook.title"),
  ),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const title = audiobook.value?.title || "";
        const description =
          audiobook.value?.description ||
          (title
            ? t("seo.audiobookDescription", { title })
            : t("seo.audiobookDescriptionFallback"));
        return description.length > 160 ? description.substring(0, 157) + "..." : description;
      }),
    },
  ],
});
</script>
