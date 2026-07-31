<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>Voix</AppTitle>
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
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>
        <LoadingSpinner v-if="loading" :overlay="true" />

        <div v-if="!loading && voiceActor" class="actor">
          <!-- Request Linkage Card -->
          <RequestVoiceActorCard
            ref="requestCardRef"
            :hideCard="true"
            v-if="isAuthenticated && !isLinked"
            :voiceActor="voiceActor"
          />

          <VoiceActorHeader
            :voiceActor="voiceActor"
            :profilePicture="profilePicture"
            @profile-picture-changed="onProfilePictureChanged"
          />

          <VoiceActorBio :bio="voiceActor.bio" />

          <AppSearchbar
            v-model="searchQuery"
            :placeholder="t('common.search', 'Search...')"
            animated
            class="custom-searchbar"
          ></AppSearchbar>

          <VoiceActorWorksGrouped :works="filteredEnhancedWork" />
        </div>

        <!-- Voice Actor Fetch Modal for Admin -->
        <VoiceActorFetchModal
          :is-open="isFetchModalOpen"
          :voice-actor="voiceActor"
          :potential-wikipedia-url="potentialWikipediaUrl"
          @close="isFetchModalOpen = false"
          @saved="handleFetchModalSaved"
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
import { IonPage, toastController, RefresherCustomEvent } from "@ionic/vue";
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppSearchbar from "@/components/common/AppSearchbar.vue";
import Pencil from "~icons/lucide/pencil";
import RefreshCw from "~icons/lucide/refresh-cw";
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import UserCheck from "~icons/lucide/user-check";
import { computed, onMounted, ref, getCurrentInstance } from "vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import AppActionSheet, {
  ActionSheetButton,
} from "@/components/common/AppActionSheet.vue";
import { useRoute, useRouter } from "vue-router";
// Admin check: get user from supabase.auth and check for admin role
import { supabase } from "../api/supabase";
import VoiceActorHeader from "@/components/VoiceActorHeader.vue";
import VoiceActorBio from "@/components/VoiceActorBio.vue";
import VoiceActorWorksGrouped from "@/components/VoiceActorWorksGrouped.vue";
import RequestVoiceActorCard from "@/components/RequestVoiceActorCard.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import VoiceActorFetchModal from "@/components/VoiceActorFetchModal.vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "vue-i18n";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";

const authStore = useAuthStore();

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

// Local admin check using Supabase auth

import { watch } from "vue";
import { useVoiceActorData } from "@app/shared-logic";

const { isAdmin, isAuthenticated } = storeToRefs(authStore);
const { votes: sharedVotes } = useVoiceActorManagement("movie");

const {
  voiceActor,
  profilePicture,
  loading,
  searchQuery,
  potentialWikipediaUrl,
  votes,
  isLinked,
  filteredEnhancedWork,
  loadVoiceActorData
} = useVoiceActorData(supabase);

watch(votes, (newVotes) => {
  if (newVotes) {
    sharedVotes.value = { ...sharedVotes.value, ...newVotes };
  }
}, { immediate: true });



const isFetchModalOpen = ref(false);
const isActionSheetOpen = ref(false);
const requestCardRef = ref<HTMLElement | null>(null);

const actionSheetButtons = computed<ActionSheetButton[]>(() => {
  const buttons: ActionSheetButton[] = [
    {
      text: t("common.editProfile", "Modifier le profil"),
      icon: Pencil,
      handler: () => openEditProfile(),
    },
  ];

  if (isAuthenticated.value && !isLinked.value) {
    buttons.unshift({
      text: t("profile.requestVoiceActorBtn", "Revendiquer ce profil"),
      icon: UserCheck,
      handler: () => {
        requestCardRef.value?.openRequestModal();
      },
    });
  }

  if (isAdmin.value) {
    buttons.unshift({
      text: t("common.refresh", "Récupérer les infos"),
      icon: RefreshCw,
      cssClass: "action-sheet-admin",
      handler: () => {
        isFetchModalOpen.value = true;
      },
    });
  }

  buttons.push({
    text: t("common.cancel", "Annuler"),
    role: "cancel",
  });

  return buttons;
});
const handleFetchModalSaved = async () => {
  // Reload the voice actor data to reflect the newly saved updates
  const id = route.params.id as string;

  try {
    await loadVoiceActorData(id);
    const toast = await toastController.create({
      message: t("common.success", "Actualisé avec succès !"),
      duration: 2000,
      position: "bottom",
      color: "success",
    });
    await toast.present();
  } catch (err) {
    console.error("Error refreshing voice actor after fetch:", err);
    const toast = await toastController.create({
      message: t("common.error", "Erreur lors de l'actualisation."),
      duration: 3000,
      position: "bottom",
      color: "danger",
    });
    await toast.present();
  }
};



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
  const id = route.params.id as string;
  await loadVoiceActorData(id);
});

const handleRefresh = async (event: RefresherCustomEvent) => {
  try {
    const id = route.params.id as string;
    await loadVoiceActorData(id);
  } catch (error) {
    console.error("Error refreshing data:", error);
  } finally {
    event.target.complete();
  }
};

const openEditProfile = () => {
  const id = route.params.id;
  router.push({ name: "VoiceActorProfile", params: { id } });
};
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
  background-color: var(--app-background-color, #1e293b);
  border: 1px solid var(--app-color-light-shade, #334155);
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
  border-bottom: 1px solid var(--app-color-light-shade, #334155);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--app-color-text-primary, #ffffff);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.75rem;
  color: var(--app-color-text-secondary, #94a3b8);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s ease;
}

.close-btn:hover {
  color: var(--app-color-text-primary, #ffffff);
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
  color: var(--app-color-text-secondary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input,
.form-group textarea {
  background-color: var(--app-color-step-50, #0f172a);
  border: 1px solid var(--app-color-light-shade, #334155);
  border-radius: 10px;
  padding: 0.75rem;
  color: var(--app-color-text-primary, #ffffff);
  font-size: 0.9rem;
  outline: none;
  transition: all 0.15s ease;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: var(--app-color-primary, #3b82f6);
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
  background-color: var(--app-color-primary, #3b82f6);
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
  color: var(--app-color-text-primary, #ffffff);
  border: 1px solid var(--app-color-light-shade, #334155);
}

.btn-secondary:hover {
  background-color: var(--app-color-step-50, #0f172a);
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
  color: var(--app-color-primary, #3b82f6);
}

.request-profile-card p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--app-color-text-secondary, #94a3b8);
  line-height: 1.3;
}

.request-btn {
  width: auto;
  background-color: var(--app-color-primary, #3b82f6);
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
  border: 2px solid var(--app-overlay-30);
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
