<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Home' }" />
        </ion-buttons>
        <ion-title>{{ movie?.title ?? "" }}</ion-title>
        <ion-buttons slot="end" v-if="isAdmin">
          <ion-button @click="goToEditPage">
            <ion-icon :icon="pencil"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <!--
      <div class="background" v-if="movie">
        <img
          width="100%"
          v-if="movie"
          :src="movie.backdrop_path"
          alt="Movie background image"
        />
      </div>
      -->

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
        @fetch-infos="fetchInfos"
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
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBackButton,
  IonButtons,
  IonButton,
  IonIcon,
  toastController,
  IonToast,
} from "@ionic/vue";
import { computed, onMounted, ref, UnwrapRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { pencil } from "ionicons/icons";
import { MovieResponse } from "../../supabase/functions/_shared/movie";
import { supabase } from "../api/supabase";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import MediaInfoCard from "@/components/MediaInfoCard.vue";
import ActorList from "@/components/ActorList.vue";
import ActionButtons from "@/components/ActionButtons.vue";
import VoiceActorSearchModal from "@/components/VoiceActorSearchModal.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import MediaItem from "@/components/MediaItem.vue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { Role } from "@/components/PersonItem.vue";

const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const route = useRoute();
const router = useRouter();

// Initialize voice actor management
const {
  // State
  showVoiceActorSearch,
  voiceActors,
  isLoading,

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
  role: Role
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
        "$1 $3"
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
  return movie.value?.credits.cast.map((cast) => {
    // console.log("cast", cast);
    const person = actorToPersonData(cast);

    for (const role of person.roles ?? []) {
      const image = characterProfilePictures.value.find((character) =>
        findCharacter(character, role)
      )?.image;
      role.image = image ?? "";
    }

    person.roles =
      person.roles?.filter(
        (role, index, self) =>
          index === self.findIndex((r) => r.image === role.image)
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

const takePhoto = async () => {
  try {
    isScanning.value = true;
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Prompt,
    });

    const response = await supabase.functions.invoke("process_image", {
      body: {
        image: image.base64String,
        mediaId: parseInt(route.params.id as string),
      },
    });

    if (response.data.ok) {
      scanResult.value = "Image processed successfully!";
      showScanResult.value = true;
    } else {
      scanResult.value = response.data.error || "Error processing image.";
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

const fetchInfos = async () => {
  const id = wikiDataId.value;

  if (!id) {
    console.error("id is undefined");
    return;
  }

  console.log("id", id);
  isFetching.value = true;
  const movieResponseRaw = await supabase.functions.invoke("prepare_movie", {
    body: {
      tmdbId: route.params.id,
      type: "movie",
    },
  });
  const data = movieResponseRaw.data;

  console.log("data", data);

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
    fetchError.value = data.error;
    isLoading.value = false;
  }
};

const fetchMovieData = async () => {
  const id = route.params.id;
  try {
    const movieResponseRaw = await supabase.functions.invoke("movie", {
      body: { id },
    });
    const data = movieResponseRaw.data as MovieResponse;
    movie.value = data.movie;
    console.log("data.voiceActors", data.voiceActors);
    voiceActors.value = data.voiceActors.map((va) =>
      voiceActorToPersonData(
        va.voiceActorDetails,
        va.performance,
        va.actor_id,
        va.reviewed_status,
        va.id
      )
    );
    if (data.characterProfilePictures) {
      characterProfilePictures.value = data.characterProfilePictures;
    }

    // Refresh votes after loading voice actors
    if (voiceActors.value.length > 0) {
      const workIds = voiceActors.value.map((va) => va.id);
      await refreshVotes(workIds);
    }
  } catch (e: any) {
    console.error("Error fetching movie data:", e);
    fetchError.value = "Failed to load movie details.";
  }
};

// Navigate to edit page
const goToEditPage = () => {
  if (movie.value?.id) {
    router.push({
      name: "AddVoiceCast",
      params: { id: movie.value.id },
    });
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

// Check admin status when component mounts
onMounted(async () => {
  isLoading.value = true;
  fetchError.value = "";
  try {
    await fetchMovieData();
  } catch (e: any) {
    console.error("Error fetching movie data:", e);
    fetchError.value = "Failed to load movie details.";
  } finally {
    isLoading.value = false;
  }
});
</script>
