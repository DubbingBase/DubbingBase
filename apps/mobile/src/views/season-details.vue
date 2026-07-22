<template>
  <ion-page>
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <template #start >
          <AppBackButton />
        </template>
        <AppTitle>{{ season?.name || "Détails de la saison" }}</AppTitle>
        <template #end>
          <AppButton fill="clear" @click="isActionSheetOpen = true" aria-label="Menu">
            <EllipsisVertical class="app-icon" />
          </AppButton>
        </template>
      </AppToolbar>
    </AppHeader>
    <AppContent>
      
      <div v-if="fetchError || (queueStatus === 'failed' && queueErrorMessage)" class="text-center text-red-500 mt-4">
        {{ fetchError || queueErrorMessage }}
      </div>
      <LoadingSpinner v-if="isLoading" name="crescent" />
      <div v-if="season && !isLoading" class="season-details">
        <SeasonBanner :season="season" :serieId="Number(route.params.id)" :seasonNumber="Number(route.params.season)" />
        <AppSegment scrollable v-model="activeTab" class="season-tabs">
          <AppSegmentButton value="details">Détails</AppSegmentButton>
          <AppSegmentButton value="episodes">Épisodes</AppSegmentButton>
          <AppSegmentButton value="voices">Voix FR</AppSegmentButton>
        </AppSegment>
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
          <DubbingProjectsView
            :contentId="route.params.seasonId as string"
            contentType="season"
            :projects="dubbingProjects"
            :actors="normalizedActors"
            :isAdmin="false"
            :goToActor="goToActor"
            :goToVoiceActor="goToVoiceActor"
            :editVoiceActorLink="editVoiceActorLink"
            :confirmDeleteVoiceActorLink="confirmDeleteVoiceActorLink"
            :openVoiceActorSearch="openVoiceActorSearch"
            :parentLoading="isLoading"
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
import AppPage from '@/components/common/layout/AppPage.vue';
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import AppSegment from '@/components/common/layout/AppSegment.vue';
import AppSegmentButton from '@/components/common/layout/AppSegmentButton.vue';
import { toastController } from '@/composables/useToast';
import { ref, computed, onMounted } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRoute, useRouter } from 'vue-router';
import { supabase } from "../api/supabase";
import { enqueueAndProcessMedia } from "../api/mediaQueue";
import LoadingSpinner from "../components/common/LoadingSpinner.vue";
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import Info from "~icons/lucide/info";
import AppActionSheet, { ActionSheetButton } from "@/components/common/AppActionSheet.vue";
import SeasonBanner from "../components/SeasonBanner.vue";
import EpisodesList from "../components/EpisodesList.vue";
import DubbingProjectsView from "@/components/DubbingProjectsView.vue";
import AppButton from "@/components/common/AppButton.vue";

const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const error = ref("");
const season = ref<any>(null);
const dubbingProjects = ref<any[]>([]);
const episodeCredits = ref<any>(null);
const activeTab = ref("details");

const wikiDataId = computed(() => {
  return season.value?.external_ids?.wikidata_id;
});
const hasWikidataId = computed(() => !!wikiDataId.value);
const hasData = computed(() => {
  return dubbingProjects.value.some((p: any) => p.works && p.works.length > 0);
});
const isFetching = ref(false);
const queueStatus = ref<string | null>(null);
const queueErrorMessage = ref<string | null>(null);
const fetchError = ref("");

const isActionSheetOpen = ref(false);
const actionSheetButtons = computed<ActionSheetButton[]>(() => {
  const buttons: ActionSheetButton[] = [];

  if (hasWikidataId.value && !hasData.value) {
    buttons.push({
      text: 'Récupérer les infos',
      icon: Info,
      handler: () => fetchInfos(),
    });
  }

  buttons.push({
    text: 'Annuler',
    role: 'cancel',
  });

  return buttons;
});

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


const fetchQueueStatus = async () => {
  try {
    const { data: funcData, error: queueErr } = await supabase.functions.invoke("media-queue", {
      body: {
        action: "status",
        mediaId: Number(route.params.id),
        mediaType: "season",
        seasonNumber: Number(route.params.season)
      }
    });
    
    const data = funcData?.data;
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

const handleRefresh = async (event: any) => {
  try {
    await fetchData();
  } catch (error) {
    console.error("Error refreshing season data:", error);
  } finally {
    event.target.complete();
  }
};

async function fetchInfos() {
  const id = wikiDataId.value;
  if (!id) {
    console.error("id is undefined");
    return;
  }
  isFetching.value = true;

  // Enqueue and fire-and-forget: the processor will pick it up in the background.
  // The user is informed via a toast and can refresh the page later to see results.
  try {
    await enqueueAndProcessMedia({
      tmdbId: Number(route.params.id),
      mediaType: "season",
      seasonNumber: Number(route.params.season),
    });
    // Refresh queue status so the UI reflects the pending state
    await fetchQueueStatus();
    const toast = await toastController.create({
      message: "Added to queue! Check back in a moment to see the updated voice cast.",
      duration: 4000,
      position: "top",
      color: "success",
    });
    await toast.present();
  } catch (err) {
    console.error("Error enqueueing season:", err);
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
    
    const seasonResponse = await supabase.functions.invoke("season", {
      body: { id: serieId, season_number: seasonNumber },
    });

    const data = seasonResponse.data;
    season.value = data.season;
    dubbingProjects.value = data.dubbingProjects || [];
    if (!season.value) error.value = "Saison introuvable.";

    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (e: any) {
    error.value = e.message || "Erreur lors du chargement.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  await fetchData();
});
</script>


