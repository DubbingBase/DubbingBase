<template>
  <div class="min-h-screen">
    <!-- Skeleton loader during SSR/fetch -->
    <MediaSkeleton v-if="pending && !data" />

    <!-- Main Content -->
    <MediaDetailsLayout
      v-else-if="podcast"
      :backdrop-src="null"
      :poster-src="coverUrl"
      :title="podcast.title"
      :original-title="podcast.author"
      :media-type="'podcast'"
      :release-year="podcast.release_date ? podcast.release_date.substring(0, 4) : undefined"
      :overview="podcast.description"
      :dubbing-projects="dubbingProjects"
      :active-dub-id="activeDubId"
      :total-episodes="podcast.episodes_count"
    >
      <template #header-actions>
        <div class="flex items-center gap-2">
          <button
            v-if="podcast.feed_url"
            @click="openExternalUrl(podcast.feed_url)"
            class="px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-xs font-semibold text-gray-200 rounded-xl border border-gray-700 flex items-center gap-1.5 transition-colors"
          >
            <RadioIcon class="w-3.5 h-3.5 text-pink-400" />
            <span>Flux RSS / Podcast</span>
            <ExternalLinkIcon class="w-3 h-3 opacity-60" />
          </button>

          <NuxtLink
            v-if="isAdmin"
            :to="
              localePath(
                activeDubProject
                  ? `/podcast/${podcast.id}/edit/${activeDubProject.id}`
                  : `/podcast/${podcast.id}/edit/new`,
              )
            "
            class="px-3 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 text-xs font-semibold rounded-xl border border-pink-500/30 flex items-center gap-1.5 transition-colors"
          >
            <span>{{
              activeDubProject ? "Modifier le projet" : "Ajouter un projet"
            }}</span>
          </NuxtLink>
        </div>
      </template>

      <template #details-extra>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-800/60">
          <div v-if="podcast.author">
            <span class="text-xs text-gray-400 block mb-0.5">Auteur / Créateur</span>
            <span class="text-sm font-semibold text-gray-200">{{ podcast.author }}</span>
          </div>

          <div v-if="podcast.genres && podcast.genres.length > 0">
            <span class="text-xs text-gray-400 block mb-0.5">Genres</span>
            <span class="text-sm font-semibold text-gray-200">{{ podcast.genres.join(", ") }}</span>
          </div>

          <div v-if="podcast.episodes_count">
            <span class="text-xs text-gray-400 block mb-0.5">Nombre d'épisodes</span>
            <span class="text-sm font-semibold text-gray-200">{{ podcast.episodes_count }}</span>
          </div>
        </div>
      </template>

      <!-- Technical Crew / Studio Section -->
      <template #crew-section>
        <div
          v-if="activeDubProject?.studios || activeDubProject?.dubbing_project_crew?.length"
          class="bg-gray-900/60 backdrop-blur border border-gray-800 rounded-2xl p-6 space-y-4 mb-8 shadow-xl"
        >
          <h3 class="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Équipe de Production & Studio
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div v-if="activeDubProject?.studios" class="space-y-1">
              <span class="text-xs text-gray-400">Studio d'enregistrement</span>
              <NuxtLink
                :to="localePath(`/studio/${activeDubProject.studios.id}`)"
                class="text-sm font-semibold text-pink-400 hover:underline block"
              >
                {{ activeDubProject.studios.name }}
              </NuxtLink>
            </div>

            <div
              v-for="member in activeDubProject?.dubbing_project_crew || []"
              :key="member.id"
              class="space-y-1"
            >
              <span class="text-xs text-gray-400">{{ member.jobs?.name || "Équipe" }}</span>
              <NuxtLink
                v-if="member.voice_actors"
                :to="localePath(`/voice-actor/${member.voice_actors.id}`)"
                class="text-sm font-semibold text-white hover:underline block"
              >
                {{ member.voice_actors.firstname }} {{ member.voice_actors.lastname }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </template>

      <!-- Cast Roster with Progressive DOM windowing -->
      <template #cast-section>
        <section class="space-y-6">
          <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 class="text-xl font-bold text-white flex items-center gap-2">
                <span>Distribution & Voix</span>
                <span
                  v-if="formattedCast.length > 0"
                  class="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-400 font-semibold border border-pink-500/20"
                >
                  {{ formattedCast.length }}
                </span>
              </h2>
              <p class="text-xs text-gray-400 mt-1">
                Comédiens et voix ayant participé à cette fiction audio / podcast.
              </p>
            </div>

            <!-- Cast search filter -->
            <div v-if="formattedCast.length > 8" class="relative w-full sm:w-64">
              <SearchIcon class="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                v-model="castSearchQuery"
                type="text"
                placeholder="Filtrer le casting..."
                class="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
              />
            </div>
          </div>

          <div
            v-if="visibleCast.length === 0"
            class="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800/40 text-gray-500 text-sm"
          >
            {{
              formattedCast.length === 0
                ? "Aucune information de casting enregistrée pour le moment."
                : "Aucun comédien ne correspond à votre recherche."
            }}
          </div>

          <div
            v-else
            class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            <div
              v-for="item in visibleCast"
              :key="item.work_id"
              class="bg-gray-900/80 border border-gray-800/80 rounded-2xl p-4 flex gap-4 items-center hover:border-gray-700 transition-colors group shadow-md"
            >
              <NuxtLink
                :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                class="relative w-14 h-14 rounded-full overflow-hidden bg-gray-800 shrink-0 border border-gray-700 group-hover:border-pink-500 transition-colors flex items-center justify-center"
              >
                <NuxtImg
                  v-if="item.profile_picture"
                  :src="item.profile_picture"
                  :alt="item.firstname + ' ' + item.lastname"
                  class="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <span v-else class="text-sm font-bold text-gray-400">
                  {{ item.firstname?.[0] }}{{ item.lastname?.[0] }}
                </span>
              </NuxtLink>

              <div class="flex-1 min-w-0">
                <NuxtLink
                  :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                  class="text-sm font-bold text-white hover:text-pink-400 transition-colors truncate block"
                >
                  {{ item.firstname }} {{ item.lastname }}
                </NuxtLink>
                <span class="text-xs text-gray-400 block truncate mt-0.5">
                  {{ item.character_name || item.performance || "Voix / Rôle" }}
                </span>
              </div>
            </div>
          </div>

          <!-- Bottom Sentinel for Progressive Loading -->
          <div
            v-if="hasMoreCast"
            ref="castSentinel"
            class="h-10 flex items-center justify-center text-xs text-gray-500"
          >
            Chargement de comédiens supplémentaires...
          </div>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="text-center py-24 text-gray-500">
      Podcast / Fiction audio introuvable.
    </div>

    <ReportModal v-model:open="isReportModalOpen" :target-url="currentUrl" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, useTemplateRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useIntersectionObserver, refDebounced } from "@vueuse/core";
