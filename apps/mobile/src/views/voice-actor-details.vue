<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Home' }" />
        </ion-buttons>
        <ion-title>Voix</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openEditProfile">
            <ion-icon :icon="create" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <LoadingSpinner
        v-if="loading"
        :overlay="true"
        text="Loading voice actor..."
      />

      <div v-if="!loading && voiceActor" class="actor">
        <!-- Request Linkage Card -->
        <div v-if="isAuthenticated && !isLinked" class="request-profile-card">
          <div class="banner-content">
            <h3>{{ t("profile.areYouAVoiceActor", { name: `${voiceActor.firstname} ${voiceActor.lastname}` }) }}</h3>
            <p>{{ t("profile.requestVoiceActorDesc") }}</p>
          </div>
          <button type="button" class="request-btn" @click="openRequestModal">
            {{ t("profile.requestVoiceActorBtn") }}
          </button>
        </div>

        <VoiceActorHeader
          :voiceActor="voiceActor"
          :profilePicture="profilePicture"
          @profile-picture-changed="onProfilePictureChanged"
        />

        <VoiceActorBio :bio="voiceActor.bio" />

        <VoiceActorWorksGrouped :works="enhancedWork" />
      </div>

      <!-- Request Voice Actor Linkage Modal -->
      <div
        v-if="isRequestModalOpen"
        class="modal-backdrop"
        @click="closeRequestModal"
      >
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h2>{{ t("profile.requestVoiceActorTitle") }}</h2>
            <button class="close-btn" @click="closeRequestModal">
              &times;
            </button>
          </div>
          <div class="modal-body">
            <form @submit.prevent="submitRequest">
              <div class="form-group">
                <label for="req-details">{{ t("profile.details") }}</label>
                <textarea
                  id="req-details"
                  v-model="requestForm.details"
                  rows="4"
                  :placeholder="$t('profile.requestDetailsPlaceholder')"
                ></textarea>
              </div>

              <div v-if="requestError" class="modal-error">
                {{ requestError }}
              </div>
              <div v-if="requestSuccess" class="modal-success">
                {{ t("profile.requestSuccessMessage") }}
              </div>

              <div class="modal-actions">
                <button
                  type="button"
                  class="btn-secondary"
                  @click="closeRequestModal"
                  :disabled="isSubmittingRequest"
                >
                  {{ t("common.cancel") }}
                </button>
                <button
                  type="submit"
                  class="btn-primary"
                  :disabled="isSubmittingRequest || requestSuccess"
                >
                  <span v-if="isSubmittingRequest" class="spinner"></span>
                  {{ t("profile.submitRequest") }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, getCurrentInstance } from "vue";
import { useRoute, useRouter } from "vue-router";
// Admin check: get user from supabase.auth and check for admin role
import type { Serie as SerieModel } from "@supabase/functions/_shared/serie";
import {
  IonPage,
  IonButton,
  IonBackButton,
  IonButtons,
  IonTitle,
  IonToolbar,
  IonContent,
  IonHeader,
  IonIcon,
} from "@ionic/vue";
import { create } from "ionicons/icons";
import type { Movie as MovieModel } from "@supabase/functions/_shared/movie";
import { supabase } from "../api/supabase";
import VoiceActorHeader from "@/components/VoiceActorHeader.vue";
import VoiceActorBio from "@/components/VoiceActorBio.vue";
import VoiceActorWorksGrouped from "@/components/VoiceActorWorksGrouped.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { PersonData } from "@/components/PersonItem.vue";
import { Actor } from "@supabase/functions/_shared/types";
import { actorToPersonData } from "@/utils/convert";
import { useI18n } from "vue-i18n";

const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// Local admin check using Supabase auth

const { isAdmin, isAuthenticated } = storeToRefs(authStore);

type VoiceActorResponse = {
  voiceActor: {
    id: number;
    firstname: string;
    lastname: string;
    bio: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    awards: string | null;
    years_active: string | null;
    social_media_links: any | null;
    profile_picture: string | null;
    voice_actor_name: string | null;
    user_voice_actor_links?: { id: string }[];
    work: {
      id: number;
      actor_id: number;
      content_id: number;
      content_type: string | null;
      highlight: boolean | null;
      performance: string | null;
      source_id: number | null;
      status: string | null;
      suggestions: string | null;
      voice_actor_id: number | null;
    }[];
  };
  medias: (MovieModel | SerieModel)[];
};

const voiceActor = ref<VoiceActorResponse["voiceActor"] | undefined>();
const medias = ref<VoiceActorResponse["medias"]>([]);
const characterProfilePictures = ref<any[]>([]);
const profilePicture = ref<string | null | undefined>();
const loading = ref<boolean>(true);

