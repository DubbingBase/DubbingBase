<template>
  
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <AppTitle>{{ $t("profile.userProfile") }}</AppTitle>
        <template #end v-if="authStore.isAdmin">
          <AppButton fill="clear" @click="isActionSheetOpen = true" aria-label="Menu">
            <EllipsisVertical class="app-icon" />
          </AppButton>
        </template>
      </AppToolbar>
    </AppHeader>

    <AppContent :fullscreen="true">
      
      <div
        v-if="profileStore.isLoadingProfile && !profileStore.isUpdating"
        class="loading-container"
      >
        <LoadingSpinner name="crescent" />
      </div>

      <div v-else-if="profileStore.profileError" class="error-container">
        <RefreshCw class="app-icon" />
        <h3>{{ getErrorTitle(profileStore.profileError.type) }}</h3>
        <p>{{ profileStore.profileError.message }}</p>
        <AppButton v-if="profileStore.profileError.type === 'fetch'" @click="retryLoadProfile" fill="outline">
          <RefreshCw class="app-icon" />
          {{ $t("profile.retry") }}
        </AppButton>
      </div>

      <div v-else class="profile-content">
        <!-- Tab Segments for Profile Navigation -->
        <AppSegment
          v-model="selectedTab"
          @ionChange="handleTabChange"
          class="profile-tabs"
        >
          <AppSegmentButton value="user-profile">
            <AppText>{{ $t("profile.myProfile") }}</AppText>
          </AppSegmentButton>

          <AppSegmentButton
            v-for="voiceActor in profileStore.voiceActors"
            :key="voiceActor.id"
            :value="`voice-actor-${voiceActor.id}`"
          >
            <AppText>{{ voiceActor.firstname }} {{ voiceActor.lastname }}</AppText>
          </AppSegmentButton>
        </AppSegment>

        <!-- Admin Search Modal -->
        <AppModal
          :is-open="showAdminSearch"
          @will-dismiss="showAdminSearch = false"
        >
          <AppHeader>
            <AppToolbar>
              <AppTitle>{{ $t("profile.adminSearch") }}</AppTitle>
              <template #end >
                <AppButton @click="showAdminSearch = false">{{
                  $t("common.close")
                }}</AppButton>
              </template>
            </AppToolbar>
          </AppHeader>
          <AppContent>
            <div class="admin-search">
              <AppSearchbar
                v-model="adminSearchQuery"
                :placeholder="$t('profile.searchVoiceActorPlaceholder')"
                @ionInput="handleAdminSearch"
              ></AppSearchbar>

              <div v-if="adminSearchResults.length > 0" class="search-results">
                <AppList>
                  <AppListItem
                    v-for="result in adminSearchResults"
                    :key="result.id"
                    @click="impersonateVoiceActor(result)"
                    class="search-result-item"
                  >
                    <AppText>
                      <h3>{{ result.firstname }} {{ result.lastname }}</h3>
                      <p>{{ result.bio?.substring(0, 100) }}...</p>
                    </AppText>
                  </AppListItem>
                </AppList>
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
          </AppContent>
        </AppModal>


        <!-- Content based on selected tab -->
        <div class="tab-content">
          <!-- User Profile Tab -->
          <div
            v-if="selectedTab === 'user-profile'"
            class="user-profile-content"
          >
            <div class="user-profile-form">
              <AppList>
                <AppListItem>
                  <AppTextarea
                    :label="$t('profile.biography')"
                    label-placement="stacked"
                    v-model="profileStore.userProfileData.bio"
                    :auto-grow="true"
                    :placeholder="$t('profile.tellUsAboutYourself')"
                  ></AppTextarea>
                </AppListItem>
                <AppListItem v-if="userProfileErrors.includes('Bio must be less than 1000 characters')" class="validation-error">
                  <span class="text-red-500 text-sm">{{ $t("profile.bioTooLong") }}</span>
                </AppListItem>
                <AppListItem>
                  <AppInput
                    :label="$t('profile.nationality')"
                    label-placement="stacked"
                    v-model="profileStore.userProfileData.nationality"
                    :placeholder="$t('profile.exFrench')"
                  ></AppInput>
                </AppListItem>
                <AppListItem v-if="userProfileErrors.includes('Nationality must contain only letters and spaces')" class="validation-error">
                  <span class="text-red-500 text-sm">{{ $t("profile.nationalityInvalid") }}</span>
                </AppListItem>
                <AppListItem>
                  <AppInput
                    type="date"
                    :label="$t('profile.dateOfBirth')"
                    label-placement="stacked"
                    v-model="profileStore.userProfileData.date_of_birth"
                  ></AppInput>
                </AppListItem>
                <AppListItem v-if="userProfileErrors.includes('Date of birth must be in YYYY-MM-DD format')" class="validation-error">
                  <span class="text-red-500 text-sm">{{ $t("profile.dateOfBirthInvalid") }}</span>
                </AppListItem>
              </AppList>

              <AppButton
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
              </AppButton>

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
                <AppListItem color="warning">
                  <User class="app-icon" />
                  <AppText>
                    <h3>{{ $t("profile.impersonatingUser") }}</h3>
                    <p>{{ profileStore.currentVoiceActor?.firstname }} {{ profileStore.currentVoiceActor?.lastname }}</p>
                  </AppText>
                  <AppButton
                    slot="end"
                    fill="clear"
                    @click="exitImpersonation"
                  >
                    {{ $t("profile.exitImpersonation") }}
                  </AppButton>
                </AppListItem>
              </div>

              <AppList>
                <AppListItem>
                  <AppInput
                    :label="$t('profile.firstName')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.firstname"
                  ></AppInput>
                </AppListItem>
                <AppListItem>
                  <AppInput
                    :label="$t('profile.lastName')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.lastname"
                  ></AppInput>
                </AppListItem>
                <AppListItem>
                  <AppTextarea
                    :label="$t('profile.biography')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.bio"
                    :auto-grow="true"
                  ></AppTextarea>
                </AppListItem>
                <AppListItem v-if="voiceActorErrors.includes('Bio must be less than 1000 characters')" class="validation-error">
                  <span class="text-red-500 text-sm">{{ $t("profile.bioTooLong") }}</span>
                </AppListItem>
                <AppListItem>
                  <AppInput
                    :label="$t('profile.nationality')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.nationality"
                  ></AppInput>
                </AppListItem>
                <AppListItem v-if="voiceActorErrors.includes('Nationality must contain only letters and spaces')" class="validation-error">
                  <span class="text-red-500 text-sm">{{ $t("profile.nationalityInvalid") }}</span>
                </AppListItem>
                <AppListItem>
                  <AppInput
                    type="date"
                    :label="$t('profile.dateOfBirth')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.date_of_birth"
                  ></AppInput>
                </AppListItem>
                <AppListItem v-if="voiceActorErrors.includes('Date of birth must be in YYYY-MM-DD format')" class="validation-error">
                  <span class="text-red-500 text-sm">{{ $t("profile.dateOfBirthInvalid") }}</span>
                </AppListItem>
                <AppListItem>
                  <AppInput
                    :label="$t('profile.awards')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.awards"
                  ></AppInput>
                </AppListItem>
                <AppListItem>
                  <AppInput
                    :label="$t('profile.yearsActive')"
                    label-placement="stacked"
                    v-model="profileStore.currentVoiceActor.years_active"
                  ></AppInput>
                </AppListItem>
              </AppList>

              <AppButton
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
              </AppButton>
            </div>
          </div>
        </div>
      </div>
      <AppActionSheet
        v-model:is-open="isActionSheetOpen"
        :buttons="actionSheetButtons"
      />
    </AppContent>
  </AppPage>
  
