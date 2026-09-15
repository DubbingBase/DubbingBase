<template>
  <div class="min-h-screen">
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
        <span
          v-if="podcast.release_date"
          class="theme-text font-semibold text-base md:text-lg theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ podcast.release_date.substring(0, 4) }}
        </span>
        <span
          v-if="podcast.author"
          class="theme-text font-medium text-sm md:text-base theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ podcast.author }}
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
        <div class="flex items-center gap-2">
          <button
            v-if="podcast.feed_url"
            @click="openExternalUrl(podcast.feed_url)"
            class="px-3 py-1.5 theme-surface-muted theme-hover-surface-muted text-xs font-semibold theme-text rounded-xl border theme-border flex items-center gap-1.5 transition-colors"
          >
            <RadioIcon class="w-3.5 h-3.5 theme-primary-text" />
            <span>{{ $t("podcast.rssFeed") }}</span>
            <ExternalLinkIcon class="w-3 h-3 opacity-60" />
          </button>

          <ForceEnqueueButton
            v-if="podcast?.id"
            media-type="podcast"
            :media-id="podcast.id"
          />

          <NuxtLink
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
            class="px-3 py-1.5 bg-pink-600/20 hover:bg-pink-600/30 theme-primary-text text-xs font-semibold rounded-xl border border-pink-500/30 flex items-center gap-1.5 transition-colors"
          >
            <span>{{
              activeDubId ? $t("common.edit") : $t("common.create")
            }}</span>
          </NuxtLink>
        </div>
      </template>

      <template #content>
        <!-- Synopsis / Description -->
        <section v-if="podcast.description" class="mb-10">
          <h2 class="text-2xl font-bold mb-4 theme-text">
            {{ $t("details.synopsis", "Synopsis") }}
          </h2>
          <p class="theme-text-secondary leading-relaxed text-base md:text-lg">
            {{ podcast.description }}
          </p>
        </section>

        <!-- Technical Crew / Studio Section -->
        <div
          v-if="
            activeDubProject?.studios ||
            activeDubProject?.dubbing_project_crew?.length
          "
          class="theme-surface-raised theme-surface-overlay backdrop-blur border theme-border-subtle theme-border rounded-2xl p-6 space-y-4 mb-8 shadow-xl"
        >
          <h3
            class="text-xs font-bold theme-text-muted uppercase tracking-wider"
          >
            {{ $t("podcast.productionTeam") }}
          </h3>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div v-if="activeDubProject?.studios" class="space-y-1">
              <span class="text-xs theme-text-muted">{{
                $t("studio.recordingStudio")
              }}</span>
              <NuxtLink
                :to="localePath(`/studio/${activeDubProject.studios.id}`)"
                class="text-sm font-semibold theme-primary-text hover:underline block"
              >
                {{ activeDubProject.studios.name }}
              </NuxtLink>
            </div>

            <div
              v-for="member in activeDubProject?.dubbing_project_crew || []"
              :key="member.id"
              class="space-y-1"
            >
              <span class="text-xs theme-text-muted">{{
                member.jobs?.name || "Équipe"
              }}</span>
              <NuxtLink
                v-if="member.voice_actors"
                :to="localePath(`/voice-actor/${member.voice_actors.id}`)"
                class="text-sm font-semibold theme-text hover:underline block"
              >
                {{ member.voice_actors.firstname }}
                {{ member.voice_actors.lastname }}
              </NuxtLink>
            </div>
          </div>
        </div>

        <!-- Cast Roster with Progressive DOM windowing -->
        <section class="space-y-6">
          <div
            class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
          >
            <div>
              <h2 class="text-xl font-bold theme-text flex items-center gap-2">
                <span>{{ $t("podcast.castSection") }}</span>
                <span
                  v-if="formattedCast.length > 0"
                  class="text-xs px-2.5 py-0.5 rounded-full bg-pink-500/10 theme-primary-text font-semibold border border-pink-500/20"
                >
                  {{ formattedCast.length }}
                </span>
              </h2>
              <p class="text-xs theme-text-muted mt-1">
                {{ $t("podcast.voiceCastDescription") }}
              </p>
            </div>

            <!-- Cast search filter -->
            <div
              v-if="formattedCast.length > 8"
              class="relative w-full sm:w-64"
            >
              <SearchIcon
                class="w-4 h-4 theme-text-muted absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                v-model="castSearchQuery"
                type="text"
                placeholder="Filtrer le casting..."
                class="w-full theme-surface-raised theme-surface-overlay border theme-border-subtle theme-border rounded-xl pl-9 pr-4 py-2 text-xs theme-text theme-placeholder focus:outline-none theme-focus transition-all"
              />
            </div>
          </div>

          <div
            v-if="filteredCast.length === 0"
            class="text-center py-16 theme-surface-raised theme-surface-overlay rounded-2xl border theme-border-subtle theme-border theme-text-muted text-sm"
          >
            {{
              formattedCast.length === 0
                ? "Aucune information de casting enregistrée pour le moment."
                : "Aucun comédien ne correspond à votre recherche."
            }}
          </div>

          <PaginatedResponsiveGrid
            v-else
            :items="filteredCast"
            :page="castPage"
            :page-size="12"
            grid-class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            :item-key="(item) => item.work_id"
            @update:page="setCastPage"
          >
            <template #default="{ item }">
              <div
                :key="item.work_id"
                class="theme-surface-overlay border theme-border-subtle theme-border rounded-2xl p-4 flex gap-4 items-center theme-hover-border transition-colors group shadow-md"
              >
              <NuxtLink
                :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                class="relative w-14 h-14 rounded-full overflow-hidden theme-surface-muted shrink-0 border theme-border-subtle theme-border group-hover:border-pink-500 transition-colors flex items-center justify-center"
              >
                <NuxtImg
                  v-if="item.profile_picture"
                  :src="item.profile_picture"
                  :alt="item.firstname + ' ' + item.lastname"
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
                  class="text-sm font-bold theme-text theme-hover-primary-text transition-colors truncate block"
                >
                  {{ item.firstname }} {{ item.lastname }}
                </NuxtLink>
                <span class="text-xs theme-text-muted block truncate mt-0.5">
                  {{ item.character_name || item.performance || "Voix / Rôle" }}
                </span>
                <span
                  v-if="item.note"
                  class="text-xs theme-text-muted block truncate mt-1"
                  >{{ item.note }}</span
                >
              </div>
              </div>
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
const { page: castPage, setPage: setCastPage } =
  useUrlPagination("castPage");