// Define a type for our enhanced work item
type EnhancedWorkItem = {
  media: MovieModel | SerieModel;
  work: { id: number; actor_id: number; content_id: number };
  data: {
    character: string | undefined;
    characterImage?: string;
    actor: PersonData<Actor>;
  };
  sortDate: string;
};

// Get base enhanced work data
const baseEnhancedWork = computed<EnhancedWorkItem[]>(() => {
  if (!voiceActor.value?.work) {
    console.log("No voice actor work data available");
    return [];
  }

  const result = voiceActor.value.work
    .map((work) => {
      const media = medias.value.find((media) => media.id === work.content_id);

      if (!media) {
        console.warn(
          `No media found for work with content_id: ${work.content_id}`,
        );
        return null;
      }

      // Ensure credits exist and has cast
      if (!(media as any).credits?.cast) {
        console.warn(`No credits.cast found for media ${media.id}`);
        return null;
      }

      const actor = (media as any).credits.cast.find(
        (cast: any) => cast.id === work.actor_id,
      );

      if (!actor) {
        console.warn(
          `No actor found with id: ${work.actor_id} in media ${media.id}`,
        );
        return null;
      }

      const character = actor.character;
      let characterImage: string | undefined;
      
      if (characterProfilePictures.value.length > 0) {
        // TMDB cast name might differ slightly from TVDB, but a direct lowercase match often works.
        const pic = characterProfilePictures.value.find((cp: any) => 
          (cp.movieId === media.id || cp.showId === media.id) && 
          cp.name && character && cp.name.toLowerCase() === character.toLowerCase()
        );
        if (pic) {
          characterImage = pic.image;
        }
      }

      const data = {
        character,
        characterImage,
        actor: actorToPersonData(actor),
      };

      return {
        media,
        work,
        data,
        sortDate:
          (media as any).release_date ||
          (media as any).first_air_date ||
          "9999-12-31", // Fallback for missing dates
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return result;
});

const openEditProfile = () => {
  const id = route.params.id;
  router.push({ name: "VoiceActorProfile", params: { id } });
};

const isLinked = computed(() => {
  return (voiceActor.value?.user_voice_actor_links?.length ?? 0) > 0;
});

const isRequestModalOpen = ref(false);
const isSubmittingRequest = ref(false);
const requestError = ref<string | null>(null);
const requestSuccess = ref(false);
const requestForm = ref({
  details: "",
});

const openRequestModal = () => {
  isRequestModalOpen.value = true;
  requestError.value = null;
  requestSuccess.value = false;
  requestForm.value = {
    details: "",
  };
};

const closeRequestModal = () => {
  if (isSubmittingRequest.value) return;
  isRequestModalOpen.value = false;
};

const submitRequest = async () => {
  isSubmittingRequest.value = true;
  requestError.value = null;

  try {
    const { data, error } = await supabase.functions.invoke(
      "request-voice-actor-page",
      {
        body: {
          firstname: voiceActor.value?.firstname,
          lastname: voiceActor.value?.lastname,
          details: requestForm.value.details.trim(),
          voice_actor_id: voiceActor.value?.id,
        },
      },
    );

    if (error) throw error;

    requestSuccess.value = true;
    setTimeout(() => {
      isRequestModalOpen.value = false;
    }, 2000);
  } catch (err: any) {
    console.error("Error requesting voice actor linkage:", err);
    requestError.value =
      err.message || "Failed to submit request. Please try again.";
  } finally {
    isSubmittingRequest.value = false;
  }
};

// For chronological view
const enhancedWork = computed(() => {
  if (!baseEnhancedWork.value) return [];

  return [...baseEnhancedWork.value].sort((a, b) => {
    if (!a || !b) return 0;
    return a.sortDate > b.sortDate ? -1 : 1; // Newest first
  });
});

const onProfilePictureChanged = (newImagePath: string) => {
  console.log("Profile picture changed:", newImagePath);
  profilePicture.value = newImagePath;

  // Update the voice actor's profile picture as well
  if (voiceActor.value) {
    voiceActor.value.profile_picture = newImagePath;
    console.log(
      "Updated voiceActor profile_picture:",
      voiceActor.value.profile_picture,
    );
  }
};

onMounted(async () => {
  loading.value = true;

  const id = route.params.id;

  console.log("Fetching voice actor with ID:", id);

  const voiceActorResponseRaw = await supabase.functions.invoke("voice-actor", {
    body: { id },
  });

  const voiceActorResponse =
    (await voiceActorResponseRaw.data) as VoiceActorResponse;

  console.log("Raw voice actor response:", voiceActorResponse);

  if (!voiceActorResponse) {
    console.error("voiceActorResponse is null");
    loading.value = false;
    return;
  }

  console.log("Voice actor data:", voiceActorResponse.voiceActor);
  console.log(
    "Number of works:",
    voiceActorResponse.voiceActor.work?.length || 0,
  );
  console.log("Number of medias:", voiceActorResponse.medias?.length || 0);

  // Log first few works and medias for inspection
  if (voiceActorResponse.voiceActor.work) {
    console.log(
      "First 3 works:",
      voiceActorResponse.voiceActor.work.slice(0, 3),
    );
  }

  if (voiceActorResponse.medias) {
    console.log(
      "First 3 medias:",
      voiceActorResponse.medias.slice(0, 3).map((m) => ({
        id: m.id,
        title: (m as any).title || (m as any).name,
        credits: (m as any).credits
          ? {
              cast: (m as any).credits.cast?.slice(0, 3).map((c: any) => ({
                id: c.id,
                name: c.name,
                character: c.character,
              })),
              crew: (m as any).credits.crew
                ?.slice(0, 3)
                .map((c: any) => ({ id: c.id, name: c.name, job: c.job })),
            }
          : "No credits",
      })),
    );
  }

  voiceActor.value = voiceActorResponse.voiceActor;
  medias.value = voiceActorResponse.medias;
  characterProfilePictures.value = (voiceActorResponse as any).characterProfilePictures || [];

  profilePicture.value = voiceActorResponse.voiceActor.profile_picture;

  loading.value = false;

  // Add a small delay to ensure computed properties are updated
  setTimeout(() => {
    console.log("baseEnhancedWork after update:", baseEnhancedWork.value);
    console.log("enhancedWork after update:", enhancedWork.value);
  }, 100);
});
</script>

<style scoped lang="scss">
.actor {
  padding: 16px;
  margin: 0 auto;
}

/* Modal Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 1rem;
  backdrop-filter: blur(4px);
}

.modal-content {
  background-color: var(--ion-background-color, #1e293b);
  border: 1px solid var(--ion-color-light-shade, #334155);
  border-radius: 16px;
  width: 100%;
  max-width: 450px;
  box-shadow:
    0 20px 25px -5px rgb(0 0 0 / 0.5),
    0 8px 10px -6px rgb(0 0 0 / 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--ion-color-light-shade, #334155);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--ion-text-color, #ffffff);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.75rem;
  color: var(--ion-color-medium, #94a3b8);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s ease;
}

.close-btn:hover {
  color: var(--ion-text-color, #ffffff);
}

.modal-body {
  padding: 1.5rem;
}

.form-group {
  margin-bottom: 1.25rem;
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--ion-color-medium, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input,
.form-group textarea {
  background-color: var(--ion-color-light, #0f172a);
  border: 1px solid var(--ion-color-light-shade, #334155);
  border-radius: 10px;
  padding: 0.75rem;
  color: var(--ion-text-color, #ffffff);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.15s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--ion-color-primary, #3b82f6);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.75rem;
}

.btn-primary,
.btn-secondary {
  padding: 0.75rem 1.5rem;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background-color: var(--ion-color-primary, #3b82f6);
  color: #ffffff;
  border: none;
  box-shadow: 0 4px 6px -1px rgb(59 130 246 / 0.2);
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-secondary {
  background-color: transparent;
  color: var(--ion-text-color, #ffffff);
  border: 1px solid var(--ion-color-light-shade, #334155);
}

.btn-secondary:hover {
  background-color: var(--ion-color-light, #0f172a);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Card Styles */
.request-profile-card {
  margin-top: 0;
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background-color: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 10px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  text-align: left;
}

@media (max-width: 500px) {
  .request-profile-card {
    flex-wrap: wrap;
  }
}

.request-profile-card .banner-content {
  flex: 1;
}

.request-profile-card h3 {
  margin: 0 0 0.25rem 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--ion-color-primary, #3b82f6);
}

.request-profile-card p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ion-color-medium, #94a3b8);
  line-height: 1.3;
}

.request-btn {
  width: auto;
  background-color: var(--ion-color-primary, #3b82f6);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 4px -1px rgb(59 130 246 / 0.2);
  white-space: nowrap;
}

@media (max-width: 500px) {
  .request-btn {
    width: 100%;
    text-align: center;
  }
}

.request-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.request-btn:active {
  transform: translateY(0);
}

.modal-error {
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  font-size: 0.85rem;
  padding: 0.75rem;
  border-radius: 8px;
  margin-top: 1rem;
  text-align: center;
}

.modal-success {
  background-color: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #4ade80;
  font-size: 0.85rem;
  padding: 0.75rem;
  border-radius: 8px;
  margin-top: 1rem;
  text-align: center;
}

.spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 1s ease-in-out infinite;
  margin-right: 6px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
