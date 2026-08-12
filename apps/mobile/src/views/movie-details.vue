<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ movie?.title ?? "" }}</AppTitle>
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
        <MediaInfoCard :media="movie" />

        <CollectionCard v-if="collection" :collection="collection" />

        <DubbingProjectsView
          :contentId="route.params.id as string"
          contentType="movie"
          :projects="dubbingProjects"
          :actors="actors"
          :is-admin="isAdmin"
          :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
          :go-to-actor="goToActor"
          :go-to-voice-actor="goToVoiceActor"
          :edit-voice-actor-link="editVoiceActorLink"
          :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
          :open-voice-actor-search="openVoiceActorSearch"
          :mediaLanguage="movie?.original_language"
          :parentLoading="isLoading"
        />

        <div
          v-if="fetchError || (queueStatus === 'failed' && queueErrorMessage)"
          class="text-center text-red-500 mt-4"
        >
          {{ fetchError || queueErrorMessage }}
        </div>
      </AppContent>

      <PersonSearchModal
        :is-open="showVoiceActorSearch"
        :media-id="route.params.id as string"
        :work-type="'movie'"
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
        :work-type="'movie'"
        @close="showCreditsReview = false"
        @refresh="handleRefresh"
      />

      <AppActionSheet
        v-model:is-open="isActionSheetOpen"
        :buttons="actionSheetButtons"
      />
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
import { toastController, useToast } from "@/composables/useToast";
import { alertController } from "@/composables/useAlert";
import AppButton from "@/components/common/AppButton.vue";
import { computed, ref, onMounted, watch } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRoute, useRouter } from "vue-router";
import Share2 from "~icons/lucide/share-2";
import Camera from "~icons/lucide/camera";
import List from "~icons/lucide/list";
import Info from "~icons/lucide/info";
import Pencil from "~icons/lucide/pencil";
import Plus from "~icons/lucide/plus";
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import RefreshCw from "~icons/lucide/refresh-cw";
import { Share } from "@capacitor/share";
import AppActionSheet, {
  ActionSheetButton,
} from "@/components/common/AppActionSheet.vue";

import { supabase } from "../api/supabase";
import { enqueueMedia } from "../api/mediaQueue";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { useDeferredCharacters } from "@/composables/useDeferredCharacters";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import MediaInfoCard from "@/components/MediaInfoCard.vue";
import DubbingProjectsView from "@/components/DubbingProjectsView.vue";
import CollectionCard from "@/components/CollectionCard.vue";
import PersonSearchModal from "@/components/PersonSearchModal.vue";
import CreditsReviewModal from "@/components/CreditsReviewModal.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";

import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { Role } from "@/components/PersonItem.vue";
import { useI18n } from "vue-i18n";

// Import new types
import type {
  MovieMedia,
  Collection,
  DubbingProject,
  CharacterProfilePicture,
  VoteData,
  MovieDetailResponse,
} from "@supabase/functions/_shared/movie";

const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const { t } = useI18n();
const { showToast } = useToast();

const route = useRoute();
const router = useRouter();

const goToAddProject = () => {
  router.push({
    path: "/edit-dubbing-project/new",
    query: { contentId: route.params.id, contentType: "movie" },
  });
};

const isActionSheetOpen = ref(false);
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

  if (isAdmin.value) {
    buttons.push({
      text: t("common.scan", "Scanner"),
      icon: Camera,
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

// Initialize voice actor management
const {
  // State
  showVoiceActorSearch,
  voiceActors,
  isLoading,
  votes: sharedVotes,

  // Methods
  getVoiceActorByTmdbId,
  openVoiceActorSearch,
  linkVoiceActor,
  editVoiceActorLink,
  confirmDeleteVoiceActorLink,
  goToVoiceActor,
  goToActor,
  castVote,
  refreshVotes,
} = useVoiceActorManagement("movie");

// State - use new lean types
const movie = ref<MovieMedia | undefined>();
const collection = ref<Collection | null>(null);
const dubbingProjects = ref<DubbingProject[]>([]);
const queueStatus = ref<string | null>(null);
const queueErrorMessage = ref<string | null>(null);

const characterProfilePictures = ref<CharacterProfilePicture[]>([]);

const { actors } = useDeferredCharacters(
  () => movie.value?.credits?.cast,
  characterProfilePictures,
  { deduplicateRolesByImage: true },
);

const wikiDataId = computed(() => {
  return movie.value?.external_ids?.wikidata_id;
});

const hasWikidataId = computed(() => {
  return !!wikiDataId.value;
});

const hasData = computed(() => {
  return dubbingProjects.value.some(
    (p: DubbingProject) => p.works && p.works.length > 0,
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

const isFetching = ref(false);
const fetchError = ref("");

const fetchQueueStatus = async () => {
  try {
    const { data: funcData, error } = await supabase.functions.invoke(
      "media-queue",
      {
        body: {
          action: "status",
          mediaId: Number(route.params.id),
          mediaType: "movie",
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
  if (!movie.value) return;
  const url = `dubbingbase://movie/${movie.value.id}`;
  try {
    await Share.share({
      title: movie.value.title || "DubbingBase",
      text: `Check out ${movie.value.title} on DubbingBase!`,
      url: url,
      dialogTitle: "Share Movie",
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

const handleRefresh = async (event: RefresherCustomEvent) => {
  try {
    await fetchMovieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (error) {
    console.error("Error refreshing movie data:", error);
  } finally {
    event.target.complete();
  }
};

const handleEnqueue = async () => {
  console.log("handleEnqueue called in movie-details");

  isFetching.value = true;
  fetchError.value = "";
  console.log("Calling enqueueMedia for TMDB ID", route.params.id);

  try {
    await enqueueMedia({
      tmdbId: Number(route.params.id),
      mediaType: "movie",
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
      mediaType: "movie",
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
    console.error("Error enqueueing movie:", err);
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

const fetchMovieData = async () => {
  const id = route.params.id;
  try {
    const movieResponseRaw = await supabase.functions.invoke<MovieDetailResponse>(
      "movie",
      {
        body: { id },
      },
    );
    const data = movieResponseRaw.data;
    if (data) {
      // New response uses 'media' key instead of 'movie'
      movie.value = data.media;
      dubbingProjects.value = data.dubbingProjects || [];
      if (data.characterProfilePictures) {
        characterProfilePictures.value = data.characterProfilePictures;
      }
      if (data.collection) {
        collection.value = data.collection;
      }

      // Hydrate shared votes store
      if (data.votes) {
        sharedVotes.value = {
          ...sharedVotes.value,
          ...data.votes,
        };
      }
    }
  } catch (e: unknown) {
    console.error("Error fetching movie data:", e);
    fetchError.value = "Failed to load movie details.";
  }
};

onMounted(async () => {
  const newId = route.params.id;
  if (!newId) return;
  isLoading.value = true;
  fetchError.value = "";
  try {
    await fetchMovieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (e: unknown) {
    console.error("Error fetching movie data:", e);
    fetchError.value = "Failed to load movie details.";
  } finally {
    isLoading.value = false;
  }
});
</script>
