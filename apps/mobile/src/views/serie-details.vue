<template>
  <ion-page>
    <ion-header class="header">
      <ion-toolbar class="toolbar">
        <ion-buttons slot="start">
          <AppBackButton />
        </ion-buttons>
        <ion-title>{{ show?.name || "Détails de la série" }}</ion-title>
        <ion-buttons slot="end">
          <ion-button fill="clear" @click="shareMedia" aria-label="Share">
            <Share2 class="app-icon" />
          </ion-button>
          <ion-button fill="clear" aria-label="Paramètres">
            <Settings class="app-icon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <MediaInfoCard :media="show" />

      <LoadingSpinner v-if="isLoading" />

      <div class="tabs" v-show="!isLoading">
        <ion-segment scrollable>
          <ion-segment-button value="peoples" content-id="peoples">
            <!-- <Search class="app-icon" /> -->
            Personnes
          </ion-segment-button>
          <ion-segment-button value="seasons" content-id="seasons">
            <!-- <Radio class="app-icon" /> -->
            Saisons
          </ion-segment-button>
        </ion-segment>
        <ion-segment-view>
          <ion-segment-content class="segmented-content" id="peoples">
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
              :mediaLanguage="show?.original_language"
            />
          </ion-segment-content>
          <ion-segment-content class="segmented-content" id="seasons">
            <div class="seasons" v-if="show">
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
          </ion-segment-content>
        </ion-segment-view>
      </div>

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

      <ion-toast
        :is-open="showScanResult"
        :message="scanResult"
        :duration="3000"
        @didDismiss="showScanResult = false"
      ></ion-toast>

      <VoiceActorSearchModal
        :is-open="showVoiceActorSearch"
        :media-id="route.params.id as string"
        :work-type="'tv'"
        :link-voice-actor="linkVoiceActor"
        @close="showVoiceActorSearch = false"
      />

      <CreditsReviewModal
        :is-open="showCreditsReview"
        :extracted-credits="extractedCredits"
        :movie-actors="actors"
        :media-id="route.params.id as string"
        :work-type="'tv'"
        @close="showCreditsReview = false"
        @refresh="handleRefresh"
      />
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import Search from '~icons/lucide/search';
import Radio from '~icons/lucide/radio';
import { IonPage, IonContent, IonSegment, IonHeader, IonToolbar, IonButtons, IonBackButton, IonSegmentButton, IonSegmentContent, IonSegmentView, toastController, IonTitle, IonButton, IonToast, IonRefresher, IonRefresherContent } from '@ionic/vue';
import { ref, computed, UnwrapRef, watch } from "vue";
import { useRoute } from "vue-router";
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRouter } from "vue-router";
import { format } from "date-fns";
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import MediaInfoCard from "@/components/MediaInfoCard.vue";
import MediaItem from "@/components/MediaItem.vue";
import ActorList from "@/components/ActorList.vue";
import VoiceActorSearchModal from "@/components/VoiceActorSearchModal.vue";
import CreditsReviewModal from "@/components/CreditsReviewModal.vue";
import ActionButtons from "@/components/ActionButtons.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import Share2 from '~icons/lucide/share-2';
import { Share } from '@capacitor/share';
// Removed unused imports
import Settings from '~icons/lucide/settings';
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/api/supabase";
import { enqueueAndProcessMedia, enqueueMedia } from "@/api/mediaQueue";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { actorToPersonData, voiceActorToPersonData } from "@/utils/convert";
import { Role } from "@/components/PersonItem.vue";
import { useI18n } from "vue-i18n";
import type { ShowResponse } from "@supabase/functions/_shared/types";

const authStore = useAuthStore();
const { isAdmin } = storeToRefs(authStore);

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const show = ref<any>(null);
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

