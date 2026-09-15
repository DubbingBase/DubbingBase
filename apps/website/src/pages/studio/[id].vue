<template>
  <DetailsPage v-if="studio">
    <DetailsHero
      :title="studio.name"
      :backdrop-url="null"
      :image-url="studio.logo_url"
      image-aspect-ratio="logo"
    >
      <template #metadata v-if="studio.city || studio.country">
        <span
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4 opacity-75"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          {{ [studio.city, studio.country].filter(Boolean).join(", ") }}
        </span>
      </template>
    </DetailsHero>

    <DetailsActionBar>
      <template #left v-if="studio.website_url">
        <a
          :href="studio.website_url"
          target="_blank"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border theme-border-subtle theme-border theme-surface theme-text-secondary theme-hover-surface-muted flex items-center gap-2"
          >{{ $t("studio.visitWebsite")
          }}<ExternalLinkIcon class="w-4 h-4 opacity-70" />
        </a>
      </template>
      <template #right v-if="isAdmin">
        <NuxtLink
          :to="localePath(`/studio/${studio.id}/edit`)"
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
          <span class="hidden sm:inline">{{ $t("studioEdit.titleEdit") }}</span>
        </NuxtLink>
      </template>
    </DetailsActionBar>

    <div class="w-full p-4 md:p-8 max-w-6xl mx-auto">
      <!-- Overview -->
      <div class="mb-12 max-w-4xl" v-if="studio.description">
        <section>
          <h2 class="text-2xl font-bold mb-4">{{ $t("studio.about") }}</h2>
          <p class="theme-text-secondary leading-relaxed text-lg">
            {{ studio.description }}
          </p>
        </section>
      </div>

      <!-- Dubbed Projects -->
      <section class="mb-12" v-if="dubbedProjects.length > 0">
        <div
          class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6"
        >
          <div>
            <h2 class="text-2xl font-bold">
              {{
                $t("studio.dubbingProjectsCount", {
                  count: dubbedProjects.length,
                })
              }}
            </h2>
            <div class="theme-text-muted text-sm mt-1">
              {{
                $t("studio.shownCount", {
                  shown: filteredProjects.length,
                  total: filteredProjects.length,
                })
              }}
            </div>
          </div>
          <div class="relative w-full sm:w-64" v-if="dubbedProjects.length > 8">
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
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6"
        >
          <NuxtLink
            v-for="project in filteredProjects"
            :key="project.id"
            :to="
              localePath(getMediaLink(project.content_type, project.content_id))
            "
            class="group transition-transform hover:-translate-y-1 block flex flex-col"
          >
            <div
              class="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-3 theme-surface-muted shadow-sm border theme-border-subtle theme-border theme-hover-primary-border transition-colors"
            >
              <NuxtImg
                v-if="project.media?.poster_path"
                :src="
                  project.media.poster_path.startsWith('http')
                    ? project.media.poster_path
                    : 'https://image.tmdb.org/t/p/w342' +
                      project.media.poster_path
                "
                :alt="project.media?.title || project.media?.name"
                format="webp"
                loading="lazy"
                decoding="async"
                class="object-cover w-full h-full transition duration-300"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center theme-text-muted"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-12 h-12 opacity-50"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect
                    x="2"
                    y="2"
                    width="20"
                    height="20"
                    rx="2.18"
                    ry="2.18"
                  ></rect>
                  <line x1="7" y1="2" x2="7" y2="22"></line>
                  <line x1="17" y1="2" x2="17" y2="22"></line>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                  <line x1="2" y1="7" x2="7" y2="7"></line>
                  <line x1="2" y1="17" x2="7" y2="17"></line>
                  <line x1="17" y1="17" x2="22" y2="17"></line>
                  <line x1="17" y1="7" x2="22" y2="7"></line>
                </svg>
              </div>

              <!-- Language badge -->
              <div
                class="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded-md text-xs font-semibold text-white"
              >
                <span v-if="project.language === 'fr-FR'">{{
                  $t("studio.french")
                }}</span>
                <span v-else-if="project.language === 'fr-CA'">{{
                  $t("studio.quebec")
                }}</span>
                <span v-else-if="project.language === 'fr-BE'">{{
                  $t("studio.belgian")
                }}</span>
                <span v-else>{{ project.language }}</span>
              </div>
            </div>

            <h3
              class="font-semibold text-sm md:text-base theme-text line-clamp-2"
            >
              {{
                project.media?.title ||
                project.media?.name ||
                `Media #${project.content_id}`
              }}
            </h3>
            <div
              class="text-xs theme-text-muted mt-1 uppercase font-bold tracking-wider"
            >
              {{ getMediaTypeLabel(project.content_type) }}
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- Voice Actors Roster -->
      <section v-if="voiceActorsRoster.length > 0">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-2xl font-bold">
              {{
                $t("studio.voiceActorsCount", {
                  count: voiceActorsRoster.length,
                })
              }}
            </h2>
            <div
              class="theme-text-muted text-sm mt-1"
              v-if="voiceActorsRoster.length > 20"
            >
              {{
                $t("studio.shownCount", {
                  shown: voiceActorsRoster.length,
                  total: voiceActorsRoster.length,
                })
              }}
            </div>
          </div>
        </div>
        <div
          class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        >
          <NuxtLink
            v-for="va in voiceActorsRoster"
            :key="va.id"
            :to="localePath(`/voice-actor/${va.id}`)"
            class="group"
          >
            <div
              class="theme-surface border theme-border-subtle theme-border rounded-xl overflow-hidden theme-hover-primary-border transition-colors flex flex-col items-center p-4 text-center"
            >
              <div
                class="w-20 h-20 rounded-full overflow-hidden mb-3 theme-surface-muted shrink-0 border-2 border-transparent theme-hover-primary-border transition-colors"
              >
                <img
                  v-if="va.profile_picture"
                  :src="getProfileUrl(va.profile_picture)"
                  loading="lazy"
                  decoding="async"
                  class="w-full h-full object-cover"
                  :alt="`${va.firstname} ${va.lastname}`"
                />
                <div
                  v-else
                  class="w-full h-full flex items-center justify-center font-bold text-xl theme-text-muted"
                >
                  {{ va.firstname?.charAt(0) || ""
                  }}{{ va.lastname?.charAt(0) || "" }}
                </div>
              </div>
              <h3
                class="font-semibold theme-text line-clamp-1 theme-hover-primary-text transition-colors"
              >
                {{ va.firstname }} {{ va.lastname }}
              </h3>
            </div>
          </NuxtLink>
        </div>
      </section>
    </div>
  </DetailsPage>

  <PersonSkeleton v-else-if="loading" />

  <div
    v-else-if="error"
    class="container mx-auto p-8 text-center theme-status-danger-text"
  >
    {{ error }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useStudioData, fetchStudioDetails } from "@app/shared-logic";
