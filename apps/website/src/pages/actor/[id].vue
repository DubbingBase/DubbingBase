<template>
  <div>
    <PersonSkeleton v-if="loading && !actor" />
    <PersonDetailsLayout
      v-else-if="actor"
      :name="actor.name"
      :profile-url="actor.profile_path ? resolveImageUrl(actor.profile_path) : null"
      :loading="loading"
    >
      <template #metadata>
        <span
          v-if="actor.place_of_birth"
          class="px-3 py-1 theme-surface-raised theme-surface-muted theme-text-secondary rounded-full text-sm"
          >{{ actor.place_of_birth }}</span
        >
        <span
          v-if="actor.birthday"
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
          >{{ $t("common.born") }}{{ actor.birthday.split("-")[0] }}</span
        >
        <span
          v-if="actor.deathday"
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
          >{{ $t("common.died") }}{{ actor.deathday.split("-")[0] }}</span
        >
      </template>

      <template #biography>
        <div
          v-if="actor.biography"
          class="prose dark:prose-invert max-w-none theme-text-secondary mt-6 theme-input p-6 rounded-2xl border theme-border-subtle theme-border"
        >
          <p
            class="leading-relaxed whitespace-pre-wrap line-clamp-[10] hover:line-clamp-none transition-all"
          >
            {{ actor.biography }}
          </p>
        </div>
      </template>

      <template #actions>
        <button
          type="button"
          @click="openReportModal"
          class="text-sm theme-text-muted theme-hover-danger-text transition-colors flex items-center gap-2"
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
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
          </svg>
          {{ t("report.button", "Signaler cette fiche") }}
        </button>
      </template>

      <template #content>
        <!-- Global Search -->
        <div class="w-full relative max-w-xl mb-6">
          <input
            v-model="searchInput"
            type="text"
            :placeholder="$t('actor.searchPlaceholder')"
            class="w-full px-4 py-3 pl-12 theme-input backdrop-blur border theme-border-subtle theme-border rounded-xl theme-text focus:outline-none theme-focus transition shadow-sm"
          />
          <svg
            class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 theme-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </div>

        <!-- Voices Section -->
        <section v-if="availableLanguages.length > 0">
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6"
          >
            <h2 class="text-2xl font-bold theme-text">
              {{ $t("actor.voices") }}
            </h2>
            <!-- Language Tabs -->
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                v-for="lang in availableLanguages"
                :key="lang"
                @click="selectedLanguage = lang"
                class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border"
                :class="
                  selectedLanguage === lang
                    ? 'theme-primary-bg theme-primary-border'
                    : 'theme-input theme-text-secondary theme-border-subtle theme-border theme-hover-surface-muted'
                "
              >
                {{ getDisplayLanguage(lang) }}
              </button>
            </div>
          </div>

          <div v-if="voiceActorsTotal > 0" @click="navigateActorCard">
            <PaginatedResponsiveGrid
              :items="voiceActorItems"
              :page="voicesPage"
              :page-size="12"
              grid-class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
              :item-key="(va) => va.id"
              @update:page="setVoicesPage"
            >
              <template #default="{ item: va }">
                <a
                  data-actor-nav
                  :href="actorLocalePath(`/voice-actor/${va.id}`)"
                  class="flex flex-col items-center p-4 rounded-xl border transition group hover:-translate-y-1 theme-input theme-border-subtle theme-border theme-hover-surface-muted"
                >
                  <div
                    class="relative w-20 h-20 rounded-full overflow-hidden mb-3 border-2 border-transparent theme-hover-primary-border transition-colors"
                  >
                    <img
                      v-if="va.profile_picture"
                      :src="getActorImageSrc(va.profile_picture)"
                      :alt="`${va.firstname} ${va.lastname}`"
                      class="object-cover w-full h-full"
                      loading="lazy"
                      decoding="async"
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center theme-surface-raised theme-surface-muted theme-text-muted font-bold"
                    >
                      {{ va.firstname[0] }}{{ va.lastname[0] }}
                    </div>
                  </div>
                  <span class="block font-bold text-center text-sm theme-text">
                    {{ va.firstname }} {{ va.lastname }}
                  </span>
                  <span class="text-xs theme-text-muted mt-1"
                    >{{ va.rolesCount }}{{ $t("actor.roles") }}</span
                  >
                </a>
              </template>
            </PaginatedResponsiveGrid>
          </div>
          <div
            v-else
            class="theme-text-muted text-center py-8 theme-input rounded-2xl border theme-border-subtle theme-border"
          >
            {{ $t("actor.noVoiceActorsForLanguage") }}
          </div>
        </section>

        <!-- Filmography Section -->
        <section>
          <div
            class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8"
          >
            <h2 class="text-2xl font-bold theme-text">
              {{ $t("voiceActor.filmography") }}
            </h2>
          </div>

          <div
            v-if="filmographyTotal === 0"
            class="theme-text-muted text-center py-12 theme-input rounded-2xl border theme-border-subtle theme-border"
          >
            {{ $t("actor.noWorks") }}
          </div>

          <div v-else @click="navigateActorCard">
            <PaginatedResponsiveGrid
              :items="filmographyItems"
              :total-items="filmographyTotal"
              :page="filmographyPage"
              :page-size="12"
              grid-class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
              :item-key="(item) => `${item.media_type}-${item.id}`"
              @update:page="setFilmographyPageWithData"
            >
              <template #default="{ item }">
                <div
                  class="theme-input border theme-border-subtle theme-border rounded-2xl p-4 shadow-sm transition-colors theme-hover-border block group"
                >
                  <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4 h-full">
                    <a
                      data-actor-nav
                      :href="
                        actorLocalePath(
                          `/${item.media_type === 'tv' ? 'show' : 'movie'}/${item.id}`,
                        )
                      "
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <img
                          v-if="item.poster_path"
                          :src="getActorImageSrc(resolveImageUrl(item.poster_path))"
                          :alt="item.title || item.name || ''"
                          class="w-full h-full object-cover transition-transform duration-300"
                          loading="lazy"
                          decoding="async"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                            class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"
                          >
                            <path d="M4 11h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
                            <path d="m4 11 2-7" />
                            <path d="m10 11 2-7" />
                            <path d="m16 11 2-7" />
                            <path d="M2 15h20" />
                          </svg>
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                        >
                          {{
                            item.release_date
                              ? new Date(item.release_date).getFullYear()
                              : item.first_air_date
                                ? new Date(item.first_air_date).getFullYear()
                                : "N/A"
                          }}
                        </span>
                        <span
                          class="font-bold text-sm theme-text leading-tight line-clamp-2"
                          :title="item.title || item.name"
                        >
                          {{ item.title || item.name }}
                        </span>
                      </div>
                    </a>

                    <a
                      v-if="item.voice_actors?.[0]"
                      data-actor-nav
                      :href="actorLocalePath(`/voice-actor/${item.voice_actors[0].id}`)"
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0 hover:opacity-80 transition-opacity cursor-pointer"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <img
                          v-if="item.voice_actors[0].profile_picture"
                          :src="getActorImageSrc(item.voice_actors[0].profile_picture)"
                          :alt="`${item.voice_actors[0].firstname} ${item.voice_actors[0].lastname}`"
                          class="w-full h-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                        <div
                          v-else
                          class="w-full h-full flex items-center justify-center theme-text-muted text-xs font-bold theme-surface-raised theme-input"
                        >
                          {{ item.voice_actors[0].firstname[0]
                          }}{{ item.voice_actors[0].lastname[0] }}
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                          >{{ $t("details.voicedBy") }}</span
                        >
                        <span
                          class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2"
                        >
                          {{ item.voice_actors[0].firstname }}
                          {{ item.voice_actors[0].lastname }}
                        </span>
                      </div>
                    </a>
                    <div
                      v-else
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 flex-shrink-0"
                      >
                        <div
                          class="w-full h-full flex items-center justify-center theme-text-muted text-xs font-bold theme-surface-raised theme-input"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                            class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"
                          >
                            <circle cx="12" cy="8" r="5" />
                            <path d="M20 21a8 8 0 0 0-16 0" />
                          </svg>
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                          >{{ $t("details.voicedBy") }}</span
                        >
                        <span class="font-medium text-sm theme-text-muted italic">
                          {{ $t("details.unknownCharacter") }}
                        </span>
                      </div>
                    </div>

                    <div
                      class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start border-t theme-border-subtle theme-border sm:border-t-0 pt-3 sm:pt-0"
                    >
                      <div
                        class="w-16 sm:w-full aspect-[2/3] rounded-xl overflow-hidden theme-surface-raised theme-surface-muted sm:mb-3 relative flex-shrink-0"
                      >
                        <div
                          class="w-full h-full flex items-center justify-center theme-text-muted"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                            class="w-6 h-6 sm:w-8 sm:h-8 opacity-20"
                          >
                            <circle cx="12" cy="8" r="5" />
                            <path d="M20 21a8 8 0 0 0-16 0" />
                          </svg>
                        </div>
                      </div>
                      <div class="flex flex-col min-w-0 flex-1">
                        <span
                          class="text-[10px] theme-text-muted font-semibold uppercase tracking-wider mb-0.5"
                          >{{ $t("details.as") }}</span
                        >
                        <span
                          class="font-medium text-sm theme-text-secondary leading-tight line-clamp-2"
                        >
                          {{ item.character || $t("details.unknownCharacter") }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </PaginatedResponsiveGrid>
          </div>
        </section>
      </template>
    </PersonDetailsLayout>

    <ReportModal
      v-if="hasOpenedReportModal"
      v-model:open="isReportModalOpen"
      :target-url="currentUrl"
    />
  </div>
</template>

<script setup lang="ts">
import PersonDetailsLayout from "../../components/layout/PersonDetailsLayout.vue";
import { ref, watch, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { refDebounced } from "@vueuse/core";
import { useActorData, fetchActorData } from "@app/shared-logic";
import ReportModal from "../../components/ReportModal.vue";
import { prepareActorSsrData } from "../../utils/actor-ssr-data";

const isReportModalOpen = ref(false);
const hasOpenedReportModal = ref(false);

function openReportModal(): void {
  hasOpenedReportModal.value = true;
  isReportModalOpen.value = true;
}

const route = useRoute();
const router = useRouter();
const { locale, t } = useI18n();
const actorLocalePath = useLocalePathPrefix();
const imageProcessor = useImage();
const imageModifiers = {
  format: "webp",
  quality: imageProcessor.options.quality,
};

function getActorImageSrc(src: string | null | undefined): string {
  return imageProcessor(src ?? "", imageModifiers, {
    provider: undefined,
    preset: undefined,
  });
}

const id = String(route.params.id);
const siteUrl = useSiteConfig().url;
const pageUrl = computed(() => new URL(actorLocalePath(`/actor/${id}`), siteUrl).href);
const currentUrl = computed(() => new URL(route.fullPath, siteUrl).href);
const { page: voicesPage, setPage: setVoicesPage } = useUrlPagination("voicesPage");
const { page: filmographyPage, setPage: setFilmographyPageUrl } =
  useUrlPagination("filmographyPage");

const { data: initialData, error } = await useAsyncData(
  `actor-${id}`,
  () =>
    fetchActorData(id, {
      projection: "actor-page",
      filmographyPage: filmographyPage.value,
    }),
  {
    getCachedData: (key, nuxtApp) => getHydrationCachedData(key, nuxtApp),
  },
);
if (import.meta.server && error.value) throw error.value;

if (import.meta.server) prepareActorSsrData(initialData.value);

const {
  actor,
  loading,
  filmographyCount,
  filmographyComplete,
  searchQuery,
  availableLanguages,
  selectedLanguage,
  filteredUniqueVoiceActorsByLanguage,
  filteredCredits,
  enhancedFilmography,
  loadActorData,
} = useActorData(initialData, {
  filmographyPagination: computed(() => ({
    page: filmographyPage.value,
    pageSize: 12,
  })),
});

const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);
watch(debouncedSearch, async (val) => {
  if (val.trim() && !filmographyComplete.value) {
    const loaded = await loadActorData(id);
    if (!loaded) return;
  }
  if (debouncedSearch.value !== val) return;
  searchQuery.value = val;
});
watch([searchQuery, selectedLanguage], () => {
  void setVoicesPage(1);
  void setFilmographyPageUrl(1);
});
watch(filmographyPage, () => {
  if (!filmographyComplete.value) void loadActorData(id);
});

async function setFilmographyPageWithData(page: number): Promise<void> {
  if (!filmographyComplete.value && !(await loadActorData(id))) return;
  await setFilmographyPageUrl(page);
}

const voiceActorItems = filteredUniqueVoiceActorsByLanguage;
const voiceActorsTotal = computed(() => voiceActorItems.value.length);
const filmographyItems = enhancedFilmography;
const filmographyTotal = computed(() =>
  filmographyComplete.value ? filteredCredits.value.length : filmographyCount.value,
);

function navigateActorCard(event: MouseEvent): void {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest<HTMLAnchorElement>("a[data-actor-nav]");
  if (!anchor || anchor.target || anchor.hasAttribute("download")) return;

  const destination = new URL(anchor.href);
  if (destination.origin !== window.location.origin) return;

  event.preventDefault();
  void router.push(`${destination.pathname}${destination.search}${destination.hash}`);
}

useHead({
  titleTemplate: null,
  title: computed(() => (actor.value?.name ? actor.value.name : t("search.actor", "Acteur"))),
  meta: [
    {
      name: "description",
      content: computed(() => {
        const name = actor.value?.name || "";
        const desc =
          actor.value?.biography ||
          (name
            ? t("seo.actorDescription", { name })
            : t("seo.actorDescriptionFallback", "Discover filmography and voice actors."));
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "keywords",
      content: computed(() => {
        if (!actor.value?.name) return t("home.meta.keywords");
        return t("seo.actorKeywords", { name: actor.value.name });
      }),
    },
    {
      property: "og:title",
      content: computed(() => (actor.value?.name ? actor.value.name : t("search.actor", "Acteur"))),
    },
    {
      property: "og:description",
      content: computed(() => {
        const name = actor.value?.name || "";
        const desc =
          actor.value?.biography ||
          (name
            ? t("seo.actorDescription", { name })
            : t("seo.actorDescriptionFallback", "Discover filmography and voice actors."));
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      property: "og:type",
      content: "profile",
    },
    {
      property: "og:image",
      content: computed(() =>
        actor.value?.profile_path
          ? resolveImageUrl(actor.value.profile_path)
          : new URL("/default-og.jpg", siteUrl).href,
      ),
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
    {
      name: "twitter:title",
      content: computed(() => (actor.value?.name ? actor.value.name : t("search.actor", "Acteur"))),
    },
    {
      name: "twitter:description",
      content: computed(() => {
        const name = actor.value?.name || "";
        const desc =
          actor.value?.biography ||
          (name
            ? t("seo.actorDescription", { name })
            : t("seo.actorDescriptionFallback", "Discover filmography and voice actors."));
        return desc.length > 160 ? desc.substring(0, 157) + "..." : desc;
      }),
    },
    {
      name: "twitter:image",
      content: computed(() =>
        actor.value?.profile_path
          ? resolveImageUrl(actor.value.profile_path)
          : new URL("/default-og.jpg", siteUrl).href,
      ),
    },
  ],
  link: [
    { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://image.tmdb.org" },
  ],
  script: [
    {
      type: "application/ld+json",
      innerHTML: computed(() => {
        const name = actor.value?.name || "";
        const json = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Person",
          url: pageUrl.value,
          name: name || t("search.actor", "Acteur"),
          image: actor.value?.profile_path ? resolveImageUrl(actor.value.profile_path) : "",
          description:
            actor.value?.biography ||
            (name
              ? t("seo.actorDescription", { name })
              : t("seo.actorDescriptionFallback", "Discover filmography and voice actors.")),
        });
        // HTML-escape the serialized JSON to prevent script-breaking sequences
        return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
      }),
    },
  ],
});

function resolveImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
}

const languageDisplayNames = computed(() => {
  try {
    return new Intl.DisplayNames([locale.value || "en"], { type: "language" });
  } catch {
    return undefined;
  }
});

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return "Unknown";
  try {
    const name = languageDisplayNames.value?.of(langCode);
    return typeof name === "string" && name.length > 0
      ? name.charAt(0).toUpperCase() + name.slice(1)
      : langCode;
  } catch {
    return langCode;
  }
};
</script>
