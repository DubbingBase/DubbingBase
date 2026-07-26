<template>
  <ion-page>
    <AppPage>
      <AppHeader class="header">
        <AppToolbar class="toolbar">
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ show?.name || "Détails de la série" }}</AppTitle>
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
        <MediaInfoCard :media="show" />

        <LoadingSpinner v-if="isLoading" />

        <div class="tabs" v-show="!isLoading">
          <AppSegment v-model="selectedSegment" scrollable>
            <AppSegmentButton value="peoples" content-id="peoples">
              <!-- <Search class="app-icon" /> -->
              Personnes
            </AppSegmentButton>
            <AppSegmentButton value="seasons" content-id="seasons">
              Saisons
            </AppSegmentButton>
          </AppSegment>
          <AppSegmentView v-model:active-segment="selectedSegment">
            <AppSegmentContent
              class="segmented-content"
              id="peoples"
              :class="{ 'is-active': selectedSegment === 'peoples' }"
            >
              <DubbingProjectsView
                :contentId="route.params.id as string"
                contentType="tv"
                :projects="dubbingProjects"
                :actors="actors"
                :is-admin="isAdmin"
                :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
                :go-to-actor="goToActor"
                :go-to-voice-actor="goToVoiceActor"
                :edit-voice-actor-link="editVoiceActorLink"
                :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
                :open-voice-actor-search="openVoiceActorSearch"
                :mediaLanguage="show?.original_language"
                :parentLoading="isLoading"
              />
            </AppSegmentContent>
            <AppSegmentContent
              class="segmented-content"
              id="seasons"
              :class="{ 'is-active': selectedSegment === 'seasons' }"
            >
              <div class="seasons-section" v-if="show">
                <div class="seasons">
                  <div
                    expand="block"
                    @click="goToSeason(show.id, season.season_number)"
                    class="season"
                    v-for="season in formattedSeasons"
                    :key="season.id"
                  >
                    <MediaThumbnail :path="season.poster_path"></MediaThumbnail>
                    <div class="text">
                      <div class="season-title">{{ season.name }}</div>
                      <div class="season-subtitle">
                        {{ season.formatted_air_date }} &sdot;
                        {{ season.episode_count }} épisodes
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AppSegmentContent>
          </AppSegmentView>
        </div>

        <LoadingSpinner v-if="isLoading" />
        <div
          v-if="fetchError || (queueStatus === 'failed' && queueErrorMessage)"
          class="text-center text-red-500 mt-4"
        >
          {{ fetchError || queueErrorMessage }}
        </div>

        <PersonSearchModal
          :is-open="showVoiceActorSearch"
          :media-id="route.params.id as string"
          :work-type="'tv'"
          :link-voice-actor="linkVoiceActor"
          @close="showVoiceActorSearch = false"
          @create-new="
            (query) =>
              router.push({
                path: '/voice-actor-profile/new',
                query: { name: query },
              })
          "
        />

        <CreditsReviewModal
          :is-open="showCreditsReview"
          :extracted-credits="extractedCredits"
          :movie-actors="actors"
          :media-id="route.params.id as string"
          :work-type="'serie'"
          @close="showCreditsReview = false"
          @refresh="handleRefresh"
        />

        <AppActionSheet
          v-model:is-open="isActionSheetOpen"
          :buttons="actionSheetButtons"
        />
      </AppContent>
    </AppPage>
  </ion-page>
</template>

