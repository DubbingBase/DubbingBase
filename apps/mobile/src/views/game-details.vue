<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "@/api/supabase";
import { useI18n } from "vue-i18n";
import { usePermissions } from "@/composables/usePermissions";
import { EllipsisVertical, Gamepad2, Star, Calendar, Cpu, Building2 } from "lucide-vue-next";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppActionSheet from "@/components/common/AppActionSheet.vue";
import DubbingProjectsView from "@/components/DubbingProjectsView.vue";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import type { GameMedia, IgdbCharacter, GameDetailResponse } from "@supabase/functions/_shared/types";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const { isAdmin } = usePermissions();

const game = ref<GameMedia | null>(null);
const characters = ref<IgdbCharacter[]>([]);
const dubbingProjects = ref<any[]>([]);
const votes = ref<Record<number, any>>({});
const isLoading = ref(true);
const fetchError = ref<string | null>(null);
const isActionSheetOpen = ref(false);

const {
  goToActor,
  goToVoiceActor,
  getVoiceActorByTmdbId,
  editVoiceActorLink,
  confirmDeleteVoiceActorLink,
  openVoiceActorSearch,
  showVoiceActorSearch,
  linkVoiceActor,
} = useVoiceActorManagement(
  () => route.params.id as string,
  "video_game",
  () => fetchData(),
);

async function fetchData() {
  isLoading.value = true;
  fetchError.value = null;

  try {
    const { data, error } = await supabase.functions.invoke<GameDetailResponse>("game", {
      body: { id: Number(route.params.id) },
    });

    if (error) throw error;

    // New response uses 'media' key instead of 'game'
    game.value = data.media ?? null;
    characters.value = data.characters ?? [];
    dubbingProjects.value = data.dubbingProjects ?? [];
    votes.value = data.votes ?? {};
  } catch (err: any) {
    console.error("Error fetching game details:", err);
    fetchError.value = err?.message ?? t("common.error");
  } finally {
    isLoading.value = false;
  }
}

async function handleRefresh(event?: any) {
  await fetchData();
  event?.detail?.complete?.();
}

async function triggerPrepareGame() {
  try {
    const { data, error } = await supabase.functions.invoke("prepare_game", {
      body: { igdbId: Number(route.params.id) },
    });
    if (error) throw error;
    await fetchData();
  } catch (err: any) {
    console.error("prepare_game failed:", err);
  }
}

/** Format Unix timestamp (seconds) to a readable year string. */
function formatReleaseYear(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp * 1000).getFullYear().toString();
}

function getDevelopers(g: GameMedia): string {
  return (
    g.involved_companies
      ?.filter((c) => c.developer)
      .map((c) => c.company.name)
      .join(", ") ?? ""
  );
}

function getPublishers(g: GameMedia): string {
  return (
    g.involved_companies
      ?.filter((c) => c.publisher)
      .map((c) => c.company.name)
      .join(", ") ?? ""
  );
}

const adminActions = [
  {
    text: t("game.prepareCredits"),
    handler: () => triggerPrepareGame(),
  },
];

onMounted(() => fetchData());
</script>