// Instant Hydration Data Fetching
const { data, pending, refresh } = await useAsyncData(
  `podcast-${podcastId.value}-${locale.value}`,
  () => fetchPodcastData(podcastId.value, locale.value),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const podcast = computed<Podcast | null>(() => data.value?.podcast || null);
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

const getDisplayLanguage = (langCode: string | undefined | null) => {
  if (!langCode) return t("details.notSpecified", "Not specified");
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
  note?: string;
  profile_picture?: string | null;
}

const formattedCast = computed<FormattedCastItem[]>(() => {
  if (!activeDubProject.value) return [];
  const works =
    activeDubProject.value.works || activeDubProject.value.work || [];
  return works.map((w: any) => ({
    work_id: w.id,
    voice_actor_id: w.voice_actors?.id || w.voice_actor_id,
    firstname: w.voice_actors?.firstname || "",
    lastname: w.voice_actors?.lastname || "",
    character_name: w.character_name || "",
    performance: w.performance || "",
    note: w.note || "",
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

watch([debouncedCastSearch, activeDubId], () => {
  void refresh();
});

watch(debouncedCastSearch, () => {
  void setCastPage(1);
});

function openExternalUrl(url?: string) {
  if (typeof window !== "undefined" && url) {
    window.open(url, "_blank");
  }
}

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
