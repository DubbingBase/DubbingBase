<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ $t('profile.voiceActorProfile') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openPublicProfile">
            <ion-icon :icon="eye" slot="icon-only"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="profileStore.isLoadingProfile && !profileStore.isUpdating" class="loading-container">
        <LoadingSpinner name="crescent" text="Loading voice actor profile..." />
      </div>

      <div v-else-if="profileStore.profileError" class="error-container">
        <ion-icon :icon="alertCircle" color="danger" size="large"></ion-icon>
        <h3>Error loading profile</h3>
        <p>{{ profileStore.profileError }}</p>
        <ion-button @click="retryLoadProfile" fill="outline">
          <ion-icon slot="start" :icon="refresh"></ion-icon>
          Retry
        </ion-button>
      </div>

      <div v-else class="profile-content">
        <div v-if="profileStore.hasProfile && editableProfile">
          <ion-list>
            <ion-item>
              <ion-input label="First name" label-placement="stacked" v-model="(editableProfile as any).firstname"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input label="Last name" label-placement="stacked" v-model="(editableProfile as any).lastname"></ion-input>
            </ion-item>
            <ion-item>
              <ion-textarea label="Biography" label-placement="stacked" v-model="editableProfile.bio" :auto-grow="true"></ion-textarea>
            </ion-item>
            <ion-item>
              <ion-input label="Nationality" label-placement="stacked" v-model="editableProfile.nationality"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input type="date" label="Date of birth" label-placement="stacked" v-model="editableProfile.date_of_birth"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input label="Awards" label-placement="stacked" v-model="(editableProfile as any).awards"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input label="Years active" label-placement="stacked" v-model="(editableProfile as any).years_active"></ion-input>
            </ion-item>
          </ion-list>

          <ion-button expand="block" @click="handleSave" :disabled="profileStore.isUpdating">
            <LoadingSpinner v-if="profileStore.isUpdating" name="crescent" inline />
            Save changes
          </ion-button>

          <div class="work-section">
            <div class="work-header">
              <h3>Filmography</h3>
              <ion-button v-if="canEdit" @click="isAddWorkModalOpen = true">
                <ion-icon slot="icon-only" :icon="add"></ion-icon>
              </ion-button>
            </div>
            <WorkList @delete="handleDeleteWork" />
          </div>
        </div>

        <div v-else class="no-profile-container">
          <ion-icon :icon="personCircle" size="large" color="medium"></ion-icon>
          <h3>Voice actor profile not found</h3>
          <p>This voice actor profile could not be loaded.</p>
        </div>
      </div>

      <ion-modal :is-open="isAddWorkModalOpen" @didDismiss="isAddWorkModalOpen = false">
        <AddWorkModal @close="isAddWorkModalOpen = false" />
      </ion-modal>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, watch, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  IonModal,
  IonButtons
} from '@ionic/vue'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import WorkList from '@/components/profile/WorkList.vue';
import AddWorkModal from '@/components/profile/AddWorkModal.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';
import { alertCircle, personCircle, refresh, add, eye } from 'ionicons/icons';
import type { Tables } from '../../supabase/functions/_shared/database.types';

type VoiceActor = Tables<'voice_actors'>;

// Use any for editable profile to avoid deep type instantiation issues
type EditableVoiceActor = any;

const route = useRoute()
const router = useRouter()
const profileStore = useProfileStore()
const authStore = useAuthStore()

const editableProfile = ref<Partial<VoiceActor>>({});
const isAddWorkModalOpen = ref(false);

const voiceActorId = computed(() => {
  const id = route.params.id as string
  return parseInt(id, 10);
})

const canEdit = computed(() => {
  return authStore.isAdmin || true // Voice actor profiles can be edited by their owners
})


const retryLoadProfile = async () => {
  await profileStore.fetchProfile({ voiceActorId: voiceActorId.value })
}

const handleDeleteWork = async (workEntryId: number) => {
  await profileStore.removeWorkEntry(workEntryId, { voiceActorId: voiceActorId.value });
};

onMounted(async () => {
  await profileStore.fetchProfile({ voiceActorId: voiceActorId.value })
})

watch(() => route.params.id, async (newId) => {
  await profileStore.fetchProfile({ voiceActorId: parseInt(newId as string, 10) })
})

watch(() => profileStore.voiceActor, (newProfile) => {
  if (newProfile && profileStore.currentProfileType === 'voice_actor') {
    editableProfile.value = newProfile;
  } else if (!profileStore.hasProfile) {
    editableProfile.value = {} as Partial<VoiceActor>;
  }
}, { immediate: true });

const handleSave = async () => {
  if (profileStore.currentProfileType === 'voice_actor' && profileStore.voiceActor) {
    const updates: { [key: string]: any } = {};
    const editable = editableProfile.value as { [key: string]: any };
    const current = profileStore.voiceActor as { [key: string]: any };

    for (const key in editable) {
      if (editable[key] !== current[key]) {
        updates[key] = editable[key];
      }
    }

    if (Object.keys(updates).length > 0) {
      await profileStore.updateProfile(updates, { voiceActorId: voiceActorId.value });
    }
  }
};

const openPublicProfile = () => {
  if (profileStore.voiceActor) {
    router.push({ name: 'VoiceActorDetails', params: { id: profileStore.voiceActor.id } })
  }
}
</script>

<style scoped>
.loading-container,
.error-container,
.no-profile-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  text-align: center;
  padding: 2rem;
}

.error-container ion-icon,
.no-profile-container ion-icon {
  margin-bottom: 1rem;
  font-size: 3rem;
}

.error-container h3,
.no-profile-container h3 {
  margin: 1rem 0 0.5rem 0;
  color: var(--ion-color-primary);
}

.error-container p,
.no-profile-container p {
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
