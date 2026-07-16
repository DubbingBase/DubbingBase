<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <button @click="router.back()" class="custom-back-button">
            &larr;
          </button>
        </ion-buttons>
        <ion-title>{{ $t('profile.voiceActorProfile') }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="openPublicProfile">
            <Eye class="app-icon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <div v-if="profileStore.isLoadingProfile && !profileStore.isUpdating" class="loading-container">
        <LoadingSpinner name="crescent" />
      </div>

      <div v-else-if="profileStore.profileError" class="error-container">
        <AlertCircle class="app-icon" />
        <h3>Error loading profile</h3>
        <p>{{ profileStore.profileError }}</p>
        <ion-button @click="retryLoadProfile" fill="outline">
          <RefreshCw class="app-icon" />
          Retry
        </ion-button>
      </div>

      <div v-else class="profile-content">
        <div v-if="profileStore.hasProfile && editableProfile">
          <ion-list>
            <ion-item>
              <ion-input label="First name" label-placement="stacked" v-model="(editableProfile as any).firstname" :readonly="!canEdit"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input label="Last name" label-placement="stacked" v-model="(editableProfile as any).lastname" :readonly="!canEdit"></ion-input>
            </ion-item>
            <ion-item>
              <ion-textarea label="Biography" label-placement="stacked" v-model="editableProfile.bio" :auto-grow="true" :readonly="!canEdit"></ion-textarea>
            </ion-item>
            <ion-item>
              <ion-input label="Nationality" label-placement="stacked" v-model="editableProfile.nationality" :readonly="!canEdit"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input type="date" label="Date of birth" label-placement="stacked" v-model="editableProfile.date_of_birth" :readonly="!canEdit"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input label="Awards" label-placement="stacked" v-model="(editableProfile as any).awards" :readonly="!canEdit"></ion-input>
            </ion-item>
            <ion-item>
              <ion-input label="Years active" label-placement="stacked" v-model="(editableProfile as any).years_active" :readonly="!canEdit"></ion-input>
            </ion-item>
          </ion-list>

          <ion-button v-if="canEdit" expand="block" @click="handleSave" :disabled="profileStore.isUpdating">
            <LoadingSpinner v-if="profileStore.isUpdating" name="crescent" inline />
            Save changes
          </ion-button>
          <ion-button v-else expand="block" fill="outline" disabled>
            <!-- TODO: Implement Suggest Changes feature -->
            {{ $t('common.suggestChanges') }}
          </ion-button>

          <div class="work-section">
            <div class="work-header">
              <h3>Filmography</h3>
              <ion-button v-if="canEdit" @click="isAddWorkModalOpen = true">
                <Plus class="app-icon" />
              </ion-button>
            </div>
            <WorkList :can-edit="canEdit" @delete="handleDeleteWork" />
          </div>
        </div>

        <div v-else class="no-profile-container">
          <UserCircle class="app-icon" />
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
import Eye from '~icons/lucide/eye';
import AlertCircle from '~icons/lucide/alert-circle';
import RefreshCw from '~icons/lucide/refresh-cw';
import Plus from '~icons/lucide/plus';
import UserCircle from '~icons/lucide/user-circle';
import { onMounted, watch, computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonList, IonItem, IonInput, IonTextarea, IonModal, IonButtons } from '@ionic/vue';
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import WorkList from '@/components/profile/WorkList.vue';
import AddWorkModal from '@/components/profile/AddWorkModal.vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue';

import type { Tables } from '@/utils/database';
import { supabase } from '@/api/supabase';

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
  return authStore.isAdmin || profileStore.voiceActors.some((va: any) => va.id === voiceActorId.value)
})


const retryLoadProfile = async () => {
  await profileStore.fetchProfile({ voiceActorId: voiceActorId.value })
}

const handleDeleteWork = async (workEntryId: number) => {
  await profileStore.removeWorkEntry(workEntryId, { voiceActorId: voiceActorId.value });
};

const loadProfileData = async () => {
  console.log("[loadProfileData] Starting fetchProfile for voiceActorId:", voiceActorId.value);
  await profileStore.fetchProfile({ voiceActorId: voiceActorId.value })
  
  console.log("[loadProfileData] currentVoiceActor.id:", profileStore.currentVoiceActor?.id);
  
  if (profileStore.currentVoiceActor?.id !== voiceActorId.value) {
    console.log("[loadProfileData] Voice actor mismatch, fetching directly via 'voice-actor' function");
    try {
      const { data, error } = await supabase.functions.invoke("voice-actor", {
        body: { id: voiceActorId.value },
      });
      console.log("[loadProfileData] voice-actor response:", { data, error });
      if (data && data.voiceActor) {
        // The edge function returns work rows in data.voiceActor.work and medias in data.medias
        const medias = data.medias || [];
        const mappedWorks = (data.voiceActor.work || []).map((work: any) => {
          const media = medias.find((m: any) => m.id === work.content_id);
          
          let character_name = '';
          if (media && media.credits && media.credits.cast) {
            const actor = media.credits.cast.find((c: any) => c.id === work.actor_id);
            if (actor) {
              character_name = actor.character;
            }
          }
          
          return {
            id: work.id,
            voice_actor_id: work.voice_actor_id,
            media_type: work.content_type === 'tv' ? 'serie' : work.content_type,
            media_id: work.content_id,
            character_name: character_name,
            performance: work.performance,
            media: media,
            actor_id: work.actor_id
          };
        });

        const voiceActorWithWorks = {
          ...data.voiceActor,
          medias: mappedWorks
        };
        profileStore.impersonateVoiceActor(voiceActorWithWorks);
        console.log("[loadProfileData] impersonated voice actor set successfully with works:", voiceActorWithWorks.medias.length);
      }
    } catch (e) {
      console.error("[loadProfileData] Error fetching specific voice actor:", e);
    }
  } else {
    console.log("[loadProfileData] Voice actor matched, no need to impersonate");
  }
}

onMounted(loadProfileData)

watch(() => route.params.id, loadProfileData)

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
.custom-back-button {
  background: transparent;
  color: white;
  border: none;
  font-size: 24px;
  padding: 0 16px;
  cursor: pointer;
}
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

.error-container .app-icon,
.no-profile-container .app-icon {
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