</template>

<script setup lang="ts">
import AppPage from '@/components/common/layout/AppPage.vue';
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import AppSegment from '@/components/common/layout/AppSegment.vue';
import AppSegmentButton from '@/components/common/layout/AppSegmentButton.vue';
import AppModal from '@/components/common/AppModal.vue';
import AppList from '@/components/common/AppList.vue';
import AppListItem from '@/components/common/AppListItem.vue';
import AppButton from '@/components/common/AppButton.vue';
import AppInput from '@/components/common/AppInput.vue';
import AppTextarea from '@/components/common/AppTextarea.vue';
import AppSearchbar from '@/components/common/AppSearchbar.vue';
import Search from '~icons/lucide/search';
import User from '~icons/lucide/user';
import RefreshCw from '~icons/lucide/refresh-cw';
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import AppText from '@/components/common/AppText.vue';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';
import { onMounted, watch, ref, computed, getCurrentInstance } from "vue";
import AppActionSheet, { type ActionSheetButton } from "@/components/common/AppActionSheet.vue";
import { useProfileStore } from "@/stores/profile";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "vue-i18n";
import RequestVoiceActorCard from "@/components/RequestVoiceActorCard.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";

import { supabase } from "@/api/supabase";

const profileStore = useProfileStore();
const authStore = useAuthStore();
const { t } = useI18n();
const { $t } = getCurrentInstance()!.proxy!;

