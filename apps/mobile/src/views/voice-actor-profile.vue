<template>
  <ion-page>
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <template #start >
          <AppBackButton />
        </template>
        <AppTitle>{{ $t('profile.voiceActorProfile') }}</AppTitle>
        <template #end >
          <AppButton fill="clear" @click="isActionSheetOpen = true" aria-label="Menu">
            <EllipsisVertical class="app-icon" />
          </AppButton>
        </template>
      </AppToolbar>
    </AppHeader>

    <AppContent :fullscreen="true">
      <div v-if="profileStore.isLoadingProfile && !profileStore.isUpdating" class="loading-container">
        <LoadingSpinner name="crescent" />
      </div>

      <div v-else-if="profileStore.profileError" class="error-container">
        <AlertCircle class="app-icon" />
        <h3>Error loading profile</h3>
        <p>{{ profileStore.profileError }}</p>
        <AppButton @click="retryLoadProfile" fill="outline">
          <RefreshCw class="app-icon" />
          Retry
        </AppButton>
      </div>

      <div v-else class="profile-content">
        <div v-if="profileStore.hasProfile && editableProfile">
          <AppList>
            <AppListItem>
              <AppInput label="First name" label-placement="stacked" v-model="(editableProfile as any).firstname" :readonly="!canEdit"></AppInput>
            </AppListItem>
            <AppListItem>
              <AppInput label="Last name" label-placement="stacked" v-model="(editableProfile as any).lastname" :readonly="!canEdit"></AppInput>
            </AppListItem>
            <AppListItem>
              <AppTextarea label="Biography" label-placement="stacked" v-model="editableProfile.bio" :auto-grow="true" :readonly="!canEdit"></AppTextarea>
            </AppListItem>
            <AppListItem>
              <AppInput label="Nationality" label-placement="stacked" v-model="editableProfile.nationality" :readonly="!canEdit"></AppInput>
            </AppListItem>
            <AppListItem>
              <AppInput type="date" label="Date of birth" label-placement="stacked" v-model="editableProfile.date_of_birth" :readonly="!canEdit"></AppInput>
            </AppListItem>
            <AppListItem>
              <AppInput label="Awards" label-placement="stacked" v-model="(editableProfile as any).awards" :readonly="!canEdit"></AppInput>
            </AppListItem>
            <AppListItem>
              <AppInput label="Years active" label-placement="stacked" v-model="(editableProfile as any).years_active" :readonly="!canEdit"></AppInput>
            </AppListItem>
          </AppList>

          <AppButton v-if="canEdit" expand="block" @click="handleSave" :disabled="profileStore.isUpdating">
            <LoadingSpinner v-if="profileStore.isUpdating" name="crescent" inline />
            Save changes
          </AppButton>
          <AppButton v-else expand="block" fill="outline" disabled>
            <!-- TODO: Implement Suggest Changes feature -->
            {{ $t('common.suggestChanges') }}
          </AppButton>

          <div class="work-section">
            <div class="work-header">
              <h3>Filmography</h3>
              <AppButton v-if="canEdit" @click="isAddWorkModalOpen = true">
                <Plus class="app-icon" />
              </AppButton>
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

      <AppModal :is-open="isAddWorkModalOpen" @didDismiss="isAddWorkModalOpen = false">
        <AddWorkModal @close="isAddWorkModalOpen = false" />
      </AppModal>

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
import AppPage from '@/components/common/layout/AppPage.vue';
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
import AppModal from '@/components/common/AppModal.vue';
import AppList from '@/components/common/AppList.vue';
import AppListItem from '@/components/common/AppListItem.vue';
import AppButton from '@/components/common/AppButton.vue';
import AppInput from '@/components/common/AppInput.vue';
import AppTextarea from '@/components/common/AppTextarea.vue';
import Eye from '~icons/lucide/eye';
import AlertCircle from '~icons/lucide/alert-circle';
import RefreshCw from '~icons/lucide/refresh-cw';
import Plus from '~icons/lucide/plus';
import UserCircle from '~icons/lucide/user-circle';
import EllipsisVertical from "~icons/lucide/ellipsis-vertical";
import { onMounted, watch, computed, ref } from 'vue'
import AppBackButton from '@/components/common/AppBackButton.vue'
import AppActionSheet, { ActionSheetButton } from "@/components/common/AppActionSheet.vue";
import { useRoute, useRouter } from 'vue-router'
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
const isActionSheetOpen = ref(false);

const actionSheetButtons = computed<ActionSheetButton[]>(() => {
  return [
    {
      text: t('common.publicProfile', 'Profil public'),
      icon: Eye,
      handler: () => openPublicProfile(),
    },
    {
      text: t('common.cancel', 'Annuler'),
      role: 'cancel',
    },
  ];
});

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
        body: { id: voiceActorId.value }});
      console.log("[loadProfileData] voice-actor response:", { data, error });
      if (data && data.voiceActor) {
        // The edge function returns work rows in data.voiceActor.work and medias in data.medias
        const medias = data.medias || [];
        const mappedWorks = (data.voiceActor.work || []).map((work: any) => {
          const media = medias.find((m: any) => m.id === work.dubbing_projects?.content_id);
          
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
            media_id: work.dubbing_projects?.content_id,
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
  color: var(--app-color-primary);
}

.error-container p,
.no-profile-container p {
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
</style>
