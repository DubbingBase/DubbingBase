<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { Radio, Calendar, User } from "lucide-vue-next";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import DubbingProjectsView from "@/components/DubbingProjectsView.vue";
import { fetchPodcastData } from "@app/shared-logic";
import { usePermissions } from "@/composables/usePermissions";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import type { Podcast } from "@app/shared-logic";

const route = useRoute();
const router = useRouter();
const { t, locale } = useI18n();
const { isAdmin } = usePermissions();

const podcast = ref<Podcast | null>(null);
const dubbingProjects = ref<any[]>([]);
const isLoading = ref(true);
const fetchError = ref<string | null>(null);

const {
  goToActor,
  goToVoiceActor,
  getVoiceActorByTmdbId,
  editVoiceActorLink,
  confirmDeleteVoiceActorLink,
  openVoiceActorSearch,
} = useVoiceActorManagement(
  () => route.params.id as string,
  "podcast",
  () => fetchData(),
);

async function fetchData() {
  isLoading.value = true;
  fetchError.value = null;

  try {
    const podcastId = Number(route.params.id);
    const data = await fetchPodcastData(podcastId, locale.value);
    if (data && data.podcast) {
      podcast.value = data.podcast;
      dubbingProjects.value = data.dubbingProjects || [];
    } else {
      fetchError.value = t("common.error");
    }
  } catch (err: any) {
    console.error("Error fetching podcast details:", err);
    fetchError.value = err?.message ?? t("common.error");
  } finally {
    isLoading.value = false;
  }
}

function handleRefresh(event?: any) {
  fetchData().finally(() => {
    event?.detail?.complete?.();
  });
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <template #start>
          <AppBackButton default-href="/search" />
        </template>
        <AppTitle>{{ podcast?.title || $t("search.podcast", "Podcast") }}</AppTitle>
      </AppToolbar>
    </AppHeader>

    <AppContent>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
        <ion-refresher-content />
      </ion-refresher>

      <!-- Loading State -->
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <ion-spinner />
      </div>

      <!-- Error State -->
      <div v-else-if="fetchError" class="p-4 text-center text-red-400">
        <p>{{ fetchError }}</p>
      </div>

      <!-- Content -->
      <div v-else-if="podcast" class="pb-8">
        <!-- Hero Header -->
        <div class="relative bg-gray-900 px-4 pt-4 pb-6">
          <div class="flex gap-4 items-start">
            <!-- Cover Poster -->
            <div class="w-28 shrink-0 rounded-xl overflow-hidden shadow-lg aspect-square bg-gray-800 flex items-center justify-center">
              <img
                v-if="podcast.cover_url"
                :src="podcast.cover_url"
                :alt="podcast.title"
                class="w-full h-full object-cover"
              />
              <Radio v-else class="w-10 h-10 text-gray-500" />
            </div>

            <!-- Meta info -->
            <div class="flex-1 min-w-0 space-y-2">
              <div class="flex items-center gap-1.5 text-xs text-pink-400 font-semibold uppercase tracking-wider">
                <Radio class="w-3.5 h-3.5" />
                <span>{{ $t("search.podcast", "Podcast") }}</span>
              </div>

              <h1 class="text-lg font-bold text-white leading-tight line-clamp-2">
                {{ podcast.title }}
              </h1>

              <div v-if="podcast.author" class="flex items-center gap-1.5 text-xs text-gray-300">
                <User class="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span class="truncate">{{ podcast.author }}</span>
              </div>

              <div v-if="podcast.release_date" class="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar class="w-3.5 h-3.5 shrink-0" />
                <span>{{ podcast.release_date.substring(0, 10) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Synopsis / Description -->
        <div v-if="podcast.description" class="px-4 mt-6 mb-6">
          <h2 class="text-sm font-bold text-gray-200 uppercase tracking-wider mb-2">
            {{ $t("details.synopsis", "Description") }}
          </h2>
          <p class="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
            {{ podcast.description }}
          </p>
        </div>

        <!-- Dubbing / Voice Projects -->
        <DubbingProjectsView
          v-if="!isLoading"
          :contentId="route.params.id as string"
          contentType="podcast"
          :projects="dubbingProjects"
          :actors="[]"
          :is-admin="isAdmin"
          :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
          :go-to-actor="goToActor"
          :go-to-voice-actor="goToVoiceActor"
          :edit-voice-actor-link="editVoiceActorLink"
          :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
          :open-voice-actor-search="openVoiceActorSearch"
          :parentLoading="isLoading"
        />
      </div>
    </AppContent>
  </AppPage>
</template>
