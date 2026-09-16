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
        <span
          v-if="audiobook.first_publish_year"
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ audiobook.first_publish_year }}
        </span>
        <span
          v-if="authorsText"
          class="theme-text font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg truncate max-w-[200px] md:max-w-xs"
          :title="authorsText"
        >
          {{ authorsText }}
        </span>
        <div class="flex gap-2 ml-2">
          <a
            v-if="audiobook.id"
            :href="`https://openlibrary.org/works/OL${audiobook.id}W`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg theme-surface-overlay theme-text theme-hover-surface-muted transition-colors backdrop-blur-md uppercase tracking-wider"
            >{{ $t("audiobook.openLibrary")
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
          {{
            $t(
              "details.noDubbingProjects",
              "Aucun projet de doublage disponible",
            )
          }}
        </div>
      </template>

      <template #actions-right>
        <template v-if="activeDubProject?.studio_data">
          <NuxtLink
            :to="localePath(`/studio/${activeDubProject.studio_data.id}`)"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border theme-border-subtle theme-border theme-hover-primary-border transition-colors group theme-surface-raised theme-surface"
            title="Studio d'enregistrement"
          >
            <div
              class="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 theme-surface-muted"
            >
              <img
                v-if="activeDubProject.studio_data.logo_url"
                :src="activeDubProject.studio_data.logo_url"
                class="w-full h-full object-contain p-0.5"
              />
              <span v-else class="font-bold text-xs theme-text-muted">
                {{ activeDubProject.studio_data.name?.charAt(0) || "" }}
              </span>
            </div>
            <span
              class="font-medium text-xs theme-hover-primary-text transition-colors truncate max-w-[120px]"
            >
              {{ activeDubProject.studio_data.name }}
            </span>
          </NuxtLink>
          <div class="h-6 w-px theme-surface-muted"></div>
        </template>

        <ClientOnly>
          <NuxtLink
            v-if="isAdmin && audiobook?.id"
            :to="
              localePath(
                activeDubId
                  ? `/audiobook/${audiobook.id}/projects/${activeDubId}/edit`
                  : `/audiobook/${audiobook.id}/projects/new`,
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
          v-if="audiobook?.id"
          media-type="audiobook"
          :media-id="audiobook.id"
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
              {{ $t("details.synopsis", "Synopsis / Description") }}
            </h2>
            <p
              class="theme-text-secondary leading-relaxed text-lg mb-8 whitespace-pre-line"
            >
              {{
                audiobook.description ||
                $t(
                  "details.noSynopsis",
                  "Aucune description disponible pour ce livre.",
                )
              }}
            </p>

            <div
              class="grid grid-cols-2 md:grid-cols-4 gap-6 theme-surface p-6 rounded-xl border theme-border-subtle theme-border shadow-sm"
            >
              <div>
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("audiobook.author", "Auteur(s)") }}
                </h3>
                <p class="font-medium text-sm">
                  {{ authorsText || "-" }}
                </p>
              </div>
              <div>
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("audiobook.publishYear", "Publication") }}
                </h3>
                <p class="font-medium text-sm">
                  {{
                    audiobook.first_publish_year ||
                    audiobook.first_publish_date ||
                    "-"
                  }}
                </p>
              </div>
              <div v-if="audiobook.isbn">
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("audiobook.isbn", "ISBN") }}
                </h3>
                <p class="font-medium text-sm">
                  {{ audiobook.isbn }}
                </p>
              </div>
              <div
                v-if="audiobook.subjects && audiobook.subjects.length > 0"
                class="col-span-2 md:col-span-1"
              >
                <h3
                  class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2"
                >
                  {{ $t("audiobook.subjects") }}
                </h3>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="(sub, sIdx) in audiobook.subjects.slice(0, 4)"
                    :key="sIdx"
                    class="px-2 py-0.5 theme-surface-raised theme-surface-muted text-xs font-medium rounded-md theme-text-secondary"
                  >
                    {{ sub }}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <!-- Voice Cast / Narrators -->
        <section>
          <div class="flex flex-col mb-6 gap-2">
            <div
              class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4"
            >
              <div>
                <h2 class="text-2xl font-bold">
                  {{ $t("details.castAndCrew", "Voix & Narration") }}
                </h2>
                <div class="theme-text-muted text-sm mt-1">
                  {{
                    $t("audiobook.castCount", {
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
                  :placeholder="
                    $t('search.placeholder', 'Rechercher un comédien...')
                  "
                  class="w-full theme-input border theme-border-subtle theme-border rounded-xl pl-10 pr-4 py-2 text-sm theme-focus transition-all theme-text"
                />
              </div>
            </div>
          </div>

          <div
            v-if="castTotal === 0"
            class="theme-text-muted text-center py-12 theme-input rounded-2xl border theme-border-subtle theme-border"
          >
            {{
              $t(
                "details.noCast",
                "Aucun narrateur ou comédien renseigné pour ce projet.",
              )
            }}
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
                      <span
                        class="text-xs theme-text-muted font-medium truncate block mt-0.5"
                      >
                        {{
                          item.character_name ||
                          item.performance ||
                          $t("audiobook.narrator", "Narrateur")
                        }}
                      </span>
                      <div v-if="item.performance" class="mt-1">
                        <span
                          class="text-[10px] px-2 py-0.5 theme-surface-raised theme-surface-muted theme-text-secondary rounded-md font-medium border theme-border-subtle theme-border"
                        >
                          {{ item.performance }}
                        </span>
                      </div>
                      <div
                        v-if="item.note"
                        class="text-xs theme-text-muted mt-1"
                      >
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
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { refDebounced } from "@vueuse/core";
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import ReportModal from "../../components/ReportModal.vue";
import { fetchAudiobookData, fetchDetailCollection } from "@app/shared-logic";
import type {
  Audiobook,
  AudiobookResponse,
  PaginatedResponse,
} from "@app/shared-logic";
import {
  ExternalLink as ExternalLinkIcon,
  Search as SearchIcon,
} from "lucide-vue-next";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const localePath = useLocalePath();
const user = useSupabaseUser();
const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const audiobookId = computed(() => {
  const idParam = route.params.id;
  const num = parseInt(idParam as string, 10);
  return isNaN(num) ? 0 : num;
});

const isReportModalOpen = ref(false);
const currentUrl = computed(() => route.fullPath);
const { page: castPage, setPage: setCastPage } = useUrlPagination("castPage");

// Instant Hydration Data Fetching
const { data, pending } = await useAsyncData(
  `audiobook-${audiobookId.value}-${locale.value}`,
  () => fetchAudiobookData(audiobookId.value, locale.value),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const audiobook = computed<Audiobook | null>(
  () => data.value?.audiobook || null,
);
const dubbingProjects = computed(() => {
  return (data.value?.dubbingProjects || []).filter((p: any) =>
    (p.works || []).some((w: any) => w.voice_actor),
  );
});

function projectVoiceActorCount(project: any): number {
  const ids = new Set<number>();
  for (const w of project.works || []) {
    if (w.voice_actor?.id) ids.add(w.voice_actor.id);
  }
  return ids.size;
}

const activeDubId = computed(() => {
  if (route.query.dub) {
    return Number(route.query.dub);
  }
  return dubbingProjects.value[0]?.id || 0;
});

const activeDubProject = computed(() => {
  return (
    dubbingProjects.value.find((p: any) => p.id === activeDubId.value) ||
    dubbingProjects.value[0] ||
    null
  );
});

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

function getDisplayLanguage(langCode?: string | null): string {
  if (!langCode) return "Français";
  if (langCode === "fr" || langCode === "fr-FR") return "Français";
  if (langCode === "fr-CA") return "Québécois";
  if (langCode === "fr-BE") return "Belge";
  if (langCode === "en" || langCode === "en-US") return "English";
  if (langCode === "ja") return "Japonais";
  if (langCode === "es") return "Espagnol";
  if (langCode === "de") return "Allemand";
  if (langCode === "it") return "Italien";
  return langCode;
}

interface FormattedCastItem {
  work_id: number;
  voice_actor_id: number;
  firstname: string;
  lastname: string;
  character_name?: string;
  performance?: string;
  note?: string;
  profile_picture?: string | null;
}

// Client-side search with debounce
const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);

watch([debouncedSearch, activeDubId], () => {
  void setCastPage(1);
});

const castRequest = computed(() => ({
  collection: "media-cast" as const,
  type: "audiobook",
  id: audiobookId.value,
  projectId: activeDubId.value || undefined,
  query: debouncedSearch.value,
  page: castPage.value,
  pageSize: 12,
}));
const { data: castPageData } = useAsyncData<
  PaginatedResponse<FormattedCastItem>
>(
  computed(
    () =>
      `audiobook-cast-${audiobookId.value}-${locale.value}-${castPage.value}-${activeDubId.value}-${debouncedSearch.value}`,
  ),
  () => fetchDetailCollection<FormattedCastItem>(castRequest.value),
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

// SEO Meta
useHead({
  title: computed(() =>
    audiobook.value
      ? `${audiobook.value.title} - Doublage & Voix | DubbingBase`
      : "Livre Audio | DubbingBase",
  ),
  meta: [
    {
      name: "description",
      content: computed(() =>
        audiobook.value
          ? `Découvrez le casting vocal et les narrateurs du livre audio ${audiobook.value.title} sur DubbingBase.`
          : "Informations de doublage de livre audio sur DubbingBase.",
      ),
    },
  ],
});
</script>
