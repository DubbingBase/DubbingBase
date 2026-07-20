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
              @click="isActionSheetOpen = true"
              aria-label="Menu"
            >
              <EllipsisVertical class="app-icon" />
            </AppButton>
          </template>
        </AppToolbar>
      </AppHeader>
      <AppContent>
        <MediaInfoCard :media="show" />

        <LoadingSpinner v-if="isLoading" />

        <div class="tabs" v-show="!isLoading">
          <AppSegment v-model="selectedSegment" scrollable>
            <AppSegmentButton value="peoples" content-id="peoples">
              <!-- <Search class="app-icon" /> -->
              Personnes
            </AppSegmentButton>
            <AppSegmentButton value="seasons" content-id="seasons">
              <!-- <Radio class="app-icon" /> -->
              Saisons
            </AppSegmentButton>
          </AppSegment>
          <AppSegmentView v-model:active-segment="selectedSegment">
            <AppSegmentContent class="segmented-content" id="peoples">
              <DubbingProjectsView
                :contentId="route.params.id as string"
                contentType="tv"
                :actors="actors"
                :is-admin="isAdmin"
                :get-voice-actor-by-tmdb-id="getVoiceActorByTmdbId"
                :go-to-actor="goToActor"
                :go-to-voice-actor="goToVoiceActor"
                :edit-voice-actor-link="editVoiceActorLink"
                :confirm-delete-voice-actor-link="confirmDeleteVoiceActorLink"
                :open-voice-actor-search="openVoiceActorSearch"
                :mediaLanguage="show?.original_language"
                :externalVoiceActors="voiceActors"
                :parentLoading="isLoading"
              />
            </AppSegmentContent>
            <AppSegmentContent class="segmented-content" id="seasons">
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
import { useRoute, useRouter } from 'vue-router';
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
import Share2 from "~icons/lucide/share-2";
// Removed unused imports
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

const { t } = useI18n();
const { showToast } = useToast();

const route = useRoute();
const router = useRouter();

const isActionSheetOpen = ref(false);

const goToAddProject = () => {
  router.push(`/edit-dubbing-project/new?contentId=${route.params.id}`);
};

const actionSheetButtons = computed<ActionSheetButton[]>(() => {
  const buttons: ActionSheetButton[] = [
    {
      text: t("common.share", "Partager"),
      icon: Share2,
      handler: () => shareMedia(),
    },
    {
      text: t("common.settings", "Paramètres"),
      icon: Settings,
    },
  ];

  if (isAdmin.value) {
    buttons.push({
      text: t("movie.addDubbingProject", "Add Dubbing Project"),
      icon: Plus,
      handler: goToAddProject,
    });
  }

  if (isAdmin.value && !hasData.value) {
    buttons.push({
      text: t("common.scan", "Scanner"),
      icon: CameraIcon,
      handler: () => takePhoto(),
    });
  }

  if (hasWikidataId.value && !hasData.value) {
    buttons.push({
      text: t("common.enqueue", "Mettre en file d'attente"),
      icon: List,
      handler: () => handleEnqueue(),
    });
    buttons.push({
      text: t("common.fetchInfos", "Récupérer les infos"),
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
        color: "success"
      });
      await toast.present();
    } catch (clipboardErr) {
      console.error("Clipboard copy failed:", clipboardErr);
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
      actors.value?.map((a: any) => ({
        id: a.id,
        name: a.name,
        roles: a.roles?.map((r: any) => r.character) || [],
      })) || [];
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
        sharedVotes.value = {
          ...sharedVotes.value,
          ...(response.data as any).votes,
        };
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
    const { data, error } = await supabase.rpc("get_media_queue_status", {
      p_tmdb_id: Number(route.params.id),
      p_media_type: "tv",
    });
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



const selectedSegment = ref('peoples');

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
      message:
        "Import completed successfully! The voice cast has been updated.",
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

onMounted(async () => {
  const newId = route.params.id;
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
