<template>
  <div class="profile-voice-actor-selector">
    <ion-item>
      <ion-label position="stacked">{{ $t('profile.selectedProfile') }}</ion-label>
      <ion-input
        :value="selectedProfileName"
        readonly
        :placeholder="$t('profile.selectProfilePlaceholder')"
        @click="openModal"
      />
    </ion-item>

    <ion-modal :is-open="isModalOpen" @didDismiss="closeModal">
      <ion-header>
        <ion-toolbar>
          <ion-title>{{ $t('profile.selectProfile') }}</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="closeModal">{{ $t('profile.close') }}</ion-button>
          </ion-buttons>
        </ion-toolbar>
        <ion-toolbar>
          <ion-searchbar
            v-model="searchTerm"
            :placeholder="$t('profile.searchPlaceholder')"
          />
        </ion-toolbar>
      </ion-header>
      <ion-content>
        <ion-list>
          <!-- User Profile Option -->
          <ion-item
            button
            @click="selectUserProfile"
          >
            <ion-label>{{ $t('profile.userProfile') }}</ion-label>
            <ion-icon slot="end" :icon="person" />
          </ion-item>

          <!-- User's Voice Actor Profiles -->
          <ion-item
            v-for="voiceActor in userVoiceActors"
            :key="`user-va-${voiceActor.id}`"
            button
            @click="selectVoiceActor(voiceActor)"
          >
            <ion-label>{{ voiceActor.firstname }} {{ voiceActor.lastname }} - {{ $t('profile.voiceActorProfile') }}</ion-label>
            <ion-icon slot="end" :icon="mic" />
          </ion-item>

          <!-- All Voice Actors (Admin only) -->
          <template v-if="authStore.isAdmin">
            <ion-item
              v-for="voiceActor in allVoiceActors"
              :key="`admin-va-${voiceActor.id}`"
              button
              @click="selectVoiceActor(voiceActor)"
            >
              <ion-label>{{ voiceActor.firstname }} {{ voiceActor.lastname }} - {{ $t('profile.adminVoiceActor') }}</ion-label>
              <ion-icon slot="end" :icon="mic" />
            </ion-item>
          </template>

          <!-- Add New Voice Actor Option (Admin only) -->
          <ion-item
            v-if="authStore.isAdmin"
            button
            @click="addNewVoiceActor"
          >
            <ion-label>+ {{ $t('profile.addNewVoiceActor') }}</ion-label>
            <ion-icon slot="end" :icon="add" />
          </ion-item>
        </ion-list>

        <LoadingSpinner v-if="isLoading" />
        <ErrorMessage v-if="errorMessage" :message="errorMessage" />
      </ion-content>
    </ion-modal>

    <ion-loading
      :is-open="isSwitching"
      :message="$t('profile.switchingProfile')"
      spinner="crescent"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  IonItem,
  IonLabel,
  IonInput,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSearchbar,
  IonList,
  IonIcon,
  IonLoading,
  alertController
} from '@ionic/vue'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { supabase } from '@/api/supabase'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import { person, mic, add } from 'ionicons/icons'

const { t } = useI18n()

interface Props {
  hasUnsavedChanges?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  hasUnsavedChanges: false
})

const router = useRouter()
const profileStore = useProfileStore()
const authStore = useAuthStore()

const isModalOpen = ref(false)
const isSwitching = ref(false)
const searchTerm = ref('')
const allVoiceActors = ref<any[]>([])
const isLoading = ref(false)
const errorMessage = ref('')

// Computed properties
const selectedProfileName = computed(() => {
  if (profileStore.currentProfileType === 'user_profile' && profileStore.userProfileData) {
    return t('profile.userProfile')
  } else if (profileStore.currentProfileType === 'voice_actor' && profileStore.currentVoiceActor) {
    return `${profileStore.currentVoiceActor.firstname} ${profileStore.currentVoiceActor.lastname} - ${t('profile.voiceActorProfile')}`
  }
  return ''
})

const userVoiceActors = computed(() => {
  return profileStore.allVoiceActors || []
})

// Methods
const openModal = () => {
  isModalOpen.value = true
  if (authStore.isAdmin) {
    loadAllVoiceActors()
  }
}