<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ game?.name ?? "" }}</AppTitle>
          <template v-if="isAdmin" #end>
            <AppButton
              fill="clear"
              color="text"
              @click="isActionSheetOpen = true"
              aria-label="Menu"
            >
              <EllipsisVertical class="app-icon" />
            </AppButton>
          </template>
        </AppToolbar>
      </AppHeader>

      <AppContent>
        <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
          <ion-refresher-content></ion-refresher-content>
        </ion-refresher>

        <!-- Loading skeleton -->
        <div v-if="isLoading" class="px-4 pt-4 space-y-4 animate-pulse">
          <div class="h-48 bg-white/10 rounded-xl"></div>
          <div class="h-6 bg-white/10 rounded w-3/4"></div>
          <div class="h-4 bg-white/10 rounded w-1/2"></div>
        </div>

        <!-- Game info card -->
        <div v-else-if="game" class="px-4 pt-4">
          <!-- Cover + metadata -->
          <div class="flex gap-4 mb-4">
            <img
              v-if="game.cover?.url"
              :src="game.cover.url"
              :alt="game.name"
              class="w-28 h-36 rounded-xl object-cover shadow-lg flex-shrink-0"
            />
            <div class="flex-1 min-w-0">
              <h1 class="text-xl font-bold text-white leading-tight mb-1">
                {{ game.name }}
              </h1>

              <div class="flex items-center gap-1.5 text-sm text-white/60 mb-2">
                <Calendar class="w-3.5 h-3.5" />
                <span>{{ formatReleaseYear(game.first_release_date) }}</span>
              </div>

              <div
                v-if="game.rating"
                class="flex items-center gap-1.5 text-sm text-yellow-400 mb-2"
              >
                <Star class="w-3.5 h-3.5 fill-current" />
                <span>{{ game.rating.toFixed(1) }}</span>
                <span class="text-white/40"
                  >({{ game.rating_count }} avis)</span
                >
              </div>

              <!-- Genres -->
              <div
                v-if="game.genres?.length"
                class="flex flex-wrap gap-1 mb-2"
              >
                <span
                  v-for="genre in game.genres"
                  :key="genre.id"
                  class="px-2 py-0.5 bg-violet-500/20 text-violet-300 rounded-full text-xs"
                >
                  {{ genre.name }}
                </span>
              </div>

              <!-- Platforms -->
              <div
                v-if="game.platforms?.length"
                class="flex flex-wrap gap-1"
              >
                <span
                  v-for="platform in game.platforms"
                  :key="platform.id"
                  class="px-2 py-0.5 bg-white/10 text-white/60 rounded-full text-xs"
                >
                  {{ platform.name }}
                </span>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <p
            v-if="game.summary"
            class="text-sm text-white/70 leading-relaxed mb-4"
          >
            {{ game.summary }}
          </p>

          <!-- Developer / Publisher -->
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div v-if="getDevelopers(game)" class="bg-white/5 rounded-xl p-3">
              <div class="flex items-center gap-1.5 text-white/40 text-xs mb-1">
                <Cpu class="w-3 h-3" />
                {{ t("game.developer") }}
              </div>
              <p class="text-sm text-white font-medium">
                {{ getDevelopers(game) }}
              </p>
            </div>
            <div v-if="getPublishers(game)" class="bg-white/5 rounded-xl p-3">
              <div class="flex items-center gap-1.5 text-white/40 text-xs mb-1">
                <Building2 class="w-3 h-3" />
                {{ t("game.publisher") }}
              </div>
              <p class="text-sm text-white font-medium">
                {{ getPublishers(game) }}
              </p>
            </div>
          </div>

          <!-- Characters -->
          <div v-if="characters.length" class="mb-4">
            <h2 class="text-sm font-semibold text-white/50 uppercase tracking-wider mb-2">
              {{ t("game.characters") }}
            </h2>
            <div class="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
              <div
                v-for="char in characters"
                :key="char.id"
                class="flex-shrink-0 flex flex-col items-center gap-1 w-16"
              >
                <div class="w-14 h-14 rounded-full bg-white/10 overflow-hidden">
                  <img
                    v-if="char.mug_shot?.url"
                    :src="char.mug_shot.url"
                    :alt="char.name"
                    class="w-full h-full object-cover"
                  />
                  <div
                    v-else
                    class="w-full h-full flex items-center justify-center"
                  >
                    <Gamepad2 class="w-6 h-6 text-white/30" />
                  </div>
                </div>
                <span class="text-xs text-white/60 text-center leading-tight line-clamp-2">
                  {{ char.name }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Dubbing projects -->
        <DubbingProjectsView
          v-if="!isLoading"
          :contentId="route.params.id as string"
          contentType="video_game"
          :projects="dubbingProjects"
          :actors="characters"
          :is-admin="isAdmin"
          :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
          :go-to-actor="goToActor"
          :go-to-voice-actor="goToVoiceActor"
          :edit-voice-actor-link="editVoiceActorLink"
          :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
          :open-voice-actor-search="openVoiceActorSearch"
          :parentLoading="isLoading"
        />

        <div v-if="fetchError" class="text-center text-red-500 mt-4 px-4">
          {{ fetchError }}
        </div>
      </AppContent>

      <!-- Admin action sheet -->
      <AppActionSheet
        v-if="isAdmin"
        v-model:is-open="isActionSheetOpen"
        :actions="adminActions"
      />
    </AppPage>
  </ion-page>
</template>
