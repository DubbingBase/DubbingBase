<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ episode?.name || "Détail de l'épisode" }}</AppTitle>
          <template #end>
            <AppButton
              fill="clear"
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
        <div
          v-if="fetchError || (queueStatus === 'failed' && queueErrorMessage)"
          class="text-center text-red-500 mt-4"
        >
          {{ fetchError || queueErrorMessage }}
        </div>
        <LoadingSpinner v-if="isLoading" name="crescent" />
        <div v-if="error" class="error">{{ error }}</div>
        <div v-if="episode && !isLoading" class="episode-detail">
          <EpisodeBanner
            :episode="episode"
            :serieId="Number(route.params.id)"
            :seasonNumber="Number(route.params.season)"
          />
          <div class="voices">
            <h3>Distribution originale et voix françaises</h3>
            <ActorList
              :actors="episode?.credits?.cast || []"
              :voiceActors="[]"
              :getVoiceActorByTmdbId="getVoiceActorByTmdbId"
              :goToActor="goToActor"
              :goToVoiceActor="goToVoiceActor"
              :isAdmin="false"
              :editVoiceActorLink="editVoiceActorLink"
              :confirmDeleteVoiceActorLink="confirmDeleteVoiceActorLink"
              :openVoiceActorSearch="openVoiceActorSearch"
              :loading="isLoading"
            />
          </div>
        </div>

        <AppActionSheet
          v-model:is-open="isActionSheetOpen"
          :buttons="actionSheetButtons"
        />
      </AppContent>
    </AppPage>
  </ion-page>
</template>

<script lang="ts" setup>
import { IonPage } from "@ionic/vue";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import { toastController } from "@/composables/useToast";
import { ref, computed, watch } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRoute, useRouter } from "vue-router";
import LoadingSpinner from "../components/common/LoadingSpinner.vue";
import { supabase } from "../api/supabase";
import { enqueueMedia } from "../api/mediaQueue";
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import Info from "~icons/lucide/info";
import AppActionSheet, {
  ActionSheetButton,
} from "@/components/common/AppActionSheet.vue";
import AppButton from "@/components/common/AppButton.vue";
import EpisodeBanner from "../components/EpisodeBanner.vue";
import ActorList from "../components/ActorList.vue";

const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const error = ref("");
const episode = ref<{ episode_number?: number; name?: string; air_date?: string; overview?: string; still_path?: string } | null>(null);
const dbVoiceActors = ref<Array<{ id: number; firstname?: string; lastname?: string; profile_picture?: string; }>>([]);

const wikiDataId = computed(() => episode.value?.external_ids?.wikidata_id);
const hasWikidataId = computed(() => !!wikiDataId.value);
const hasData = computed(() => dbVoiceActors.value.length > 0);
const isFetching = ref(false);
const queueStatus = ref<string | null>(null);
const queueErrorMessage = ref<string | null>(null);
const fetchError = ref("");

const isActionSheetOpen = ref(false);
const actionSheetButtons = computed<ActionSheetButton[]>(() => {
  const buttons: ActionSheetButton[] = [];

  if (hasWikidataId.value && !hasData.value) {
    buttons.push({
      text: "Rajouter à la queue",
      icon: Info,
      handler: () => fetchEpisodeInfos(),
    });
  }

  buttons.push({
    text: "Annuler",
    role: "cancel",
  });

  return buttons;
});

const backHref = computed(() => {
  return router.resolve({
    name: "SeasonDetails",
    params: { id: route.params.id, season: route.params.season },
  }).href;
});

const fetchQueueStatus = async () => {
  try {
    const { data: funcData, error: queueErr } = await supabase.functions.invoke(
      "media-queue",
      {
        body: {
          action: "status",
          mediaId: Number(route.params.id),
          mediaType: "episode",
          seasonNumber: Number(route.params.season),
          episodeNumber: Number(route.params.episode),
        },
      },
    );

    const data = funcData?.data;
    if (queueErr) throw queueErr;
    const statusData = data as {
      status: string | null;
      error_message: string | null;
    } | null;
    if (statusData) {
      queueStatus.value = statusData.status;
      queueErrorMessage.value = statusData.error_message;
    } else {
      queueStatus.value = null;
      queueErrorMessage.value = null;
    }
  } catch (err) {
    console.error("Error fetching queue status:", err);
  }
};

let pollingInterval: ReturnType<typeof setInterval> | null = null;

function stopQueuePolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

const handleRefresh = async (event: RefresherCustomEvent) => {
  try {
    await fetchEpisodeData();
  } catch (error) {
    console.error("Error refreshing episode data:", error);
  } finally {
    event.target.complete();
  }
};

async function fetchEpisodeInfos() {
  if (!episode.value) {
    console.error("episode is undefined");
    return;
  }
  isFetching.value = true;

  // Enqueue and fire-and-forget: the processor will pick it up in the background.
  // The user is informed via a toast and can refresh the page later to see results.
  try {
    await enqueueMedia({
      tmdbId: Number(route.params.id),
      mediaType: "episode",
      seasonNumber: Number(route.params.season),
      episodeNumber: Number(episode.value.episode_number),
    });
    // Refresh queue status so the UI reflects the pending state
    await fetchQueueStatus();
    const toast = await toastController.create({
      message:
        "Added to queue! Check back in a moment to see the updated voice cast.",
      duration: 4000,
      position: "top",
      color: "success",
    });
    await toast.present();
  } catch (err) {
    console.error("Error enqueueing episode:", err);
    const toast = await toastController.create({
      message: "Failed to add to queue. Please try again.",
      duration: 3000,
      position: "top",
      color: "danger",
    });
    await toast.present();
  } finally {
    isFetching.value = false;
  }
}

function goToVoiceActor(id: number) {
  router.push({ name: "voice-actor-details", params: { id } });
}

function getVoiceActorByTmdbId(tmdbId: number) {
  return dbVoiceActors.value.filter(
    (va) =>
      va.actor_id === tmdbId ||
      va.original_actor_id === tmdbId ||
      va.actorId === tmdbId,
  );
}

function goToActor(id: number) {
  router.push({ name: "ActorDetails", params: { id } });
}

function editVoiceActorLink(item: { work_id?: number }) {}

function confirmDeleteVoiceActorLink(item: { work_id?: number }) {}

function openVoiceActorSearch(actor: { id: number }) {}

async function fetchEpisodeData() {
  const serieId = route.params.id;
  const seasonNumber = route.params.season;
  const episodeNumber = route.params.episode;

  const episodeResponse = await supabase.functions.invoke("episode", {
    body: {
      id: serieId,
      season_number: seasonNumber,
      episode_number: episodeNumber,
    },
  });

  const data = episodeResponse.data;
  episode.value = data.episode;
  dbVoiceActors.value = data.db_voice_actors || [];
  if (!episode.value) error.value = "Épisode introuvable.";

  if (!hasData.value && hasWikidataId.value) {
    await fetchQueueStatus();
  }
}

watch(
  () => route.params.episode,
  async (newEpisode) => {
    if (!newEpisode) return;
    isLoading.value = true;
    error.value = "";
    try {
      await fetchEpisodeData();
    } catch (e: unknown) {
      error.value = (e as { message?: string })?.message || "Erreur lors du chargement.";
    } finally {
      isLoading.value = false;
    }
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.voices {
  margin-top: 1.5rem;
  h3 {
    margin-bottom: 0.5rem;
  }
}
.error {
  color: #e74c3c;
  text-align: center;
  margin: 1.5rem 0;
}
</style>
