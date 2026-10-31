<template>
  <div class="min-h-screen">
    <MediaSkeleton v-if="pending && !toy" />

    <MediaDetailsLayout
      v-else-if="toy"
      :title="toy.name"
      :backdrop-url="null"
      :poster-url="toy.cover_url"
      :loading="pending"
    >
      <template #metadata>
        <span
          v-if="toy.manufacturer"
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ toy.manufacturer }}
        </span>
        <span
          v-if="toy.release_year"
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ toy.release_year }}
        </span>
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
          </NuxtLink>
        </div>
        <div v-else class="text-sm theme-text-muted font-medium">
          {{ $t("game.noDubbingProjects") }}
        </div>
      </template>

      <template #actions-right>
        <ClientOnly>
          <NuxtLink
            v-if="isAdmin"
            :to="
              localePath(
                activeDubProject
                  ? `/toy/${toy.id}/projects/${activeDubProject.id}/edit`
                  : `/toy/${toy.id}/projects/new`,
              )
            "
            class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
          >
            {{ activeDubProject ? $t("common.edit") : $t("common.addVoice") }}
          </NuxtLink>
        </ClientOnly>
        <ForceEnqueueButton media-type="toy" :media-id="toy.id" />
      </template>

      <template #content>
        <div v-if="toy.description" class="mb-10 max-w-4xl">
          <h2 class="text-2xl font-bold mb-4">{{ $t("details.synopsis") }}</h2>
          <p class="theme-text-secondary leading-relaxed text-lg">
            {{ toy.description }}
          </p>
        </div>

        <div
          v-if="toy.product_line || toy.manufacturer || toy.release_year"
          class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-10 p-6 rounded-xl border theme-border theme-surface"
        >
          <div v-if="toy.manufacturer">
            <span class="text-xs theme-text-muted block mb-0.5">
              {{ $t("toy.manufacturerLabel") }}
            </span>
            <span class="text-sm font-semibold theme-text">{{ toy.manufacturer }}</span>
          </div>
          <div v-if="toy.product_line">
            <span class="text-xs theme-text-muted block mb-0.5">{{ $t("toy.productLine") }}</span>
            <span class="text-sm font-semibold theme-text">{{ toy.product_line }}</span>
          </div>
          <div v-if="toy.release_year">
            <span class="text-xs theme-text-muted block mb-0.5">{{ $t("toy.releaseYear") }}</span>
            <span class="text-sm font-semibold theme-text">{{ toy.release_year }}</span>
          </div>
        </div>

        <section
          v-if="activeDubProject?.studio_data || activeDubProject?.crew?.length"
          class="theme-surface-overlay backdrop-blur border theme-border rounded-2xl p-6 space-y-4 mb-10 shadow-xl"
        >
          <h2 class="text-xs font-bold theme-text-muted uppercase tracking-wider">
            {{ $t("toy.studioAndProduction") }}
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div v-if="activeDubProject.studio_data" class="space-y-1">
              <span class="text-xs theme-text-muted">{{ $t("common.production") }}</span>
              <NuxtLink
                :to="localePath(`/studio/${activeDubProject.studio_data.id}`)"
                class="text-sm font-semibold theme-status-warning-text hover:underline block"
              >
                {{ activeDubProject.studio_data.name }}
              </NuxtLink>
            </div>
            <div v-for="member in activeDubProject.crew" :key="member.id" class="space-y-1">
              <span class="text-xs theme-text-muted">{{
                member.job?.name || $t("common.team")
              }}</span>
              <NuxtLink
                v-if="member.person"
                :to="localePath(`/voice-actor/${member.person.id}`)"
                class="text-sm font-semibold theme-text hover:underline block"
              >
                {{ member.person.firstname }} {{ member.person.lastname }}
              </NuxtLink>
            </div>
          </div>
        </section>

        <section class="space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 class="text-xl font-bold theme-text flex items-center gap-2">
                <span>{{ $t("toyEditor.voiceNarrators") }}</span>
                <span
                  v-if="castTotal > 0"
                  class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 theme-status-warning-text font-semibold border border-amber-500/20"
                >
                  {{ castTotal }}
                </span>
              </h2>
              <p class="text-xs theme-text-muted mt-1">{{ $t("toy.voiceCastDescription") }}</p>
            </div>
          </div>

          <div
            v-if="castTotal === 0"
            class="text-center py-16 theme-surface-overlay rounded-2xl border theme-border theme-text-muted text-sm"
          >
            {{ $t("toy.noVoicesYet") }}
          </div>

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
              <div
                class="theme-surface-overlay border theme-border rounded-2xl p-4 flex gap-4 items-center theme-hover-border transition-colors group shadow-md"
              >
                <NuxtLink
                  :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                  class="relative w-14 h-14 rounded-full overflow-hidden theme-surface-muted shrink-0 border theme-border group-hover:border-amber-500 transition-colors flex items-center justify-center"
                >
                  <NuxtImg
                    v-if="item.profile_picture"
                    :src="item.profile_picture"
                    :alt="`${item.firstname} ${item.lastname}`"
                    class="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span v-else class="text-sm font-bold theme-text-muted">
                    {{ item.firstname?.[0] }}{{ item.lastname?.[0] }}
                  </span>
                </NuxtLink>
                <div class="flex-1 min-w-0">
                  <NuxtLink
                    :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                    class="text-sm font-bold theme-status-warning-text transition-colors truncate block"
                  >
                    {{ item.firstname }} {{ item.lastname }}
                  </NuxtLink>
                  <span class="text-xs theme-text-muted block truncate mt-0.5">
                    {{ item.character_name || item.performance || $t("toy.voiceCastDescription") }}
                  </span>
                  <span v-if="item.note" class="text-xs theme-text-muted block truncate mt-1">
                    {{ item.note }}
                  </span>
                </div>
              </div>
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
import ReportModal from "../../components/ReportModal.vue";
import {
  fetchToyData,
  formatMediaWorkCastCards,
  paginateDetailCollection,
  resolveDetailCollectionProject,
} from "@app/shared-logic";
import type { Toy, ToyDubbingProject } from "@app/shared-logic";

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
  () => fetchToyData(toyId.value, locale.value, "media-page"),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
    watch: [toyId, locale],
  },
);
if (import.meta.server && error.value) throw error.value;

const toy = computed<Toy | null>(() => data.value?.toy || null);
const dubbingProjects = computed<ToyDubbingProject[]>(() => data.value?.dubbingProjects || []);
const activeDubProject = computed(() =>
  resolveDetailCollectionProject(dubbingProjects.value, route.query.dub),
);
const activeDubId = computed(() => activeDubProject.value?.id || 0);
watch(activeDubId, (dub, previousDub) => {
  if (previousDub > 0 && dub > 0 && dub !== previousDub) void setCastPage(1);
});

const completeCastItems = computed(() => formatMediaWorkCastCards(activeDubProject.value));
const castTotal = computed(() => completeCastItems.value.length);
const castItems = computed(() =>
  paginateDetailCollection(completeCastItems.value, castPage.value, 12),
);

const languageDisplayNames = computed(() => {
  try {
    return new Intl.DisplayNames([locale.value || "en"], { type: "language" });
  } catch {
    return undefined;
  }
});

function getDisplayLanguage(langCode?: string | null): string {
  if (!langCode) return "";
  try {
    return languageDisplayNames.value?.of(langCode) || langCode;
  } catch {
    return langCode;
  }
}

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
