<template>
  <div class="picture-editor">
    <div class="picture-container">
      <img
        v-if="currentPicture"
        :src="currentPicture"
        :alt="`${voiceActor?.firstname} ${voiceActor?.lastname}`"
        class="profile-picture"
      />
      <div v-else class="placeholder-picture">
        <ion-icon name="person-circle" size="large"></ion-icon>
      </div>

      <ion-button
        fill="clear"
        size="small"
        class="edit-button"
        @click="triggerFileInput"
      >
        <ion-icon name="camera" slot="icon-only"></ion-icon>
      </ion-button>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      @change="handleFileSelect"
      style="display: none"
    />

    <div v-if="isUploading" class="upload-status">
      <LoadingSpinner name="crescent" size="small" text="Upload en cours..." :inline="true"></LoadingSpinner>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { IonButton, IonIcon } from '@ionic/vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { useProfileStore } from '@/stores/profile'
import { supabase } from '@/api/supabase'

const profileStore = useProfileStore()
const fileInput = ref<HTMLInputElement>()
const isUploading = ref(false)

const voiceActor = computed(() => profileStore.voiceActor)
const currentPicture = computed(() => voiceActor.value?.profile_picture)

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Veuillez sélectionner une image valide.')
    return
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    alert('La taille du fichier ne doit pas dépasser 5MB.')
    return
  }

  await uploadProfilePicture(file)
}

const uploadProfilePicture = async (file: File) => {
  if (!voiceActor.value) return

  try {
    isUploading.value = true

    // Upload to Supabase Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${voiceActor.value.id}_${Date.now()}.${fileExt}`
    const filePath = `profile-pictures/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(filePath)

    // Update voice actor profile
    await profileStore.updateProfile({
      profile_picture: publicUrl
    })

  } catch (error: any) {
    console.error('Error uploading profile picture:', error)
    alert('Erreur lors du téléchargement de l\'image.')
  } finally {
    isUploading.value = false
  }
}
</script>

<style scoped>
.picture-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.picture-container {
  position: relative;
  width: 120px;
  height: 120px;
}

.profile-picture,
.placeholder-picture {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid var(--ion-color-primary);
}

.placeholder-picture {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ion-color-light);
  color: var(--ion-color-medium);
}

.edit-button {
  position: absolute;
  bottom: 0;
  right: 0;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  min-width: 32px;
  --background: var(--ion-color-primary);
  --color: white;
}

.upload-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--ion-color-primary);
}
</style>