import MediaSkeleton from "../../components/MediaSkeleton.vue";
import MediaDetailsLayout from "../../components/layout/MediaDetailsLayout.vue";
import ReportModal from "../../components/ReportModal.vue";
import { fetchPodcastData } from "@app/shared-logic";
import type { Podcast, PodcastResponse } from "@app/shared-logic";
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
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const podcastId = computed(() => {
  const idParam = route.params.id;
  const num = parseInt(idParam as string, 10);
  return isNaN(num) ? 0 : num;
});

const isReportModalOpen = ref(false);
const currentUrl = computed(() => route.fullPath);

// Instant Hydration Data Fetching
const { data, pending } = await useAsyncData(
  `podcast-${podcastId.value}-${locale.value}`,
  () => fetchPodcastData(podcastId.value, locale.value),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const podcast = computed<Podcast | null>(() => data.value?.podcast || null);
const dubbingProjects = computed(() => data.value?.dubbingProjects || []);

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
  return podcast.value?.cover_url || null;
});

function resolveProfilePicture(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://supabase.dubbingbase.com/storage/v1/object/public/voice-actors/${path}`;
}

interface FormattedCastItem {
  work_id: number;
  voice_actor_id: number;
  firstname: string;
  lastname: string;
  character_name?: string;
  performance?: string;
  profile_picture?: string | null;
}

const formattedCast = computed<FormattedCastItem[]>(() => {
  if (!activeDubProject.value || !activeDubProject.value.work) return [];
  return (activeDubProject.value.work || []).map((w: any) => ({
    work_id: w.id,
    voice_actor_id: w.voice_actors?.id || w.voice_actor_id,
    firstname: w.voice_actors?.firstname || "",
    lastname: w.voice_actors?.lastname || "",
    character_name: w.character_name || "",
    performance: w.performance || "",
    profile_picture: resolveProfilePicture(w.voice_actors?.profile_picture),
  }));
});

// Client-side Progressive Batch Windowing & Debounced Filtering
const castSearchQuery = ref("");
const debouncedCastSearch = refDebounced(castSearchQuery, 150);

const filteredCast = computed(() => {
  const query = debouncedCastSearch.value.trim().toLowerCase();
  if (!query) return formattedCast.value;
  return formattedCast.value.filter(
    (c) =>
      `${c.firstname} ${c.lastname}`.toLowerCase().includes(query) ||
      (c.character_name && c.character_name.toLowerCase().includes(query)),
  );
});

function openExternalUrl(url?: string) {
  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank");
  }
}

const batchSize = ref(24);
const visibleCast = computed(() =>
  filteredCast.value.slice(0, batchSize.value),
);
const hasMoreCast = computed(
  () => visibleCast.value.length < filteredCast.value.length,
);

const castSentinel = useTemplateRef<HTMLElement>("castSentinel");
useIntersectionObserver(
  castSentinel,
  (entries) => {
    const entry = entries?.[0];
    if (entry?.isIntersecting && hasMoreCast.value) {
      batchSize.value += 24;
    }
  },
  { rootMargin: "200px" },
);

useHead({
  title: computed(() =>
    podcast.value
      ? `${podcast.value.title} - Casting & Voix | DubbingBase`
      : "Fiction Audio / Podcast | DubbingBase",
  ),
  meta: [
    {
      name: "description",
      content: computed(
        () =>
          podcast.value?.description?.substring(0, 160) ||
          "Retrouvez toutes les voix et informations de doublage sur DubbingBase.",
      ),
    },
  ],
});
</script>
