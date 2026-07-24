<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ season?.name || "Détails de la saison" }}</AppTitle>
          <template #end>
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
        <div
          v-if="fetchError || (queueStatus === 'failed' && queueErrorMessage)"
          class="text-center text-red-500 mt-4"
        >
          {{ fetchError || queueErrorMessage }}
        </div>
        <LoadingSpinner v-if="isLoading" name="crescent" />
        <div v-if="season && !isLoading" class="season-details">
          <SeasonBanner
            :season="season"
            :serieId="Number(route.params.id)"
            :seasonNumber="Number(route.params.season)"
          />
          <AppSegment scrollable v-model="activeTab" class="season-tabs">
            <AppSegmentButton value="episodes" content-id="episodes">Épisodes</AppSegmentButton>
            <AppSegmentButton value="voices" content-id="voices">Voix</AppSegmentButton>
          </AppSegment>
          <AppSegmentView v-model:active-segment="activeTab">
            <AppSegmentContent class="segmented-content" id="episodes">
              <!-- Episodes Tab Content -->
              <EpisodesList
                :episodes="season.episodes"
                :goToEpisode="goToEpisode"
              />
            </AppSegmentContent>
            <AppSegmentContent class="segmented-content" id="voices">
              <!-- Voices Tab Content -->
              <DubbingProjectsView
                :contentId="route.params.id as string"
                contentType="tv"
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
            </AppSegmentContent>
          </AppSegmentView>
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
import AppSegment from "@/components/common/layout/AppSegment.vue";
import AppSegmentButton from "@/components/common/layout/AppSegmentButton.vue";
import AppSegmentView from "@/components/common/layout/AppSegmentView.vue";
import AppSegmentContent from "@/components/common/layout/AppSegmentContent.vue";
import { toastController } from "@/composables/useToast";
import { ref, computed, onMounted } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../api/supabase";
import { enqueueMedia } from "../api/mediaQueue";
import LoadingSpinner from "../components/common/LoadingSpinner.vue";
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import Info from "~icons/lucide/info";
import AppActionSheet, {
  ActionSheetButton,
} from "@/components/common/AppActionSheet.vue";
import SeasonBanner from "../components/SeasonBanner.vue";
import EpisodesList from "../components/EpisodesList.vue";
import DubbingProjectsView from "@/components/DubbingProjectsView.vue";
import AppButton from "@/components/common/AppButton.vue";
import { actorToPersonData } from "@/utils/convert";
import { findCharacter } from "@/utils/character";

const route = useRoute();
const router = useRouter();
const isLoading = ref(true);
const error = ref("");
const season = ref<{ name?: string; episodes?: unknown[] } | null>(null);
const dubbingProjects = ref<Array<{ id: number; works?: unknown[] }>>([]);
const characterProfilePictures = ref<any[]>([]);
const episodeCredits = ref<{ cast?: Array<{ id: number; name: string; character?: string }> } | null>(null);
const activeTab = ref("episodes");

const wikiDataId = computed(() => {
  return season.value?.external_ids?.wikidata_id;
});
const hasWikidataId = computed(() => !!wikiDataId.value);
const hasData = computed(() => {
  return dubbingProjects.value.some((p: { works?: unknown[] }) => p.works && p.works.length > 0);
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
      text: "Rajouter à la queue",
      icon: Info,
      handler: () => fetchInfos(),
    });
  }

  buttons.push({
    text: "Annuler",
    role: "cancel",
  });

  return buttons;
});

const normalizedActors = computed(() => {
  let castToMap: any[] = [];
  if (season.value?.credits?.cast) {
    castToMap = season.value.credits.cast;
  } else if (episodeCredits.value?.cast) {
    castToMap = frenchActors(episodeCredits.value.cast);
  }
  const mapped = castToMap.map((cast: any) => actorToPersonData(cast));

  for (const person of mapped) {
    for (const role of person.roles ?? []) {
      const image = characterProfilePictures.value.find((character) =>
        findCharacter(character, role),
      )?.image;
      role.image = image ?? "";
    }
  }

  return mapped;
});

const fetchQueueStatus = async () => {
  try {
    const { data: funcData, error: queueErr } = await supabase.functions.invoke(
      "media-queue",
      {
        body: {
          action: "status",
          mediaId: Number(route.params.id),
          mediaType: "season",
          seasonNumber: Number(route.params.season),
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

const handleRefresh = async (event: RefresherCustomEvent) => {
  try {
    await fetchData();
  } catch (error) {
    console.error("Error refreshing season data:", error);
  } finally {
    event.target.complete();
  }
};

async function fetchInfos() {
  isFetching.value = true;

  // Enqueue and fire-and-forget: the processor will pick it up in the background.
  // The user is informed via a toast and can refresh the page later to see results.
  try {
    await enqueueMedia({
      tmdbId: Number(route.params.id),
      mediaType: "season",
      seasonNumber: Number(route.params.season),
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
  router.push({ name: "voice-actor-details", params: { id } });
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
  router.push({
    name: "SeasonByEpisodes",
    params: {
      id: route.params.id,
      season: route.params.season,
      episode: episodeNumber,
    },
  });
}

function frenchActors(cast: Array<{ id: number; name: string; roles?: Array<{ character?: string }> }>) {
  // Filter for French voice actors (dub), fallback to all if language not available
  return cast.filter(
    (a) =>
      a.known_for_department === "Acting" &&
      (!a.original_language || a.original_language === "fr"),
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
    characterProfilePictures.value = data.characterProfilePictures || [];
    if (!season.value) error.value = "Saison introuvable.";

    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message || "Erreur lors du chargement.";
  } finally {
    isLoading.value = false;
  }
}

onMounted(async () => {
  await fetchData();
});
</script>
