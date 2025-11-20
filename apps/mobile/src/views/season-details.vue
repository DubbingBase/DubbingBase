<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Home' }" />
        </ion-buttons>
        <ion-title>{{ season?.name || "Détails de la saison" }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ActionButtons
        :hasWikidataId="hasWikidataId"
        :hasData="hasData"
        :isFetching="isFetching"
        :isScanning="false"
        @fetch-infos="fetchInfos"
      />
      <LoadingSpinner v-if="isLoading" name="crescent" />
      <div v-if="season && !isLoading" class="season-details">
        <SeasonBanner :season="season" :serieId="Number(route.params.id)" :seasonNumber="Number(route.params.season)" />
        <ion-segment scrollable v-model="activeTab" class="season-tabs">
          <ion-segment-button value="details">Détails</ion-segment-button>
          <ion-segment-button value="episodes">Épisodes</ion-segment-button>
          <ion-segment-button value="voices">Voix FR</ion-segment-button>
        </ion-segment>
        <div v-if="activeTab === 'details'">
          <!-- Details Tab Content -->
          <div class="details-content">
            <div class="overview" v-if="season.overview">
              {{ season.overview }}
            </div>
          </div>
        </div>
        <div v-else-if="activeTab === 'episodes'">
          <!-- Episodes Tab Content -->
          <EpisodesList :episodes="season.episodes" :goToEpisode="goToEpisode" />
        </div>
        <div v-else-if="activeTab === 'voices'">
          <!-- Voices Tab Content -->
          <h3>{{ activeTab === 'voices' && season?.credits?.cast ? 'Voix françaises de la saison' : 'Voix françaises de l\'épisode' }}</h3>
          <ActorList
            :actors="normalizedActors"
            :voiceActors="[]"
            :isAdmin="false"
            :getVoiceActorByTmdbId="getVoiceActorByTmdbId"
            :goToActor="goToActor"
            :goToVoiceActor="goToVoiceActor"
            :editVoiceActorLink="editVoiceActorLink"
            :confirmDeleteVoiceActorLink="confirmDeleteVoiceActorLink"
            :openVoiceActorSearch="openVoiceActorSearch"
            :loading="isLoading"
          />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  toastController,
} from "@ionic/vue";
import { supabase } from "../api/supabase";
import SeasonBanner from "../components/SeasonBanner.vue";
import EpisodesList from "../components/EpisodesList.vue";
import ActionButtons from "../components/ActionButtons.vue";
import ActorList from "../components/ActorList.vue";
import LoadingSpinner from "../components/common/LoadingSpinner.vue";

const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const error = ref("");
const season = ref<any>(null);
const dbVoiceActors = ref<any[]>([]);
const episodeCredits = ref<any>(null);
const activeTab = ref("details");

const wikiDataId = computed(() => {
  return season.value?.external_ids?.wikidata_id;
});
const hasWikidataId = computed(() => !!wikiDataId.value);
const hasData = computed(() => {
  return dbVoiceActors.value.length > 0;
});
const isFetching = ref(false);

const normalizedActors = computed(() => {
  if (activeTab.value === 'voices') {
    if (season.value?.credits?.cast) {
      return season.value.credits.cast;
    } else if (episodeCredits.value?.cast) {
      return frenchActors(episodeCredits.value.cast);
    }
  }
  return [];
});

const getVoiceActorByTmdbId = (tmdbId: number) => {
  return dbVoiceActors.value.filter(
    (va) =>
      va.actor_id === tmdbId ||
      va.original_actor_id === tmdbId ||
      va.actorId === tmdbId
  );
};

async function fetchInfos() {
  const id = wikiDataId.value;
  if (!id) {
    console.error("id is undefined");
    return;
  }
  isFetching.value = true;
  try {
    const data = await supabase.functions.invoke("prepare_movie", {
      body: {
        tmdbId: route.params.id,
        type: "season",
        seasonNumber: route.params.season,
      },
    });
    if (data.ok) {
      location.reload();
    } else {
      toastController
        .create({
          message: data.error,
          duration: 2000,
          position: "top",
          color: "danger",
        })
        .then((toast) => {
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
  router.push({ name: "VoiceActorDetails", params: { id } });
}

function goToActor(id: number) {
  // Navigate to actor details if available, or do nothing
  console.log("Go to actor", id);
}

function editVoiceActorLink() {
  // Stub
}

function confirmDeleteVoiceActorLink() {
  // Stub
}

function openVoiceActorSearch() {
  // Stub
}

function goToEpisode(episodeNumber: number) {
  // Navigate to the dedicated episode route, or update the query param
  router.replace({
    name: "SeasonByEpisodes",
    params: {
      id: route.params.id,
      season: route.params.season,
      episode: episodeNumber,
    },
  });
}

function frenchActors(cast: any[]) {
  // Filter for French voice actors (dub), fallback to all if language not available
  return cast.filter(
    (a) =>
      a.known_for_department === "Acting" &&
      (!a.original_language || a.original_language === "fr")
  );
}

async function fetchData() {
  isLoading.value = true;
  error.value = "";
  try {
    const serieId = route.params.id;
    const seasonNumber = route.params.season;
    // Only fetch season data here
    const { data } = await supabase.functions.invoke("season", {
      body: { id: serieId, season_number: seasonNumber },
    });
    season.value = data.season;
    dbVoiceActors.value = data.db_voice_actors || [];
    if (!season.value) error.value = "Saison introuvable.";
  } catch (e: any) {
    error.value = e.message || "Erreur lors du chargement.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(fetchData);
watch(() => route.query.episode, fetchData);
</script>

<style lang="scss" scoped>
</style>
