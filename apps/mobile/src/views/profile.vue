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
            </div>
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
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { refresh, search, person } from "ionicons/icons";

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
</style>