<script setup lang="ts">
import { IonRefresher, IonRefresherContent } from "@ionic/vue";
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
import { toastController, useToast } from "@/composables/useToast";
import AppButton from "@/components/common/AppButton.vue";
import Settings from "~icons/lucide/settings";
import CameraIcon from "~icons/lucide/camera";
import List from "~icons/lucide/list";
import Info from "~icons/lucide/info";
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import Pencil from "~icons/lucide/pencil";
import Plus from "~icons/lucide/plus";
import { Share } from "@capacitor/share";
import AppActionSheet, {
  ActionSheetButton,
} from "@/components/common/AppActionSheet.vue";
import { ref, computed, UnwrapRef, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { format } from "date-fns";
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import MediaInfoCard from "@/components/MediaInfoCard.vue";
import MediaItem from "@/components/MediaItem.vue";
import DubbingProjectsView from "@/components/DubbingProjectsView.vue";
import PersonSearchModal from "@/components/PersonSearchModal.vue";
import CreditsReviewModal from "@/components/CreditsReviewModal.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { useDeferredCharacters } from "@/composables/useDeferredCharacters";
import { findCharacter } from "@/utils/character";
import Share2 from "~icons/lucide/share-2";
// Removed unused imports
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/api/supabase";
import { enqueueMedia } from "@/api/mediaQueue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { Role } from "@/components/PersonItem.vue";
import { useI18n } from "vue-i18n";
import { ShowResponse } from "@supabase/functions/_shared/types";

const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const { t } = useI18n();
const { showToast } = useToast();

const route = useRoute();
const router = useRouter();

const isActionSheetOpen = ref(false);

const goToAddProject = () => {
  router.push({
    path: "/edit-dubbing-project/new",
    query: { contentId: route.params.id, contentType: "tv" },
  });
};

const actionSheetButtons = computed<ActionSheetButton[]>(() => {
  const buttons: ActionSheetButton[] = [
    {
      text: t("common.share", "Partager"),
      icon: Share2,
      handler: () => shareMedia(),
    },
  ];

  if (isAdmin.value) {
    buttons.push({
      text: t("movie.addDubbingProject", "Create Dubbing Project"),
      icon: Plus,
      handler: goToAddProject,
      cssClass: "action-sheet-admin",
    });
  }

  if (isAdmin.value && !hasData.value) {
    buttons.push({
      text: t("common.scan", "Scanner"),
      icon: CameraIcon,
      handler: () => takePhoto(),
      cssClass: "action-sheet-admin",
    });
  }

  if (hasWikidataId.value && !hasData.value) {
    buttons.push({
      text: t("common.fetchInfos", "Rajouter à la queue"),
      icon: Info,
      handler: () => fetchInfos(),
    });
  }

  buttons.push({
    text: t("common.cancel", "Annuler"),
    role: "cancel",
  });

  return buttons;
});

const show = ref<ShowResponse["serie"] | undefined>();
const dubbingProjects = ref<Array<{ id: number; works?: unknown[] }>>([]);
const isLoading = ref(true);
const isFetching = ref(false);
const fetchError = ref("");
const error = ref("");
const queueStatus = ref<string | null>(null);
const queueErrorMessage = ref<string | null>(null);

const characterProfilePictures = ref<
  {
    id: number;
    name: string;
    image: string;
    tvdbPeopleId: number;
    showId: number;
  }[]
>([]);

// Initialize voice actor management
const {
  // State
  showVoiceActorSearch,
  voiceActors,
  votes: sharedVotes,

  // Methods
  getVoiceActorByTmdbId,
  openVoiceActorSearch,
  linkVoiceActor,
  editVoiceActorLink,
  confirmDeleteVoiceActorLink,
  goToVoiceActor,
} = useVoiceActorManagement("tv");

const { actors } = useDeferredCharacters(
  () => show.value?.credits?.cast,
  characterProfilePictures,
  { deduplicateRolesByImage: true }
);

// Voice actor methods are now provided by the composable

const wikiDataId = computed(() => {
  return show.value?.external_ids?.wikidata_id;
});

const hasWikidataId = computed(() => {
  return !!wikiDataId.value;
});

const hasData = computed(() => {
  return dubbingProjects.value.some(
    (p: { works?: unknown[] }) => p.works && p.works.length > 0,
  );
});

const formattedSeasons = computed(() => {
  if (!show.value?.seasons) return [];

  return show.value?.seasons?.map(
    (season: { season_number: number; name: string }) => ({
      ...season,
      formatted_air_date: season.air_date
        ? format(new Date(season.air_date), "MMM dd, yyyy")
        : "TBA",
    }),
  );
});

// Scan functionality
const isScanning = ref(false);
const scanResult = ref("");
const showScanResult = ref(false);

watch(showScanResult, (newVal) => {
  if (newVal) {
    showToast(scanResult.value, 3000);
    showScanResult.value = false;
  }
});

const showCreditsReview = ref(false);
const extractedCredits = ref<
  Array<{
    actor: string;
    role: string;
    voiceActor: string;
    matchedActorId?: number | null;
  }>
>([]);

const shareMedia = async () => {
  if (!show.value) return;
  const url = `dubbingbase://serie/${show.value.id}`;
  try {
    await Share.share({
      title: show.value.name || "DubbingBase",
      text: `Check out ${show.value.name} on DubbingBase!`,
      url: url,
      dialogTitle: "Share Series",
    });
  } catch (err) {
    console.error("Error sharing:", err);
    try {
      await navigator.clipboard.writeText(url);
      const toast = await toastController.create({
        message: "Link copied to clipboard!",
        duration: 2000,
        position: "top",
        color: "success",
      });
      await toast.present();
    } catch (clipboardErr) {
      console.error("Failed to copy to clipboard:", clipboardErr);
      const errToast = await toastController.create({
        message: "Failed to copy link.",
        duration: 2000,
        position: "top",
        color: "danger",
      });
      await errToast.present();
    }
  }
};

const takePhoto = async () => {
  try {
    isScanning.value = true;

    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = (e) => {
        const target = e.target as HTMLInputElement;
        resolve(target.files?.[0] || null);
      };

      input.addEventListener("cancel", () => resolve(null));

      window.addEventListener(
        "focus",
        () => {
          setTimeout(() => {
            if (!input.value) resolve(null);
          }, 1000);
        },
        { once: true },
      );

      input.click();
    });

    if (!file) {
      isScanning.value = false;
      return;
    }

    const formData = new FormData();
    formData.append("image", file, file.name || "image.jpg");

    // Provide known actors to the AI
    const simplifiedActors =
      actors.value?.map(
        (a: {
          id?: number;
          name?: string;
          roles?: { character?: string }[];
        }) => ({
          id: a.id,
          name: a.name,
          roles: a.roles?.map((r: { character?: string }) => r.character) || [],
        }),
      ) || [];
    formData.append("actors", JSON.stringify(simplifiedActors));

    const response = await supabase.functions.invoke(
      "extract-credits-from-image",
      {
        body: formData,
      },
    );

    if (response.data.ok) {
      extractedCredits.value = response.data.result || [];
      showCreditsReview.value = true;
      scanResult.value = "Credits extracted successfully!";
      showScanResult.value = true;
    } else {
      scanResult.value = response.data.error || "Error extracting credits.";
      showScanResult.value = true;
    }
  } catch (error) {
    console.error("Error taking photo:", error);
    scanResult.value = "Error capturing image. Please try again.";
    showScanResult.value = true;
  } finally {
    isScanning.value = false;
  }
};