// Reactive variables
const selectedTab = ref<string>("user-profile");
const adminSearchQuery = ref<string>("");
const adminSearchResults = ref<any[]>([]);
const isActionSheetOpen = ref(false);
const showAdminSearch = ref<boolean>(false);

const actionSheetButtons = computed<ActionSheetButton[]>(() => {
  return [
    {
      text: t('profile.adminSearch', 'Recherche admin'),
      icon: Search,
      handler: () => {
        showAdminSearch.value = true;
      },
    },
    {
      text: t('common.cancel', 'Annuler'),
      role: 'cancel',
    },
  ];
});



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
        body: { query: adminSearchQuery.value }}
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
        targetUserId: profileStore.isImpersonating ? profileStore.impersonatedTargetUserId || undefined : undefined});
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

const handleRefresh = async (event: any) => {
  try {
    await profileStore.fetchProfile({});
  } catch (error) {
    console.error("Error refreshing profile:", error);
  } finally {
    event.target.complete();
  }
};

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

.error-container .app-icon,
.no-profile-container .app-icon,
.no-data-container .app-icon {
  margin-bottom: 1rem;
  font-size: 3rem;
}

.error-container h3,
.no-profile-container h3,
.no-data-container h3 {
  margin: 1rem 0 0.5rem 0;
  color: var(--app-color-primary);
}

.error-container {
  border: 1px solid var(--app-color-danger);
  border-radius: 8px;
  background-color: var(--app-color-danger-tint);
  padding: 1rem;
}

.validation-error {
  color: var(--app-color-danger);
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: block;
}

.error-container p,
.no-profile-container p,
.no-data-container p {
  margin: 0.5rem 0;
  color: var(--app-text-color);
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
  background-color: var(--app-background-color, #1e293b);
  border: 1px solid var(--app-color-light-shade, #334155);
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
  border-bottom: 1px solid var(--app-color-light-shade, #334155);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--app-text-color, #ffffff);
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.75rem;
  color: var(--app-color-medium, #94a3b8);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s ease;
}

.close-btn:hover {
  color: var(--app-text-color, #ffffff);
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
  color: var(--app-color-medium, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-group input,
.form-group textarea {
  background-color: var(--app-color-light, #0f172a);
  border: 1px solid var(--app-color-light-shade, #334155);
  border-radius: 10px;
  padding: 0.75rem;
  color: var(--app-text-color, #ffffff);
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
  color: var(--app-text-color, #ffffff);
  border: 1px solid var(--app-color-light-shade, #334155);
}

.btn-secondary:hover {
  background-color: var(--app-color-light, #0f172a);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Card Styles */
.request-profile-card {
  margin-top: 2.5rem;
  padding: 1.5rem;
  background-color: var(--app-color-light, #0f172a);
  border: 1px solid var(--app-color-light-shade, #334155);
  border-radius: 14px;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}

.request-profile-card h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--app-text-color, #ffffff);
}

.request-profile-card p {
  margin-top: 0;
  margin-bottom: 1.5rem;
  font-size: 0.85rem;
  color: var(--app-color-medium, #94a3b8);
  line-height: 1.5;
}

.request-btn {
  width: 100%;
  background-color: var(--app-color-primary, #3b82f6);
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