const closeModal = () => {
  isModalOpen.value = false
  searchTerm.value = ''
}

const selectUserProfile = async () => {
  if (props.hasUnsavedChanges) {
    const shouldProceed = await confirmSwitch()
    if (!shouldProceed) return
  }

  try {
    isSwitching.value = true
    profileStore.selectUserProfile()
    router.push({ name: 'Profile' })
    closeModal()
  } catch (error) {
    console.error('Error selecting user profile:', error)
    showError(t('profile.errorSelectingUserProfile'))
  } finally {
    isSwitching.value = false
  }
}

const selectVoiceActor = async (voiceActor: any) => {
  if (props.hasUnsavedChanges) {
    const shouldProceed = await confirmSwitch()
    if (!shouldProceed) return
  }

  try {
    isSwitching.value = true
    await profileStore.selectVoiceActor(voiceActor.id, {})
    router.push({ name: 'VoiceActorProfile', params: { id: voiceActor.id } })
    closeModal()
  } catch (error) {
    console.error('Error selecting voice actor:', error)
    showError(t('profile.errorSelectingVoiceActor'))
  } finally {
    isSwitching.value = false
  }
}

const addNewVoiceActor = () => {
  closeModal()
  router.push({ name: 'AddVoiceCast', params: { id: 'new' } })
}

const loadAllVoiceActors = async (query?: string) => {
  if (!authStore.isAdmin) return

  isLoading.value = true
  errorMessage.value = ''

  try {
    const requestBody = query && query.trim() ? { query: query.trim() } : {}
    const { data, error } = await supabase.functions.invoke('list-voice-actors', {
      body: requestBody
    })

    if (error) throw error
    allVoiceActors.value = data.voice_actors || []
  } catch (error) {
    console.error('Error loading voice actors:', error)
    errorMessage.value = t('profile.errorLoadingVoiceActors')
  } finally {
    isLoading.value = false
  }
}

const confirmSwitch = async (): Promise<boolean> => {
  const alert = await alertController.create({
    header: t('profile.unsavedChanges'),
    message: t('profile.unsavedChangesMessage'),
    buttons: [
      {
        text: t('common.cancel'),
        role: 'cancel',
        handler: () => false
      },
      {
        text: t('profile.continue'),
        handler: () => true
      }
    ]
  })

  await alert.present()
  const result = await alert.onDidDismiss()
  return result.role !== 'cancel'
}

const showError = (message: string) => {
  errorMessage.value = message
  setTimeout(() => {
    errorMessage.value = ''
  }, 3000)
}

// Debounced search functionality
let debounceTimer: ReturnType<typeof setTimeout> | undefined

const debouncedLoadVoiceActors = (query: string) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    loadAllVoiceActors(query)
  }, 300)
}

watch(searchTerm, (newValue) => {
  if (authStore.isAdmin) {
    debouncedLoadVoiceActors(newValue)
  }
})

onMounted(() => {
  if (authStore.isAdmin) {
    loadAllVoiceActors()
  }
})
</script>

<style scoped>
.profile-voice-actor-selector {
  padding: 1rem;
  border-bottom: 1px solid var(--ion-color-light-shade);
  background-color: var(--ion-color-light);
}

ion-item {
  --background: transparent;
  --border-radius: 8px;
  margin-bottom: 0.5rem;
}

ion-input {
  --background: var(--ion-color-light-tint);
  --border-radius: 8px;
  --padding-start: 12px;
  --padding-end: 12px;
}

ion-modal {
  --height: 80vh;
  --width: 90vw;
  --max-width: 500px;
  --max-height: 600px;
}

ion-list {
  padding: 0;
}

ion-item {
  --background: transparent;
  --border-color: var(--ion-color-light-shade);
  --border-width: 0 0 1px 0;
}

ion-item:last-child {
  --border-width: 0;
}

ion-icon {
  color: var(--ion-color-primary);
  margin-left: 0.5rem;
}

@media (max-width: 768px) {
  .profile-voice-actor-selector {
    padding: 0.5rem;
  }

  ion-modal {
    --height: 90vh;
    --width: 95vw;
  }
}
</style>