const findCharacter = (
  character: UnwrapRef<typeof characterProfilePictures>[number],
  role: Role,
) => {
  const characterName = character.name.toLowerCase();
  const roleName = role.character.toLowerCase();

  const allNames = characterName.split("/").map((name) => name.trim());
  // console.log("allNames", allNames);

  const allRoleNames = roleName.split("/").map((name) => name.trim());
  // console.log("allRoleNames", allRoleNames);

  // Loop through allNames and allRoleNames to find at least one correspondence
  for (const name of allNames) {
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

  const simplifiedName = characterName.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");
  // console.log("simplifiedName", simplifiedName);

  const simplifiedRoleName = roleName.replace(/(.*)( '?.*' ?)(.*)/, "$1 $3");
  // console.log("simplifiedRoleName", simplifiedRoleName);

  return (
    characterName.includes(roleName) ||
    simplifiedName.includes(roleName) ||
    characterName.includes(simplifiedRoleName) ||
    simplifiedName.includes(simplifiedRoleName)
  );
};

const actors = computed(() => {
  return show.value?.credits?.cast?.map((cast: any) => {
    const person = actorToPersonData(cast);

    console.log("person.roles", person.roles);

    for (const role of person.roles ?? []) {
      const image = characterProfilePictures.value.find((character) =>
        findCharacter(character, role),
      )?.image;
      role.image = image ?? "";
    }
    console.log("person.roles", person.roles);

    person.roles =
      person.roles?.filter(
        (role, index, self) =>
          index === self.findIndex((r) => r.image === role.image),
      ) ?? [];

    return person;
  });
});

// Voice actor methods are now provided by the composable

const wikiDataId = computed(() => {
  return show.value?.external_ids?.wikidata_id;
});

const hasWikidataId = computed(() => {
  return !!wikiDataId.value;
});

const hasData = computed(() => {
  return voiceActors.value.length > 0;
});

const formattedSeasons = computed(() => {
  if (!show.value?.seasons) return [];

  return show.value?.seasons?.map((season: any) => ({
    ...season,
    formatted_air_date: season.air_date
      ? format(new Date(season.air_date), "MMM dd, yyyy")
      : "TBA",
  }));
});

// Scan functionality
const isScanning = ref(false);
const scanResult = ref("");
const showScanResult = ref(false);

const showCreditsReview = ref(false);
const extractedCredits = ref<Array<{actor: string, role: string, voiceActor: string, matchedActorId?: number | null}>>([]);

const shareMedia = async () => {
  if (!show.value) return;
  await Share.share({
    title: show.value.name || "DubbingBase",
    text: `Check out ${show.value.name} on DubbingBase!`,
    url: `dubbingbase://serie/${show.value.id}`,
    dialogTitle: 'Share Series',
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

const getSerie = async (id: string) => {
  try {
    const response = await supabase.functions.invoke<ShowResponse>("show", {
      body: { id },
    });
    return response;
  } catch (e: any) {
    console.error("Error fetching series data:", e);
    error.value = "Failed to load series details.";
    throw e;
  }
};

const fetchSerieData = async () => {
  const id = route.params.id;
  try {
    const response = await getSerie(id as string);
    if (response.data) {
      show.value = response.data.serie || (response.data as any).show; // Handle both response formats
      show.value.credits = response.data.aggregateCredits;
      // Load voice actors for this serie
      if (response.data.voiceActors) {
        voiceActors.value = response.data.voiceActors.map((va) =>
          voiceActorToPersonData(
            va.voiceActorDetails,
            va.performance || "",
            va.actor_id,
            (va as any).reviewed_status,
            va.id,
          ),
        );
      }
      if (response.data.characterProfilePictures) {
        characterProfilePictures.value = response.data.characterProfilePictures;
      }
      if ((response.data as any).votes) {
        sharedVotes.value = { ...sharedVotes.value, ...(response.data as any).votes };
      }
    }
  } catch (e: any) {
    console.error("Error fetching serie data:", e);
    error.value = "Failed to load serie details.";
    throw e;
  }
};

const fetchQueueStatus = async () => {
  try {
    const { data, error } = await supabase
      .rpc("get_media_queue_status", {
        p_tmdb_id: Number(route.params.id),
        p_media_type: "tv"
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

const handleRefresh = async (event?: any) => {
  try {
    await fetchSerieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (error) {
    console.error("Error refreshing serie data:", error);
  } finally {
    event?.target?.complete();
  }
};

const handleEnqueue = async () => {
  console.log("handleEnqueue called in serie-details");
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
      mediaType: "tv",
    });
    // Immediately fetch updated series data to display changes
    await fetchSerieData();
    const toast = await toastController.create({
      message: "Import completed successfully! The voice cast has been updated.",
      duration: 3000,
      position: "top",
      color: "success",
    });
    await toast.present();
  } catch (err) {
    console.error("Error fetching series data:", err);
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

watch(() => route.params.id, async (newId) => {
  if (!newId) return;
  isLoading.value = true;
  error.value = "";
  try {
    await fetchSerieData();
    if (!hasData.value && hasWikidataId.value) {
      await fetchQueueStatus();
    }
  } catch (err) {
    console.error("Error fetching serie:", err);
    error.value = "Failed to load serie details";
  } finally {
    isLoading.value = false;
  }
}, { immediate: true });

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

ion-segment {
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
    --background: #{$block};
    --color: #000;
    --padding-bottom: 0;
    --padding-top: 0;
    --padding-end: 0;
    --padding-start: 0;

    display: flex;
    flex-direction: row;
    gap: 16px;
    background-color: #{$block};
    border-radius: 8px;
    border: 2px solid #{$border};
    padding: 8px;

    &::part(native) {
      .button-inner {
        width: 100%;
      }
    }
  }
}

.toolbar {
  --background: transparent !important;
  --border-width: 0 !important;
}
</style>