const getSerie = async (id: string) => {
  try {
    const response = await supabase.functions.invoke<ShowResponse>("show", {
      body: { id },
    });
    return response;
  } catch (e: unknown) {
    console.error("Error fetching series data:", e);
    fetchError.value = "Failed to load series details.";
    throw e;
  }
};

const fetchSerieData = async () => {
  const id = route.params.id;
  try {
    const response = await getSerie(id as string);
    if (response.data) {
      show.value =
        response.data.serie || (response.data as { show?: unknown }).show; // Handle both response formats
      show.value.credits = response.data.aggregateCredits;
      if (response.data.characterProfilePictures) {
        characterProfilePictures.value = response.data.characterProfilePictures;
      }
      dubbingProjects.value = response.data.dubbingProjects || [];
      if ((response.data as { votes?: Record<string, number> }).votes) {
        sharedVotes.value = {
          ...sharedVotes.value,
          ...(response.data as { votes?: Record<string, number> }).votes,
        };
      }
    }
  } catch (e: unknown) {
    console.error("Error fetching serie data:", e);
    fetchError.value = "Failed to load serie details.";
    throw e;
  }
};

const fetchQueueStatus = async () => {
  try {
    const { data: funcData, error } = await supabase.functions.invoke(
      "media-queue",
      {
        body: {
          action: "status",
          mediaId: Number(route.params.id),
          mediaType: "tv",
        },
      },
    );

    const data = funcData?.data;
    if (error) throw error;
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

const selectedSegment = ref("peoples");

const handleRefresh = async (event: RefresherCustomEvent) => {
  try {
    await fetchSerieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (error) {
    console.error("Error refreshing serie data:", error);
  } finally {
    event.target.complete();
  }
};

const handleEnqueue = async () => {
  console.log("handleEnqueue called in serie-details");

  isFetching.value = true;
  fetchError.value = "";
  console.log("Calling enqueueMedia for TMDB ID", route.params.id);

  try {
    await enqueueMedia({
      tmdbId: Number(route.params.id),
      mediaType: "tv",
    });

    // Refresh queue status to show it's pending
    await fetchQueueStatus();

    const toast = await toastController.create({
      message: "Added to processing queue! It will be processed automatically.",
      duration: 3000,
      position: "top",
      color: "success",
    });
    await toast.present();
  } catch (err) {
    console.error("Error enqueuing media:", err);
    fetchError.value = "Failed to add to queue.";
    const toast = await toastController.create({
      message: "Queue addition failed. Please try again.",
      duration: 3000,
      position: "top",
      color: "danger",
    });
    await toast.present();
  } finally {
    isFetching.value = false;
  }
};

const fetchInfos = async () => {
  isFetching.value = true;
  fetchError.value = "";

  // Enqueue and fire-and-forget: the processor will pick it up in the background.
  // The user is informed via a toast and can refresh the page later to see results.
  try {
    await enqueueMedia({
      tmdbId: Number(route.params.id),
      mediaType: "tv",
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
    console.error("Error enqueueing series:", err);
    fetchError.value = "Failed to add to queue.";
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
};

onMounted(async () => {
  const newId = route.params.id;
  if (!newId) return;
  isLoading.value = true;
  fetchError.value = "";
  try {
    await fetchSerieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (err) {
    console.error("Error fetching serie:", err);
    fetchError.value = "Failed to load serie details";
  } finally {
    isLoading.value = false;
  }
});

// Navigation methods
const goToSeason = (id: number, seasonNumber: number) => {
  router.push({
    name: "SeasonDetails",
    params: {
      id: id,
      season: seasonNumber,
    },
  });
};

const goToActor = (id: number) => {
  router.push({
    name: "ActorDetails",
    params: { id },
  });
};
</script>

<style scoped lang="scss">
$coverHeight: 150px;
$block: #1d1d1d;
$background: #1b1b1b;
$border: #1b1b1b;

.show-title {
  text-align: center;
}

.background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: $coverHeight;

  img {
    object-fit: cover;
    width: 100%;
    height: 100%;
  }
}

.banner-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;

  :deep(.media-item) {
    width: 100%;
    height: 100%;
    border-radius: 0;
    padding: 0;
    margin: 0;
  }

  :deep(.poster) {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }

  :deep(.poster img) {
    width: 100%;
    height: 100%;
    border-radius: 0;
    object-fit: cover;
  }

  :deep(.caption) {
    display: none; // Hide caption in banner context
  }
}

.tabs {
  z-index: 1;
  position: relative;
}

.summary {
  background-color: #{$block};
}

AppSegment {
  --background: #{$block};
  border-radius: 0;
}

.segmented-content {
  background-color: #{$background};
}



.seasons {
  margin: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .season {
    display: flex;
    flex-direction: row;
    gap: 16px;
    background-color: #{$block};
    border-radius: 8px;
    border: 2px solid #{$border};
    padding: 8px;
    color: var(--app-color-text-primary, #ffffff);
    cursor: pointer;
    transition: background-color 0.2s;

    &:active {
      background-color: var(--app-overlay-5);
    }

    .text {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .season-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .season-subtitle {
      font-size: 14px;
      color: var(--app-color-text-muted, #8e8e8e);
    }
  }
}

.toolbar {
  --background: transparent !important;
  --border-width: 0 !important;
}
</style>
