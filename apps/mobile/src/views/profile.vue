<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t("profile.userProfile") }}</ion-title>
        <ion-buttons slot="end" v-if="authStore.isAdmin">
          <ion-button @click="showAdminSearch = true">
            <ion-icon :icon="search"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div
        v-if="profileStore.isLoadingProfile && !profileStore.isUpdating"
        class="loading-container"
      >
        <LoadingSpinner name="crescent" text="Chargement du profil..." />
      </div>

      <div v-else-if="profileStore.profileError" class="error-container">
        <ion-icon :icon="refresh" color="danger" size="large"></ion-icon>
        <h3>{{ getErrorTitle(profileStore.profileError.type) }}</h3>
        <p>{{ profileStore.profileError.message }}</p>
        <ion-button v-if="profileStore.profileError.type === 'fetch'" @click="retryLoadProfile" fill="outline">
          <ion-icon slot="start" :icon="refresh"></ion-icon>
          {{ $t("profile.retry") }}
        </ion-button>
      </div>

      <div v-else class="profile-content">
        <!-- Tab Segments for Profile Navigation -->
        <ion-segment
          v-model="selectedTab"
          @ionChange="handleTabChange"
          class="profile-tabs"
        >
          <ion-segment-button value="user-profile">
            <ion-label>{{ $t("profile.myProfile") }}</ion-label>
          </ion-segment-button>

          <ion-segment-button
            v-for="voiceActor in profileStore.voiceActors"
            :key="voiceActor.id"
            :value="`voice-actor-${voiceActor.id}`"
          >
            <ion-label
              >{{ voiceActor.firstname }} {{ voiceActor.lastname }}</ion-label
            >
          </ion-segment-button>
        </ion-segment>

        <!-- Admin Search Modal -->
        <ion-modal
          :is-open="showAdminSearch"
          @will-dismiss="showAdminSearch = false"
        >
          <ion-header>
            <ion-toolbar>
              <ion-title>{{ $t("profile.adminSearch") }}</ion-title>
              <ion-buttons slot="end">
                <ion-button @click="showAdminSearch = false">{{
                  $t("common.close")
                }}</ion-button>
              </ion-buttons>
            </ion-toolbar>
          </ion-header>
          <ion-content>
            <div class="admin-search">
              <ion-searchbar
                v-model="adminSearchQuery"
                :placeholder="$t('profile.searchVoiceActorPlaceholder')"
                @ionInput="handleAdminSearch"
              ></ion-searchbar>

              <div v-if="adminSearchResults.length > 0" class="search-results">
                <ion-list>
                  <ion-item
                    v-for="result in adminSearchResults"
                    :key="result.id"
                    @click="impersonateVoiceActor(result)"
                    class="search-result-item"
                  >
                    <ion-label>
                      <h3>{{ result.firstname }} {{ result.lastname }}</h3>
                      <p>{{ result.bio?.substring(0, 100) }}...</p>
                    </ion-label>
                  </ion-item>
                </ion-list>
              </div>
              <div
                v-else-if="
                  adminSearchQuery.trim() && adminSearchResults.length === 0
                "
                class="no-results"
              >
                <p>{{ $t("profile.noSearchResults") }}</p>
              </div>
            </div>
          </ion-content>
        </ion-modal>


        <!-- Content based on selected tab -->
        <div class="tab-content">
          <!-- User Profile Tab -->
          <div
            v-if="selectedTab === 'user-profile'"
            class="user-profile-content"
          >
            <div class="user-profile-form">
              <ion-list>
                <ion-item>
                  <ion-textarea
                    :label="$t('profile.biography')"
                    label-placement="stacked"
                    v-model="profileStore.userProfileData.bio"
                    :auto-grow="true"
                    :placeholder="$t('profile.tellUsAboutYourself')"
                  ></ion-textarea>
                </ion-item>
                <ion-item v-if="userProfileErrors.includes('Bio must be less than 1000 characters')" class="validation-error">
                  <ion-note color="danger">{{ $t("profile.bioTooLong") }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-input
                    :label="$t('profile.nationality')"
                    label-placement="stacked"
                    v-model="profileStore.userProfileData.nationality"
                    :placeholder="$t('profile.exFrench')"
                  ></ion-input>
                </ion-item>
                <ion-item v-if="userProfileErrors.includes('Nationality must contain only letters and spaces')" class="validation-error">
                  <ion-note color="danger">{{ $t("profile.nationalityInvalid") }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-input
                    type="date"
                    :label="$t('profile.dateOfBirth')"
                    label-placement="stacked"
                    v-model="profileStore.userProfileData.date_of_birth"
                  ></ion-input>
                </ion-item>
                <ion-item v-if="userProfileErrors.includes('Date of birth must be in YYYY-MM-DD format')" class="validation-error">
                  <ion-note color="danger">{{ $t("profile.dateOfBirthInvalid") }}</ion-note>
                </ion-item>
              </ion-list>

              <ion-button
                expand="block"
                @click="handleSave()"
                :disabled="profileStore.isUpdating"
              >
                <LoadingSpinner
                  v-if="profileStore.isUpdating"
                  name="crescent"
                  inline
                />
                {{ $t("profile.saveChanges") }}
              </ion-button>

              <!-- Request a Voice Actor Page -->
              <RequestVoiceActorCard /></div>
          </div>

          <!-- Voice Actor Profile Tabs -->
           <div
             v-if="selectedTab.startsWith('voice-actor-') && profileStore.currentVoiceActor"
             class="voice-actor-content"
           >
            <div v-if="profileStore.currentVoiceActor">
              <!-- Show impersonation notice for admin users -->
              <div
                v-if="authStore.isAdmin && profileStore.isImpersonating"
                class="impersonation-notice"
              >
                <ion-item color="warning">
                  <ion-icon :icon="person" slot="start"></ion-icon>
                  <ion-label>
                    <h3>{{ $t("profile.impersonatingUser") }}</h3>
                    <p>{{ profileStore.currentVoiceActor?.firstname }} {{ profileStore.currentVoiceActor?.lastname }}</p>
                  </ion-label>
                  <ion-button
                    slot="end"
                    fill="clear"
                    @click="exitImpersonation"
                  >
                    {{ $t("profile.exitImpersonation") }}
                  </ion-button>
                </ion-item>
              </div>

              <ion-list>
                <ion-item>
                  <ion-input
                    :label="$t('profile.firstName')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.firstname"
                  ></ion-input>
                </ion-item>
                <ion-item>
                  <ion-input
                    :label="$t('profile.lastName')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.lastname"
                  ></ion-input>
                </ion-item>
                <ion-item>
                  <ion-textarea
                    :label="$t('profile.biography')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.bio"
                    :auto-grow="true"
                  ></ion-textarea>
                </ion-item>
                <ion-item v-if="voiceActorErrors.includes('Bio must be less than 1000 characters')" class="validation-error">
                  <ion-note color="danger">{{ $t("profile.bioTooLong") }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-input
                    :label="$t('profile.nationality')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.nationality"
                  ></ion-input>
                </ion-item>
                <ion-item v-if="voiceActorErrors.includes('Nationality must contain only letters and spaces')" class="validation-error">
                  <ion-note color="danger">{{ $t("profile.nationalityInvalid") }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-input
                    type="date"
                    :label="$t('profile.dateOfBirth')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.date_of_birth"
                  ></ion-input>
                </ion-item>
                <ion-item v-if="voiceActorErrors.includes('Date of birth must be in YYYY-MM-DD format')" class="validation-error">
                  <ion-note color="danger">{{ $t("profile.dateOfBirthInvalid") }}</ion-note>
                </ion-item>
                <ion-item>
                  <ion-input
                    :label="$t('profile.awards')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.awards"
                  ></ion-input>
                </ion-item>
                <ion-item>
                  <ion-input
                    :label="$t('profile.yearsActive')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.years_active"
                  ></ion-input>
                </ion-item>
              </ion-list>

              <ion-button
                expand="block"
                @click="handleVoiceActorSave"
                :disabled="profileStore.isUpdating"
              >
                <LoadingSpinner
                  v-if="profileStore.isUpdating"
                  name="crescent"
                  inline
                />
                {{ $t("profile.saveChanges") }}
              </ion-button>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, watch, ref, getCurrentInstance } from "vue";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonButton,
  IonList,
  IonItem,
  IonInput,
  IonTextarea,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonSearchbar,
  IonModal,
  IonButtons,
  IonNote,
} from "@ionic/vue";
import { useProfileStore } from "@/stores/profile";
import { useAuthStore } from "@/stores/auth";
import RequestVoiceActorCard from "@/components/RequestVoiceActorCard.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { refresh, search, person } from "ionicons/icons";
import { supabase } from "@/api/supabase";

const profileStore = useProfileStore();
const authStore = useAuthStore();
const { $t } = getCurrentInstance()!.proxy!;

// Reactive variables
const selectedTab = ref<string>("user-profile");
const adminSearchQuery = ref<string>("");
const adminSearchResults = ref<any[]>([]);
const showAdminSearch = ref<boolean>(false);



// Validation errors
const userProfileErrors = ref<string[]>([]);
const voiceActorErrors = ref<string[]>([]);

// Error handling functions
const getErrorTitle = (type: string) => {
  switch (type) {
    case 'fetch':
      return $t("profile.errorLoadingProfile");
    case 'update':
      return $t("profile.errorUpdatingProfile");
    case 'create':
      return $t("profile.errorCreatingProfile");
    default:
      return $t("profile.errorGeneric");
  }
};

// Functions
const retryLoadProfile = async () => {
  await profileStore.fetchProfile({});
};

const handleTabChange = (event: any) => {
  selectedTab.value = event.detail.value;
  if (event.detail.value.startsWith('voice-actor-')) {
    const voiceActorId = parseInt(event.detail.value.split('-')[2]);
    profileStore.selectVoiceActor(voiceActorId, {});
  } else if (event.detail.value === 'user-profile') {
    profileStore.selectUserProfile();
  }
};

const handleAdminSearch = async () => {
  if (!adminSearchQuery.value.trim()) {
    adminSearchResults.value = [];
    return;
  }

  try {
    // Import supabase directly
    const { supabase } = await import("@/api/supabase");
    // Use the search-voice-actors function to find voice actors
    const { data, error } = await supabase.functions.invoke(
      "search-voice-actors",
      {
        body: { query: adminSearchQuery.value },
      }
    );

    if (error) throw error;
    console.log("Search results:", data?.voice_actors);
    adminSearchResults.value = data?.voice_actors || [];
  } catch (error) {
    console.error("Error searching voice actors:", error);
    adminSearchResults.value = [];
  }
};

const impersonateVoiceActor = async (voiceActor: any) => {
  profileStore.impersonateVoiceActor(voiceActor);
  selectedTab.value = `voice-actor-${voiceActor.id}`;
  adminSearchQuery.value = "";
  adminSearchResults.value = [];
  showAdminSearch.value = false;
};

const exitImpersonation = () => {
  profileStore.impersonateVoiceActor(null);
  selectedTab.value = "user-profile";
};

const handleVoiceActorSave = async () => {
  if (!profileStore.currentVoiceActor) return;

  const current = profileStore.currentVoiceActor;

  // Validate voice actor profile
  const errors = profileStore.validateVoiceActorProfile(current);
  voiceActorErrors.value = errors;

  if (errors.length > 0) {
    return; // Prevent saving if validation fails
  }

  try {
    if (Object.keys(current).length > 0) {
      await profileStore.updateProfile(current, {
        voiceActorId: profileStore.currentVoiceActor.id,
        targetUserId: profileStore.isImpersonating ? profileStore.impersonatedTargetUserId || undefined : undefined,
      });
    }
    // Clear validation errors on success
    voiceActorErrors.value = [];
  } catch (error) {
    // Error is already handled in the store
    console.error("Error saving voice actor profile:", error);
  }
};

onMounted(async () => {
  await profileStore.fetchProfile({});
  // Set default tab to user profile
  selectedTab.value = "user-profile";
});

watch(
  () => profileStore.voiceActors,
  (newVoiceActors: any[]) => {
    if (
      newVoiceActors.length === 0 &&
      selectedTab.value.startsWith("voice-actor-")
    ) {
      selectedTab.value = "user-profile"; // Reset to user profile tab if no voice actors
    }
  },
  { immediate: true }
);


const handleSave = async () => {
  // Validate user profile
  const errors = profileStore.validateUserProfile(profileStore.userProfileData);
  userProfileErrors.value = errors;

  if (errors.length > 0) {
    return; // Prevent saving if validation fails
  }

  try {
    await profileStore.updateProfile(profileStore.userProfileData, {});
    // Clear validation errors on success
    userProfileErrors.value = [];
  } catch (error) {
    // Error is already handled in the store
    console.error("Error saving user profile:", error);
  }
};
</script>

<style scoped>
.loading-container,
.error-container,
.no-profile-container,
.no-data-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  text-align: center;
  padding: 2rem;
}

.error-container ion-icon,
.no-profile-container ion-icon,
.no-data-container ion-icon {
  margin-bottom: 1rem;
  font-size: 3rem;
}

.error-container h3,
.no-profile-container h3,
.no-data-container h3 {
  margin: 1rem 0 0.5rem 0;
  color: var(--ion-color-primary);
}

.error-container {
  border: 1px solid var(--ion-color-danger);
  border-radius: 8px;
  background-color: var(--ion-color-danger-tint);
  padding: 1rem;
}

.validation-error {
  color: var(--ion-color-danger);
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}

.error-container p,
.no-profile-container p,
.no-data-container p {
  margin: 0.5rem 0;
  color: var(--ion-text-color);
  opacity: 0.7;
}

.profile-content {
  padding: 1rem;
}

.work-section {
  margin-top: 2rem;
}

.work-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
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
  box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5);
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
  margin-top: 2.5rem;
  padding: 1.5rem;
  background-color: var(--ion-color-light, #0f172a);
  border: 1px solid var(--ion-color-light-shade, #334155);
  border-radius: 14px;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.request-profile-card h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ion-text-color, #ffffff);
}

.request-profile-card p {
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 0.85rem;
  color: var(--ion-color-medium, #94a3b8);
  line-height: 1.5;
}

.request-btn {
  width: 100%;
  background-color: var(--ion-color-primary, #3b82f6);
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 0.8rem;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 4px 6px -1px rgb(59 130 246 / 0.2);
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
  to { transform: rotate(360deg); }
}
</style>
