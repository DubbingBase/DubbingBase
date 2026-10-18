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
          @click="isReportModalOpen = true"
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

          <PaginatedResponsiveGrid
            v-if="voiceActorsTotal > 0"
            :items="actorGridPlaceholder"
            :total-items="voiceActorsTotal"
            :page="voicesPage"
            :page-size="12"
            grid-class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
            @update:page="setVoicesPage"
          >
            <template #default>
              <div class="contents" v-html="voiceActorCardsHtml" @click="navigateActorCard" />
            </template>
          </PaginatedResponsiveGrid>
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

          <PaginatedResponsiveGrid
            v-else
            :items="actorGridPlaceholder"
            :total-items="filmographyTotal"
            :page="filmographyPage"
            :page-size="12"
            grid-class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
            @update:page="setFilmographyPageWithData"
          >
            <template #default>
              <div class="contents" v-html="filmographyCardsHtml" @click="navigateActorCard" />
            </template>
          </PaginatedResponsiveGrid>
        </section>
      </template>
    </PersonDetailsLayout>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
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
import {
  renderActorFilmographyCardHtml,
  renderActorVoiceActorCardHtml,
  type ActorImageAttributes,
} from "../../utils/actor-grid-html";

const isReportModalOpen = ref(false);

const route = useRoute();
const router = useRouter();
const { locale, t } = useI18n();
const localePath = useLocalePath();
const imageProcessor = useImage();
const imageModifiers = {
  format: "webp",
  quality: imageProcessor.options.quality,
};

// Keep NuxtImg's responsive attributes without creating a component per card.
function getActorImageAttrs(
  src: string | null | undefined,
  alt: string | undefined,
  imageClass: string,
): ActorImageAttributes {
  const source = src ?? "";
  const sizes = imageProcessor.getSizes(source, {
    provider: undefined,
    preset: undefined,
    modifiers: imageModifiers,
  });

  return {
    "data-nuxt-img": "",
    sizes: sizes.sizes,
    srcset: sizes.srcset,
    onerror: "this.setAttribute('data-error', 1)",
    alt,
    class: imageClass,
    decoding: "async",
    loading: "lazy",
    src: imageProcessor(source, imageModifiers, {
      provider: undefined,
      preset: undefined,
    }),
  };
}

const id = String(route.params.id);
const currentUrl = computed(() => `https://dubbingbase.com${route.fullPath}`);
const { page: voicesPage, setPage: setVoicesPage } = useUrlPagination("voicesPage");
const { page: filmographyPage, setPage: setFilmographyPageUrl } =
  useUrlPagination("filmographyPage");

const { data: initialData } = await useAsyncData(
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
const actorGridPlaceholder = [0];
const voiceActorCardsHtml = computed(() => {
  const start = (voicesPage.value - 1) * 12;

  return voiceActorItems.value
    .slice(start, start + 12)
    .map((voiceActor) =>
      renderActorVoiceActorCardHtml(
        voiceActor,
        localePath(`/voice-actor/${voiceActor.id}`),
        t("actor.roles"),
        getActorImageAttrs,
      ),
    )
    .join("");
});
const actorFilmographyCopy = computed(() => ({
  voicedBy: t("details.voicedBy"),
  as: t("details.as"),
  unknownCharacter: t("details.unknownCharacter"),
}));
const filmographyCardsHtml = computed(() =>
  filmographyItems.value
    .map((item) => {
      const voiceActor = item.voice_actors?.[0];
      const mediaType = item.media_type === "tv" ? "show" : "movie";

      return renderActorFilmographyCardHtml(
        item,
        localePath(`/${mediaType}/${item.id}`),
        voiceActor ? localePath(`/voice-actor/${voiceActor.id}`) : undefined,
        actorFilmographyCopy.value,
        getActorImageAttrs,
        resolveImageUrl,
      );
    })
    .join(""),
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
      property: "og:url",
      content: computed(() => `https://dubbingbase.com/actor/${id}`),
    },
    {
      property: "og:image",
      content: computed(() =>
        actor.value?.profile_path
          ? resolveImageUrl(actor.value.profile_path)
          : "https://dubbingbase.com/default-og.jpg",
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
          : "https://dubbingbase.com/default-og.jpg",
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
          url: `https://dubbingbase.com/actor/${id}`,
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
</script>
