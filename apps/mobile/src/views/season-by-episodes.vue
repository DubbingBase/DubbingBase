<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="backHref" />
        </ion-buttons>
        <ion-title>{{ episode?.name || 'Détail de l\'épisode' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ActionButtons :hasWikidataId="hasWikidataId" :hasData="hasData" :isFetching="isFetching" :isScanning="false" @fetch-infos="fetchEpisodeInfos" />
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
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { IonPage, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, toastController } from "@ionic/vue";
import LoadingSpinner from "../components/common/LoadingSpinner.vue";
import { supabase } from "../api/supabase";
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

const backHref = computed(() => {
  return router.resolve({ name: 'SeasonDetails', params: { id: route.params.id, season: route.params.season } }).href;
});

async function fetchEpisodeInfos() {
  const id = wikiDataId.value;
  if (!id || !episode.value) {
    console.error("id or episode is undefined");
    return;
  }
  isFetching.value = true;
  try {
    const data = await supabase.functions.invoke("prepare_movie", {
      body: {
        tmdbId: route.params.id,
        type: "episode",
        seasonNumber: route.params.season,
        episodeNumber: episode.value.episode_number,
      },
    });
    if (data.ok) {
    location.reload();
  } else {
    toastController.create({
      message: data.error,
      duration: 2000,
      position: 'top',
      color: 'danger',
    }).then((toast) => {
      toast.present();
    });
    isFetching.value = false;
    isLoading.value = false;

  }
  } catch (e) {
    console.error(e);
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

onMounted(async () => {
  isLoading.value = true;
  error.value = "";
  try {
    const serieId = route.params.id;
    const seasonNumber = route.params.season;
    const episodeNumber = route.params.episode;
    const { data } = await supabase.functions.invoke("episode", { body: { id: serieId, season_number: seasonNumber, episode_number: episodeNumber } });
    episode.value = data.episode;
    dbVoiceActors.value = data.db_voice_actors || [];
    if (!episode.value) error.value = "Épisode introuvable.";
  } catch (e: any) {
    error.value = e.message || "Erreur lors du chargement.";
  } finally {
    isLoading.value = false;
  }
});
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
