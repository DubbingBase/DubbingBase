<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <button @click="router.back()" class="custom-back-button">
            &larr;
          </button>
        </ion-buttons>
        <ion-title>{{ episode?.name || 'Détail de l\'épisode' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
      <ActionButtons
        :hasWikidataId="hasWikidataId"
        :hasData="hasData"
        :isFetching="isFetching"
        :isScanning="false"
        :queue-status="queueStatus"
        :queue-error-message="queueErrorMessage"
        @fetch-infos="fetchEpisodeInfos"
      />
      <LoadingSpinner v-if="isLoading" name="crescent" />
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="episode && !isLoading" class="episode-detail">
        <EpisodeBanner :episode="episode" :serieId="Number(route.params.id)" :seasonNumber="Number(route.params.season)" />
        <div class="voices">
          <h3>Distribution originale et voix françaises</h3>
          <ActorList :actors="episode?.credits?.cast || []" :voiceActors="[]" :getVoiceActorByTmdbId="getVoiceActorByTmdbId" :goToActor="goToActor" :goToVoiceActor="goToVoiceActor" :isAdmin="false" :editVoiceActorLink="editVoiceActorLink" :confirmDeleteVoiceActorLink="confirmDeleteVoiceActorLink" :openVoiceActorSearch="openVoiceActorSearch" :loading="isLoading" />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  toastController,
  IonRefresher,
  IonRefresherContent,
} from "@ionic/vue";
import LoadingSpinner from "../components/common/LoadingSpinner.vue";
import { supabase } from "../api/supabase";
import { enqueueAndProcessMedia } from "../api/mediaQueue";
import ActionButtons from "../components/ActionButtons.vue";
import EpisodeBanner from "../components/EpisodeBanner.vue";
import ActorList from "../components/ActorList.vue";

const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const error = ref("");
const episode = ref<any>(null);
const dbVoiceActors = ref<any[]>([]);

const wikiDataId = computed(() => episode.value?.external_ids?.wikidata_id);
const hasWikidataId = computed(() => !!wikiDataId.value);
const hasData = computed(() => dbVoiceActors.value.length > 0);
const isFetching = ref(false);
const queueStatus = ref<string | null>(null);
const queueErrorMessage = ref<string | null>(null);

const backHref = computed(() => {
  return router.resolve({ name: 'SeasonDetails', params: { id: route.params.id, season: route.params.season } }).href;
});

const fetchQueueStatus = async () => {
  try {
    const { data, error: queueErr } = await supabase
      .rpc("get_media_queue_status", {
        p_tmdb_id: Number(route.params.id),
        p_media_type: "episode",
        p_season_number: Number(route.params.season),
        p_episode_number: Number(route.params.episode),
      });
    if (queueErr) throw queueErr;
    const statusData = data as { status: string | null; error_message: string | null } | null;
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

let pollingInterval: any = null;

function stopQueuePolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

const handleRefresh = async (event: any) => {
  try {
    await fetchEpisodeData();
  } catch (error) {
    console.error("Error refreshing episode data:", error);
  } finally {
    event.target.complete();
  }
};

async function fetchEpisodeInfos() {
  const id = wikiDataId.value;
  if (!id || !episode.value) {
    console.error("id or episode is undefined");
    return;
  }
  isFetching.value = true;
  
  // Fetch details and trigger processing directly
  try {
    await enqueueAndProcessMedia({
      tmdbId: Number(route.params.id),
      mediaType: "episode",
      seasonNumber: Number(route.params.season),
      episodeNumber: Number(episode.value.episode_number),
    });
    // Immediately fetch updated data to display changes
    await fetchEpisodeData();
    const toast = await toastController.create({
      message: "Import completed successfully! The voice cast has been updated.",
      duration: 3000,
      position: "top",
      color: "success",
    });
    await toast.present();
  } catch (err) {
    console.error("Error fetching episode data:", err);
    const toast = await toastController.create({
      message: "Import failed. Please try again.",
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
  router.push({ name: 'VoiceActorDetails', params: { id } });
}

function getVoiceActorByTmdbId(tmdbId: number) {
  return dbVoiceActors.value.filter(
    va => va.actor_id === tmdbId || va.original_actor_id === tmdbId || va.actorId === tmdbId
  );
}

function goToActor(id: number) {
  router.push({ name: 'ActorDetails', params: { id } });
}

function editVoiceActorLink(item: any) {}

function confirmDeleteVoiceActorLink(item: any) {}

function openVoiceActorSearch(actor: any) {}

async function fetchEpisodeData() {
  const serieId = route.params.id;
  const seasonNumber = route.params.season;
  const episodeNumber = route.params.episode;
  
  const episodeResponse = await supabase.functions.invoke("episode", {
    body: { id: serieId, season_number: seasonNumber, episode_number: episodeNumber }
  });

  const data = episodeResponse.data;
  episode.value = data.episode;
  dbVoiceActors.value = data.db_voice_actors || [];
  if (!episode.value) error.value = "Épisode introuvable.";

  if (!hasData.value && hasWikidataId.value) {
    await fetchQueueStatus();
  }
}

watch(() => route.params.episode, async (newEpisode) => {
  if (!newEpisode) return;
  isLoading.value = true;
  error.value = "";
  try {
    await fetchEpisodeData();
  } catch (e: any) {
    error.value = e.message || "Erreur lors du chargement.";
  } finally {
    isLoading.value = false;
  }
}, { immediate: true });
</script>

<style lang="scss" scoped>
.custom-back-button {
  background: transparent;
  color: white;
  border: none;
  font-size: 24px;
  padding: 0 16px;
  cursor: pointer;
}
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
