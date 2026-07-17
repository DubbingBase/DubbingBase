<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <AppBackButton />
        </ion-buttons>
        <ion-title>{{ movie?.title ?? "" }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="shareMedia" aria-label="Share">
            <Share2 class="app-icon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <MediaInfoCard :media="movie" />

      <ActorList
        :actors="actors"
        :voice-actors="voiceActors"
        :is-admin="isAdmin"
        :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
        :go-to-actor="goToActor"
        :go-to-voice-actor="goToVoiceActor"
        :edit-voice-actor-link="editVoiceActorLink"
        :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
        :open-voice-actor-search="openVoiceActorSearch"
        :loading="isLoading"
        :mediaLanguage="movie?.original_language"
        :workType="'movie'"
        :contentId="route.params.id as string"
      />

      <ActionButtons
        :has-wikidata-id="hasWikidataId"
        :has-data="hasData"
        :is-fetching="isFetching"
        :is-scanning="isScanning"
        :fetch-error="fetchError"
        :queue-status="queueStatus"
        :queue-error-message="queueErrorMessage"
        @fetch-infos="fetchInfos"
        @enqueue="handleEnqueue"
        @take-photo="takePhoto"
      />
      <LoadingSpinner v-if="isLoading" />
    </ion-content>

    <ion-toast
      :is-open="showScanResult"
      :message="scanResult"
      :duration="3000"
      @didDismiss="showScanResult = false"
    ></ion-toast>

    <VoiceActorSearchModal
      :is-open="showVoiceActorSearch"
      :media-id="route.params.id as string"
      :work-type="'movie'"
      :link-voice-actor="linkVoiceActor"
      @close="showVoiceActorSearch = false"
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
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton, IonButtons, IonButton, toastController, IonToast, IonRefresher, IonRefresherContent } from '@ionic/vue';
import { computed, ref, UnwrapRef, watch } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRoute, useRouter } from "vue-router";
import Share2 from '~icons/lucide/share-2';
import { Share } from '@capacitor/share';

import { MovieResponse } from "@supabase/functions/_shared/movie";
import { supabase } from "../api/supabase";
import { enqueueAndProcessMedia, enqueueMedia } from "../api/mediaQueue";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import MediaInfoCard from "@/components/MediaInfoCard.vue";
import ActorList from "@/components/ActorList.vue";
import ActionButtons from "@/components/ActionButtons.vue";
import VoiceActorSearchModal from "@/components/VoiceActorSearchModal.vue";
import CreditsReviewModal from "@/components/CreditsReviewModal.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import MediaItem from "@/components/MediaItem.vue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { Role } from "@/components/PersonItem.vue";
import { useI18n } from "vue-i18n";

const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

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

const movie = ref<MovieResponse["movie"] | undefined>();
const queueStatus = ref<string | null>(null);
const queueErrorMessage = ref<string | null>(null);

const characterProfilePictures = ref<
  {
    id: number;
    name: string | null;
    image: string;
    tvdbPeopleId: number;
    showId: number;
  }[]
>([]);

const findCharacter = (
  character: UnwrapRef<typeof characterProfilePictures>[number],
  role: Role,
) => {
  // console.log("character", character);
  // console.log("role", role);
  const characterName = character.name?.toLowerCase();
  const roleName = role.character.toLowerCase();

  const allNames = characterName?.split("/").map((name) => name.trim());
  // console.log("allNames", allNames);

  const allRoleNames = roleName.split("/").map((name) => name.trim());
  // console.log("allRoleNames", allRoleNames);

  // Loop through allNames and allRoleNames to find at least one correspondence
  for (const name of allNames ?? []) {
    for (const roleName of allRoleNames) {
      // Direct name matching
      if (
        name === roleName ||
        name.includes(roleName) ||
        roleName.includes(name)
      ) {
        return true;
      }

      // Simplified name matching for current pair
      const simplifiedName = name.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");
      const simplifiedRoleName = roleName.replace(
        /(.*)( '?.*' ?)(.*)/,
        "$1 $3",
      );

      if (
        simplifiedName.includes(roleName) ||
        name.includes(simplifiedRoleName) ||
        simplifiedName.includes(simplifiedRoleName)
      ) {
        return true;
      }
    }
  }

  // console.log("characterName", characterName);
  // console.log("roleName", roleName);

  const simplifiedName = characterName?.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");
  // console.log("simplifiedName", simplifiedName);

  const simplifiedRoleName = roleName.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");
  // console.log("simplifiedRoleName", simplifiedRoleName);

  return (
    characterName?.includes(roleName) ||
    simplifiedName?.includes(roleName) ||
    characterName?.includes(simplifiedRoleName) ||
    simplifiedName?.includes(simplifiedRoleName)
  );
};

const actors = computed(() => {
  return movie.value?.credits?.cast?.map((cast) => {
    // console.log("cast", cast);
    const person = actorToPersonData(cast);

    for (const role of person.roles ?? []) {
      const image = characterProfilePictures.value.find((character) =>
        findCharacter(character, role),
      )?.image;
      role.image = image ?? "";
    }

    person.roles =
      person.roles?.filter(
        (role, index, self) =>
          index === self.findIndex((r) => r.image === role.image),
      ) ?? [];

    return person;
  });
});

const wikiDataId = computed(() => {
  return movie.value?.external_ids?.wikidata_id;
});

const hasWikidataId = computed(() => {
  return !!wikiDataId.value;
});

const hasData = computed(() => {
  return voiceActors.value.length > 0;
});

// Scan functionality
const isScanning = ref(false);
const scanResult = ref("");
const showScanResult = ref(false);

const isFetching = ref(false);
const fetchError = ref("");