import { ExternalLinkIcon, SearchIcon } from "lucide-vue-next";
import { refDebounced } from "@vueuse/core";
import DetailsPage from "../../components/layout/details/DetailsPage.vue";
import DetailsHero from "../../components/layout/details/DetailsHero.vue";
import DetailsActionBar from "../../components/layout/details/DetailsActionBar.vue";
import PersonSkeleton from "../../components/PersonSkeleton.vue";

import { useI18n } from "vue-i18n";

const route = useRoute();
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const localePath = useLocalePath();
const { t } = useI18n();

function getMediaLink(contentType?: string, mediaId?: number | string) {
  if (contentType === "tv") return `/show/${mediaId}`;
  if (contentType === "video_game") return `/game/${mediaId}`;
  if (contentType === "audiobook") return `/audiobook/${mediaId}`;
  if (contentType === "podcast") return `/podcast/${mediaId}`;
  if (contentType === "advertisement") return `/advertisement/${mediaId}`;
  if (contentType === "toy") return `/toy/${mediaId}`;
  return `/movie/${mediaId}`;
}

function getMediaTypeLabel(contentType?: string) {
  if (contentType === "movie") return t("search.movie") || "Film";
  if (contentType === "tv") return t("search.tv") || "Série";
  if (contentType === "video_game") return t("search.videoGame") || "Jeu vidéo";
  if (contentType === "audiobook")
    return t("search.audiobook") || "Livre audio";
  if (contentType === "podcast") return t("search.podcast") || "Podcast";
  if (contentType === "advertisement")
    return t("search.advertisement") || "Publicité";
  if (contentType === "toy") return t("search.toy") || "Jouet / Objet";
  return contentType || "Média";
}

const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const { data: initialStudioDetails } = await useAsyncData(
  `studio-${route.params.id}`,
  () => fetchStudioDetails(route.params.id as string),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const { studio, dubbedProjects, voiceActorsRoster, loading, error } =
  useStudioData([], initialStudioDetails.value);

const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);

const filteredProjects = computed(() => {
  if (!debouncedSearch.value.trim()) return dubbedProjects.value;
  const query = debouncedSearch.value.toLowerCase().trim();
  return dubbedProjects.value.filter((p: any) => {
    const title = (p.media?.title || p.media?.name || "").toLowerCase();
    return title.includes(query);
  });
});

const getProfileUrl = (path: string) => {
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage
    .from("voice_actor_profile_pictures")
    .getPublicUrl(path);
  return data.publicUrl;
};

useHead({
  title: computed(() =>
    studio.value
      ? `${studio.value.name} - DubbingBase`
      : "Studio - DubbingBase",
  ),
  link: [
    { rel: "preconnect", href: "https://image.tmdb.org", crossorigin: "" },
    { rel: "dns-prefetch", href: "https://image.tmdb.org" },
  ],
});
</script>
