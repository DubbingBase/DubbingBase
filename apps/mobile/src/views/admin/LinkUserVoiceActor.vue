<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Link User to Voice Actor</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonItem>
        <IonLabel position="stacked">Selected User</IonLabel>
        <IonInput
          v-model="selectedUserDisplay"
          readonly
          placeholder="Search and select a user"
          @click="openUserModal"
        />
        <IonButton slot="end" fill="clear" @click="openUserModal">
          <IonIcon :icon="search" />
        </IonButton>
      </IonItem>

      <IonItem>
        <IonLabel position="stacked">Selected Voice Actor</IonLabel>
        <IonInput
          v-model="selectedVoiceActorDisplay"
          readonly
          placeholder="Search and select a voice actor"
          @click="openVoiceActorModal"
        />
        <IonButton slot="end" fill="clear" @click="openVoiceActorModal">
          <IonIcon :icon="search" />
        </IonButton>
      </IonItem>

      <IonButton
        expand="block"
        :disabled="!selectedUser || !selectedVoiceActor || linking"
        @click="linkUserVoiceActor"
      >
        <IonSpinner v-if="linking" slot="start" name="crescent" />
        Link User to Voice Actor
      </IonButton>

      <!-- User Search Modal -->
      <IonModal :is-open="userModalOpen" @didDismiss="closeUserModal">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Search Users</IonTitle>
            <IonButton slot="end" fill="clear" @click="closeUserModal">Close</IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonSearchbar
            v-model="userQuery"
            placeholder="Search users..."
            @ionInput="searchUsers"
          />
          <IonList v-if="userResults.length > 0">
            <IonItem
              v-for="user in userResults"
              :key="user.id"
              button
              @click="selectUser(user)"
            >
              <IonIcon :icon="person" slot="start" />
              <IonLabel>
                <h2>{{ user.email }}</h2>
                <p>{{ user.id }}</p>
              </IonLabel>
            </IonItem>
          </IonList>
          <IonText v-else-if="userQuery && !userLoading" color="medium">
            No users found
          </IonText>
          <IonSpinner v-if="userLoading" name="crescent" />
        </IonContent>
      </IonModal>

      <!-- Voice Actor Search Modal -->
      <IonModal :is-open="voiceActorModalOpen" @didDismiss="closeVoiceActorModal">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Search Voice Actors</IonTitle>
            <IonButton slot="end" fill="clear" @click="closeVoiceActorModal">Close</IonButton>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <IonSearchbar
            v-model="voiceActorQuery"
            placeholder="Search voice actors..."
            @ionInput="searchVoiceActors"
          />
          <IonList v-if="voiceActorResults.length > 0">
            <IonItem
              v-for="va in voiceActorResults"
              :key="va.id"
              button
              @click="selectVoiceActor(va)"
            >
              <IonIcon :icon="mic" slot="start" />
              <IonLabel>
                <h2>{{ va.firstname }} {{ va.lastname }}</h2>
              </IonLabel>
            </IonItem>
          </IonList>
          <IonText v-else-if="voiceActorQuery && !voiceActorSearching" color="medium">
            No voice actors found
          </IonText>
          <IonSpinner v-if="voiceActorSearching" name="crescent" />
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonModal,
  IonList,
  IonSearchbar,
  IonSpinner,
  IonText,
  IonIcon,
  toastController,
} from '@ionic/vue'
import { search, person, mic } from 'ionicons/icons'
import { ref, computed } from 'vue'
import { supabase } from '@/api/supabase'
import type { Response } from '@/types/UserList'
import { User } from '@supabase/supabase-js'

// Reactive data
const selectedUser = ref<User>()
const selectedVoiceActor = ref<any>()
const userModalOpen = ref(false)
const voiceActorModalOpen = ref(false)
const userQuery = ref('')
const voiceActorQuery = ref('')
const userResults = ref<User[]>([])
const voiceActorResults = ref<any[]>([])
const allUsers = ref<Response>({ users: [] })
const usersFetched = ref(false)
const userLoading = ref(false)
const voiceActorSearching = ref(false)
const linking = ref(false)

// Computed
const selectedUserDisplay = computed(() => selectedUser.value ? selectedUser.value.email : '')
const selectedVoiceActorDisplay = computed(() => selectedVoiceActor.value ? selectedVoiceActor.value.firstname + ' ' + selectedVoiceActor.value.lastname : '')

// Functions
const openUserModal = async () => {
  if (!usersFetched.value) {
    userLoading.value = true
    try {
      const { data, error } = await supabase.functions.invoke<Response>('list_users', {
        body: {}
      })
      if (error) throw error
      allUsers.value = data ?? (({ users: [] }) satisfies Response)
      usersFetched.value = true
    } catch (error) {
      console.error('Error fetching users:', error)
      await showToast('Error fetching users', 'danger')
    } finally {
      userLoading.value = false
    }
  }
  userModalOpen.value = true
  searchUsers()
}

const closeUserModal = () => {
  userModalOpen.value = false
  userQuery.value = ''
  userResults.value = []
}

const openVoiceActorModal = () => {
  voiceActorModalOpen.value = true
}

const closeVoiceActorModal = () => {
  voiceActorModalOpen.value = false
  voiceActorQuery.value = ''
  voiceActorResults.value = []
}

const searchUsers = () => {
  if (!userQuery.value.trim()) {
    userResults.value = allUsers.value.users
  } else {
    const query = userQuery.value.toLowerCase()
    userResults.value = allUsers.value.users.filter(user => user.email?.toLowerCase().includes(query))
  }
}

const searchVoiceActors = async () => {
  if (!voiceActorQuery.value.trim()) {
    voiceActorResults.value = []
    return
  }
  voiceActorSearching.value = true
  try {
    const { data, error } = await supabase.functions.invoke('search-voice-actors', {
      body: { query: voiceActorQuery.value }
    })
    if (error) throw error
    voiceActorResults.value = data || []
  } catch (error) {
    console.error('Error searching voice actors:', error)
    await showToast('Error searching voice actors', 'danger')
  } finally {
    voiceActorSearching.value = false
  }
}

const selectUser = (user: any) => {
  selectedUser.value = user
  closeUserModal()
}

const selectVoiceActor = (va: any) => {
  selectedVoiceActor.value = va
  closeVoiceActorModal()
}

const linkUserVoiceActor = async () => {
  if (!selectedUser.value || !selectedVoiceActor.value) {
    await showToast('Please select both user and voice actor', 'warning')
    return
  }
  linking.value = true
  try {
    const { error } = await supabase.functions.invoke('link-user-voice-actor', {
      body: {
        user_id: selectedUser.value.id,
        voice_actor_id: selectedVoiceActor.value.id
      }
    })
    if (error) throw error
    await showToast('User linked to voice actor successfully', 'success')
    // Clear selections
    selectedUser.value = undefined
    selectedVoiceActor.value = undefined
  } catch (error) {
    console.error('Error linking user to voice actor:', error)
    await showToast('Error linking user to voice actor', 'danger')
  } finally {
    linking.value = false
  }
}

const showToast = async (message: string, color: string) => {
  const toast = await toastController.create({
    message,
    duration: 2000,
    color,
  })
  await toast.present()
}
</script>

<style scoped>
ion-item {
  --padding-start: 16px;
  --inner-padding-end: 16px;
}
</style>
