<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Admin' }" />
        </ion-buttons>
        <ion-title>{{ isEditMode ? 'Edit Voice Actor' : 'Create Voice Actor' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content :fullscreen="true">
      <div class="container">
        <form @submit.prevent="saveVoiceActor">
          <ion-item>
            <ion-label position="floating">First Name</ion-label>
            <ion-input v-model="firstname" required />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Last Name</ion-label>
            <ion-input v-model="lastname" required />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Bio</ion-label>
            <ion-textarea v-model="bio" auto-grow />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Nationality</ion-label>
            <ion-input v-model="nationality" />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Date of Birth</ion-label>
            <ion-datetime v-model="dateOfBirth" presentation="date" />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Awards</ion-label>
            <ion-input v-model="awards" />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Years Active</ion-label>
            <ion-input v-model="yearsActive" />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Social Media Links (JSON)</ion-label>
            <ion-textarea v-model="socialMediaLinks" auto-grow />
          </ion-item>
          <ion-item>
            <ion-label position="floating">TMDb ID (future use)</ion-label>
            <ion-input v-model="tmdbId" type="number" />
          </ion-item>
          <ion-item>
            <ion-label position="floating">Wikidata ID</ion-label>
            <ion-input v-model="wikidataId" />
          </ion-item>
          <ion-item lines="none" class="profile-picture-upload">
            <ion-label>Profile Picture</ion-label>
            <div class="upload-container">
              <div class="image-preview">
                <MediaThumbnail
                  v-if="previewImage || profilePicture"
                  :path="previewImage || profilePicture"
                  alt="Profile Preview"
                  class="preview-image"
                />
                <div v-else class="no-image">
                  <ion-icon :icon="personOutline" size="large"></ion-icon>
                </div>
              </div>
              <div class="upload-controls">
                <ion-button fill="outline" size="small" @click="triggerFileInput">
                  <ion-icon :icon="cameraOutline" slot="start"></ion-icon>
                  {{ previewImage ? 'Change' : 'Upload' }} Photo
                </ion-button>
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  @change="onProfilePictureChange"
                  class="file-input"
                />
                <ion-button
                  v-if="previewImage"
                  fill="clear"
                  color="danger"
                  size="small"
                  @click="clearImage"
                >
                  <ion-icon :icon="trashOutline" slot="icon-only"></ion-icon>
                </ion-button>
              </div>
            </div>
          </ion-item>
          <div class="action-buttons">
            <ion-button expand="block" type="submit" :disabled="isSaving">
              <LoadingSpinner v-if="isSaving" name="crescent" :inline="true"></LoadingSpinner>
              <span v-else>Save</span>
            </ion-button>
          </div>
        </form>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { useIonRouter } from '@ionic/vue';

import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonItem, IonLabel, IonInput, IonBackButton, IonButtons, toastController, IonIcon
} from '@ionic/vue';
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import { cameraOutline, personOutline, trashOutline } from 'ionicons/icons';
import { supabase } from '@/api/supabase';
import MediaThumbnail from "@/components/MediaThumbnail.vue";


const route = useRoute();
const ionRouter = useIonRouter();
const id = route.params.id as string | undefined;
const isEditMode = computed(() => !!id && id !== 'new');

const firstname = ref('');
const lastname = ref('');
const bio = ref('');
const nationality = ref('');
const dateOfBirth = ref('');
const awards = ref('');
const yearsActive = ref('');
const socialMediaLinks = ref('');
const tmdbId = ref('');
const wikidataId = ref('');
const profilePicture = ref(''); // file path or URL
const profilePictureFile = ref<File | null>(null);
const previewImage = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const isSaving = ref(false);

onMounted(async () => {
  if (isEditMode.value && id) {
    const { data, error } = await supabase
      .from('voice_actors')
      .select('*')
      .eq('id', id)
      .single();
    if (!error && data) {
      firstname.value = data.firstname;
      lastname.value = data.lastname;
      bio.value = data.bio || '';
      nationality.value = data.nationality || '';
      dateOfBirth.value = data.date_of_birth || '';
      awards.value = data.awards || '';
      yearsActive.value = data.years_active || '';
      socialMediaLinks.value = data.social_media_links ? JSON.stringify(data.social_media_links, null, 2) : '';
      tmdbId.value = data.tmdb_id || '';
      profilePicture.value = data.profile_picture || '';
      wikidataId.value = data.wikidata_id || '';
    }
  }
});

function triggerFileInput() {
  fileInput.value?.click();
}

function clearImage() {
  if (fileInput.value) fileInput.value.value = '';
  profilePictureFile.value = null;
  previewImage.value = null;
}

function onProfilePictureChange(event: Event) {
  const files = (event.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    const file = files[0];
    profilePictureFile.value = file;

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.value = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
}

async function uploadProfilePicture(voiceActorId: string | number) {
  if (!profilePictureFile.value) return profilePicture.value;
  const formData = new FormData();
  formData.append('file', profilePictureFile.value);
  formData.append('voice_actor_id', String(voiceActorId));
  const response = await supabase.functions.invoke('upload_profile_picture', {
    body: formData,
  });
  const result = await response.data;
  if (result && result.ok) {
    // Optionally update profilePicture.value if returned
    // You may want to fetch latest data after upload
    return profilePictureFile.value.name;
  }
  return profilePicture.value;
}

async function saveVoiceActor() {
  isSaving.value = true;
  const upsertData: any = {
    firstname: firstname.value,
    lastname: lastname.value,
    bio: bio.value,
    nationality: nationality.value,
    date_of_birth: dateOfBirth.value || null,
    awards: awards.value,
    years_active: yearsActive.value,
    social_media_links: null,
    profile_picture: profilePicture.value || null,
    tmdb_id: tmdbId.value ? Number(tmdbId.value) : null,
    wikidata_id: wikidataId.value || null,
  };
  // Parse social media links JSON
  if (socialMediaLinks.value) {
    try {
      upsertData.social_media_links = JSON.parse(socialMediaLinks.value);
    } catch (e) {
      const toast = await toastController.create({ message: 'Invalid JSON in Social Media Links', color: 'danger', duration: 2000 });
      toast.present();
      isSaving.value = false;
      return;
    }
  }
  if (isEditMode.value && id) upsertData['id'] = id;
  // Upsert and get ID (for new actor, get returned id)
  const { data, error } = await supabase.from('voice_actors').upsert([upsertData]).select();
  let voiceActorId = id;
  if (!isEditMode.value && data && data.length > 0) {
    voiceActorId = data[0].id;
  }
  // Upload profile picture if file selected
  if (profilePictureFile.value && voiceActorId) {
    await uploadProfilePicture(voiceActorId);
  }
  isSaving.value = false;
  if (error) {
    const toast = await toastController.create({ message: 'Failed to save voice actor', color: 'danger', duration: 2000 });
    toast.present();
  } else {
    const toast = await toastController.create({ message: 'Voice actor saved!', color: 'success', duration: 1200 });
    toast.present();
    ionRouter.push('/admin/add-voice-cast');
  }
}
</script>

<style scoped>
  .action-buttons {
    padding: 20px;
    max-width: 500px;
    margin: 20px auto 0;
  }

  .profile-picture-upload {
    --min-height: 160px;
    --padding-start: 0;
    --inner-padding-end: 0;
    margin: 20px 0;
  }

  .upload-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .image-preview {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background-color: var(--ion-color-light);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px dashed var(--ion-color-medium);
  }

  .preview-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-image {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ion-color-medium);
  }

  .upload-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .file-input {
    display: none;
  }

  .container {
    max-width: 500px;
    margin: 0 auto;
    padding: 24px;
  }
</style>
