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
          class="text-gray-900 dark:text-gray-100 font-semibold text-base md:text-lg bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg"
        >
          {{ audiobook.first_publish_year }}
        </span>
        <span
          v-if="authorsText"
          class="text-gray-800 dark:text-gray-200 font-medium text-sm md:text-base bg-white/60 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-lg truncate max-w-[200px] md:max-w-xs"
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
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white/40 dark:bg-black/40 text-gray-800 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-black/60 transition-colors backdrop-blur-md uppercase tracking-wider"
          >{{ $t('audiobook.openLibrary') }}<ExternalLinkIcon class="w-3 h-3 opacity-70" />
          </a>
        </div>
      </template>

      <template #actions-left>
        <div v-if="dubbingProjects.length > 0" class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="project in dubbingProjects"
            :key="project.id"
            :to="{ query: { dub: project.id } }"
            class="px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 dark:border-[#2a2a2a] flex items-center gap-1.5"
            :class="
              activeDubId === project.id
                ? 'bg-cyan-600 dark:bg-[#00E5FF] text-white dark:text-black border-cyan-600 dark:border-[#00E5FF]'
                : 'bg-white dark:bg-[#1d1d1d] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'
            "
          >
            {{ getDisplayLanguage(project.language) }}
            <span
              class="text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors"
              :class="
                activeDubId === project.id
                  ? 'bg-cyan-500/20 text-cyan-700 dark:text-[#00E5FF]'
                  : 'bg-gray-100 dark:bg-[#2a2a2a] text-gray-500 dark:text-gray-400'
              "
            >
              {{ projectVoiceActorCount(project) }}
            </span>
          </NuxtLink>
        </div>
        <div v-else class="text-sm text-gray-500 font-medium">
          {{ $t("details.noDubbingProjects", "Aucun projet de doublage disponible") }}
        </div>
      </template>

      <template #actions-right>
        <template v-if="activeDubProject?.studio_data">
          <NuxtLink
            :to="localePath(`/studio/${activeDubProject.studio_data.id}`)"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-[#2a2a2a] hover:border-cyan-500 transition-colors group bg-gray-50 dark:bg-[#1d1d1d]"
            title="Studio d'enregistrement"
          >
            <div
              class="w-6 h-6 rounded flex items-center justify-center overflow-hidden shrink-0 bg-white dark:bg-[#2a2a2a]"
            >
              <img
                v-if="activeDubProject.studio_data.logo_url"
                :src="activeDubProject.studio_data.logo_url"
                class="w-full h-full object-contain p-0.5"
              />
              <span v-else class="font-bold text-xs text-gray-400">
                {{ activeDubProject.studio_data.name?.charAt(0) || "" }}
              </span>
            </div>
            <span
              class="font-medium text-xs group-hover:text-cyan-500 transition-colors truncate max-w-[120px]"
            >
              {{ activeDubProject.studio_data.name }}
            </span>
          </NuxtLink>
          <div class="h-6 w-px bg-gray-200 dark:bg-[#2a2a2a]"></div>
        </template>

        <ClientOnly>
          <NuxtLink
            v-if="isAdmin"
            :to="localePath(`/audiobook/${audiobook?.id || 'new'}/edit/${activeDubId || 'new'}`)"
            class="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors flex items-center gap-1.5 font-medium"
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
            <span class="hidden sm:inline">{{ $t('common.edit') }}</span>
          </NuxtLink>
        </ClientOnly>

        <ForceEnqueueButton
          v-if="audiobook?.id"
          media-type="audiobook"
          :media-id="audiobook.id"
        />

        <button
          @click="isReportModalOpen = true"
          class="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
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
              class="text-gray-700 dark:text-gray-300 leading-relaxed text-lg mb-8 whitespace-pre-line"
            >
              {{ audiobook.description ||
                $t(
                  "details.noSynopsis",
                  "Aucune description disponible pour ce livre.",
                ) }}
            </p>

            <div
              class="grid grid-cols-2 md:grid-cols-4 gap-6 bg-white dark:bg-[#1d1d1d] p-6 rounded-xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm dark:shadow-none"
            >
              <div>
                <h3
                  class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
                >
                  {{ $t("audiobook.author", "Auteur(s)") }}
                </h3>
                <p class="font-medium text-sm">
                  {{ authorsText || "-" }}
                </p>
              </div>
              <div>
                <h3
                  class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
                >
                  {{ $t("audiobook.publishYear", "Publication") }}
                </h3>
                <p class="font-medium text-sm">
                  {{ audiobook.first_publish_year || audiobook.first_publish_date || "-" }}
                </p>
              </div>
              <div v-if="audiobook.isbn">
                <h3
                  class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
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
                  class="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2"
                >{{ $t('audiobook.subjects') }}</h3>
                <div class="flex flex-wrap gap-1.5">
                  <span
                    v-for="(sub, sIdx) in audiobook.subjects.slice(0, 4)"
                    :key="sIdx"
                    class="px-2 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-xs font-medium rounded-md text-gray-700 dark:text-gray-300"
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
                <div class="text-gray-500 dark:text-gray-400 text-sm mt-1">{{ $t('audiobook.castCount', { shown: filteredCast.length, total: formattedCast.length }) }}</div>
              </div>

              <div class="relative w-full sm:w-64">
                <SearchIcon
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                />
                <input
                  v-model="searchInput"
                  type="search"
                  :placeholder="$t('search.placeholder', 'Rechercher un comédien...')"
                  class="w-full bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-[#00E5FF] transition-all text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div
            v-if="filteredCast.length === 0"
            class="text-gray-500 text-center py-12 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-[#2a2a2a]"
          >
            {{ $t("details.noCast", "Aucun narrateur ou comédien renseigné pour ce projet.") }}
          </div>

          <div
            v-else
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
          >
            <div
              v-for="item in visibleCast"
              :key="item.work_id"
              class="bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl p-4 shadow-sm transition-colors hover:border-gray-300 dark:hover:border-gray-700"
            >
              <div class="flex flex-col gap-4">
                <div class="flex items-center gap-4">
                  <NuxtLink
                    :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                    class="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 dark:bg-[#222] flex-shrink-0"
                  >
                    <NuxtImg
                      format="webp"
                      loading="lazy"
                      decoding="async"
                      v-if="item.profile_picture"
                      :src="item.profile_picture"
                      class="w-full h-full object-cover"
                      alt="Voice Actor"
                    />
                    <div
                      v-else
                      class="w-full h-full flex items-center justify-center text-lg font-bold text-gray-400 bg-gray-300 dark:bg-gray-800 uppercase"
                    >
                      {{ item.firstname?.[0] }}{{ item.lastname?.[0] }}
                    </div>
                  </NuxtLink>

                  <div class="flex flex-col min-w-0 flex-1">
                    <NuxtLink
                      :to="localePath(`/voice-actor/${item.voice_actor_id}`)"
                      class="font-bold text-base text-gray-900 dark:text-white hover:text-cyan-500 transition-colors truncate block"
                    >
                      {{ item.firstname }} {{ item.lastname }}
                    </NuxtLink>
                    <span
                      class="text-xs text-gray-500 dark:text-gray-400 font-medium truncate block mt-0.5"
                    >
                      {{ item.character_name || item.performance || $t("audiobook.narrator", "Narrateur") }}
                    </span>
                    <div v-if="item.performance" class="mt-1">
                      <span
                        class="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-[#2a2a2a] text-gray-600 dark:text-gray-300 rounded-md font-medium border border-gray-200 dark:border-gray-700"
                      >
                        {{ item.performance }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Load more sentinel -->
          <div
            v-if="hasMore"
            ref="sentinelRef"
            class="py-8 flex flex-col items-center justify-center gap-2"
          >
            <button
              @click="loadMore"
              class="px-5 py-2 bg-white dark:bg-[#1d1d1d] hover:bg-gray-100 dark:hover:bg-[#2a2a2a] text-sm font-medium rounded-xl text-gray-700 dark:text-gray-200 transition-all border border-gray-200 dark:border-[#2a2a2a] shadow-sm cursor-pointer"
            >
              {{ $t("common.loadMore", "Charger plus") }}
            </button>
            <span class="text-xs text-gray-400">
              {{ visibleCast.length }} / {{ filteredCast.length }}
            </span>
          </div>
        </section>
      </template>
    </MediaDetailsLayout>

    <div v-else class="text-center py-20 text-gray-500 min-h-screen">{{ $t('audiobook.notFound') }}</div>

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
import { fetchAudiobookData } from "@app/shared-logic";
import type { Audiobook, AudiobookResponse } from "@app/shared-logic";
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

// Instant Hydration Data Fetching
const { data, pending } = await useAsyncData(
  `audiobook-${audiobookId.value}-${locale.value}`,
  () => fetchAudiobookData(audiobookId.value, locale.value),
  {
    getCachedData: (key, nuxtApp) =>
      nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  },
);

const audiobook = computed<Audiobook | null>(() => data.value?.audiobook || null);
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

// Client-side search with debounce
const searchInput = ref("");
const debouncedSearch = refDebounced(searchInput, 150);

const filteredCast = computed(() => {
  if (!debouncedSearch.value) return formattedCast.value;
  const q = debouncedSearch.value.toLowerCase().trim();
  return formattedCast.value.filter((item) => {
    const fullName = `${item.firstname} ${item.lastname}`.toLowerCase();
    const char = (item.character_name || "").toLowerCase();
    const perf = (item.performance || "").toLowerCase();
    return fullName.includes(q) || char.includes(q) || perf.includes(q);
  });
});

// Progressive batching for long cast lists
const BATCH_SIZE = 24;
const currentBatchCount = ref(1);

const visibleCast = computed(() => {
  return filteredCast.value.slice(0, currentBatchCount.value * BATCH_SIZE);
});

const hasMore = computed(() => {
  return visibleCast.value.length < filteredCast.value.length;
});

function loadMore() {
  currentBatchCount.value += 1;
}

const sentinelRef = useTemplateRef<HTMLElement>("sentinelRef");
useIntersectionObserver(sentinelRef, ([entry]) => {
  if (entry?.isIntersecting && hasMore.value) {
    loadMore();
  }
});

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