const fetchQueueStatus = async () => {
  try {
    const { data, error } = await supabase
      .rpc("get_media_queue_status", {
        p_tmdb_id: Number(route.params.id),
        p_media_type: "movie"
      });
    if (error) throw error;
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

const showCreditsReview = ref(false);
const extractedCredits = ref<Array<{actor: string, role: string, voiceActor: string, matchedActorId?: number | null}>>([]);

const shareMedia = async () => {
  if (!movie.value) return;
  await Share.share({
    title: movie.value.title || "DubbingBase",
    text: `Check out ${movie.value.title} on DubbingBase!`,
    url: `dubbingbase://movie/${movie.value.id}`,
    dialogTitle: 'Share Movie',
  });
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
      
      window.addEventListener("focus", () => {
        setTimeout(() => {
          if (!input.value) resolve(null);
        }, 1000);
      }, { once: true });
      
      input.click();
    });

    if (!file) {
      isScanning.value = false;
      return;
    }

    const formData = new FormData();
    formData.append("image", file, file.name || "image.jpg");
    
    // Provide known actors to the AI
    const simplifiedActors = actors.value?.map((a: any) => ({
      id: a.id,
      name: a.name,
      roles: a.roles?.map((r: any) => r.character) || [],
    })) || [];
    formData.append("actors", JSON.stringify(simplifiedActors));

    const response = await supabase.functions.invoke("extract-credits-from-image", {
      body: formData,
    });

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

const handleRefresh = async (event?: any) => {
  try {
    await fetchMovieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (error) {
    console.error("Error refreshing movie data:", error);
  } finally {
    event?.target?.complete();
  }
};

const handleEnqueue = async () => {
  console.log("handleEnqueue called in movie-details");
  if (!wikiDataId.value) {
    console.log("wikiDataId is null, returning early");
    return;
  }

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
  const id = wikiDataId.value;

  if (!id) {
    console.error("id is undefined");
    return;
  }

  console.log("id", id);
  isFetching.value = true;
  fetchError.value = "";

  // Fetch details and trigger processing directly
  try {
    await enqueueAndProcessMedia({
      tmdbId: Number(route.params.id),
      mediaType: "movie",
    });
    // Immediately fetch updated movie data to display changes
    await fetchMovieData();
    const toast = await toastController.create({
      message: "Import completed successfully! The voice cast has been updated.",
      duration: 3000,
      position: "top",
      color: "success",
    });
    await toast.present();
  } catch (err) {
    console.error("Error fetching movie data:", err);
    fetchError.value = "Failed to fetch media details.";
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
};

const fetchMovieData = async () => {
  const id = route.params.id;
  try {
    const movieResponseRaw = await supabase.functions.invoke<MovieResponse>("movie", {
      body: { id },
    });
    const data = movieResponseRaw.data;
    if (data) {
      movie.value = data.movie;
      console.log("data.voiceActors", data.voiceActors);
      voiceActors.value = data.voiceActors.map((va) =>
        voiceActorToPersonData(
          va.voiceActorDetails,
          va.performance || "",
          va.actor_id,
          (va as any).reviewed_status,
          va.id,
        ),
      );
      if (data.characterProfilePictures) {
        characterProfilePictures.value = data.characterProfilePictures;
      }

      // Hydrate shared votes store
      if ((data as any).votes) {
        sharedVotes.value = { ...sharedVotes.value, ...(data as any).votes };
      }
    }
  } catch (e: any) {
    console.error("Error fetching movie data:", e);
    fetchError.value = "Failed to load movie details.";
  }
};



// // Edit voice actor link
// const editVoiceActorLink = (workItem: any) => {
//   if (!movie.value?.id) return;

//   router.push({
//     name: 'AddVoiceCast',
//     params: {
//       movieId: movie.value.id,
//       actorId: workItem.actor_id,
//       workId: workItem.id
//     }
//   });
// };

// Confirm before deleting a voice actor link
// const confirmDeleteVoiceActorLink = async (workItem: any) => {
//   const alert = await alertController.create({
//     header: 'Confirm Delete',
//     message: `Are you sure you want to remove ${workItem.voiceActorDetails.firstname} ${workItem.voiceActorDetails.lastname} as the voice for ${workItem.character}?`,
//     buttons: [
//       {
//         text: 'Cancel',
//         role: 'cancel'
//       },
//       {
//         text: 'Delete',
//         role: 'destructive',
//         handler: () => deleteVoiceActorLink(workItem.id)
//       }
//     ]
//   });
//   await alert.present();
// };

// Delete a voice actor link
// const deleteVoiceActorLink = async (workId: number) => {
//   try {
//     const { error } = await supabase
//       .from('works')
//       .delete()
//       .eq('id', workId);

//     if (error) throw error;

//     // Refresh the data
//     await fetchMovieData();

//     const toast = await toastController.create({
//       message: 'Voice actor link removed',
//       duration: 2000,
//       color: 'success',
//       position: 'top'
//     });
//     await toast.present();
//   } catch (err) {
//     console.error('Error deleting voice actor link:', err);
//     const toast = await toastController.create({
//       message: 'Failed to remove voice actor link',
//       duration: 2000,
//       color: 'danger',
//       position: 'top'
//     });
//     await toast.present();
//   }
// };

watch(() => route.params.id, async (newId) => {
  if (!newId) return;
  isLoading.value = true;
  fetchError.value = "";
  try {
    await fetchMovieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (e: any) {
    console.error("Error fetching movie data:", e);
    fetchError.value = "Failed to load movie details.";
  } finally {
    isLoading.value = false;
  }
}, { immediate: true });
</script>

