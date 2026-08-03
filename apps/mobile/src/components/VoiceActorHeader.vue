<template>
  <div class="voice-actor-header">
    <div class="profile-picture">
      <MediaThumbnail
        v-if="profilePicture"
        :path="profilePicture"
        :width="60"
        :height="80"
        @click="uploadImage"
      />
      <MediaThumbnail
        v-else
        @click="uploadImage"
        :path="getAvatarFallbackUrl(`${voiceActor.firstname} ${voiceActor.lastname}`)"
        :width="60"
        :height="80"
      />
    </div>
    <div class="actor-info">
      <div class="actor-name-row">
        <div class="actor-name">
          {{ voiceActor.firstname }} {{ voiceActor.lastname }}
        </div>
        <button 
          v-if="authStore.user"
          class="notify-btn" 
          :class="{ 'is-subscribed': isSubscribed }"
          @click="toggleSubscription"
          :disabled="isLoading"
          :title="isSubscribed ? t('common.unsubscribe', 'Se désabonner') : t('common.subscribe', 'S\'abonner')"
        >
          <BellRing v-if="isSubscribed && !isLoading" class="icon" />
          <Bell v-else-if="!isSubscribed && !isLoading" class="icon" />
          <div v-if="isLoading" class="spinner"></div>
        </button>
      </div>
      <div class="actor-details">
        <div v-if="voiceActor.date_of_birth" class="detail-item">
          <span class="detail-value">{{
            new Date(voiceActor.date_of_birth).toLocaleDateString()
          }}</span>
        </div>
        <div v-if="voiceActor.years_active" class="detail-item">
          <span class="detail-value">{{ voiceActor.years_active }}</span>
        </div>
        <div v-if="voiceActor.awards" class="detail-item">
          <span class="detail-value">{{ voiceActor.awards }}</span>
        </div>
        <span v-if="voiceActor.nationality" class="nationality-tag">{{
          voiceActor.nationality
        }}</span>
      </div>
    </div>
    <ImageEditorModal
      :is-open="isEditorOpen"
      :image-file="selectedImageFile"
      :aspect-ratio="THUMBNAIL_DEFAULT_WIDTH / THUMBNAIL_DEFAULT_HEIGHT"
      @cancel="cancelCrop"
      @save="uploadCroppedImage"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import { useFileDialog } from "@vueuse/core";
import { supabase } from "../api/supabase";
import ImageEditorModal from "@/components/common/ImageEditorModal.vue";
import { THUMBNAIL_DEFAULT_WIDTH, THUMBNAIL_DEFAULT_HEIGHT } from "@/constants/thumbnails";
import { getAvatarFallbackUrl } from "@/utils/image";
import Bell from "~icons/lucide/bell";
import BellRing from "~icons/lucide/bell-ring";
import { useVoiceActorSubscription } from "@/composables/useVoiceActorSubscription";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "vue-i18n";

interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  awards: string | null;
  years_active: string | null;
  social_media_links: Record<string, unknown> | null;
  profile_picture: string | null;
  voice_actor_name: string | null;
}

interface Props {
  voiceActor: VoiceActor;
  profilePicture: string | null | undefined;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  profilePictureChanged: [value: string];
}>();

const { t } = useI18n();
const authStore = useAuthStore();
const { isSubscribed, isLoading, fetchSubscription, toggleSubscription } = useVoiceActorSubscription(() => props.voiceActor.id.toString());

import { onMounted, watch } from "vue";
onMounted(() => {
  fetchSubscription();
});

watch(() => props.voiceActor.id, () => {
  fetchSubscription();
});

const isEditorOpen = ref(false);
const selectedImageFile = ref<File | null>(null);

const { open, onChange, reset } = useFileDialog({
  accept: "image/*",
  directory: false,
});

onChange((files) => {
  const file = files?.[0];
  if (!file) {
    return;
  }
  selectedImageFile.value = file;
  isEditorOpen.value = true;
});

const cancelCrop = () => {
  isEditorOpen.value = false;
  selectedImageFile.value = null;
  reset();
};

const uploadCroppedImage = async (blob: Blob, originalFile: File) => {
  const formData = new FormData();
  // Append the cropped blob as a file
  formData.append("file", blob, originalFile.name);
  if (props.voiceActor?.id) {
    formData.append("voice_actor_id", props.voiceActor.id.toString());
  }

  try {
    const { data } = await supabase.functions.invoke("upload_profile_picture", {
      body: formData,
    });

    console.log("Upload response:", data);

    if (data?.publicUrl) {
      console.log("Emitting profilePictureChanged with:", data.publicUrl);
      emit("profilePictureChanged", data.publicUrl);
    } else {
      console.error("No publicUrl in upload response:", data);
    }
  } catch (error) {
    console.error("Error uploading profile picture:", error);
  } finally {
    isEditorOpen.value = false;
    selectedImageFile.value = null;
    reset();
  }
};

const uploadImage = async () => {
  open();
};
</script>

<style scoped lang="scss">
.voice-actor-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  margin-bottom: 8px;

  @media (max-width: 768px) {
    padding: 8px;
    gap: 10px;
  }

  .profile-picture {
    flex-shrink: 0;
    cursor: pointer;
    transition: transform 0.2s ease;

    &:hover {
      transform: scale(1.02);
    }

    img {
      height: var(--thumbnail-height);
      width: var(--thumbnail-width);
      object-fit: cover;
      border-radius: var(--thumbnail-border-radius);
      border: var(--thumbnail-border);
      box-shadow: var(--thumbnail-box-shadow);
      color: transparent;
      outline: none;
      background: var(--app-color-step-100, #1e1e1e);

      @media (max-width: 768px) {
        height: 80px;
        width: 60px;
      }
    }
  }

  .actor-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .actor-name-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .actor-name {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;
    color: var(--app-color-text-primary);

    @media (max-width: 768px) {
      font-size: 1.3rem;
    }
  }

  .notify-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background-color: var(--app-color-step-100, #1e1e1e);
    color: var(--app-color-text-secondary, #9ca3af);
    cursor: pointer;
    transition: all 0.2s ease;
    flex-shrink: 0;
    
    &:hover {
      background-color: var(--app-color-step-150, #2d2d2d);
      color: var(--app-color-text-primary, #ffffff);
    }
    
    &.is-subscribed {
      background-color: rgba(59, 130, 246, 0.15); /* var(--app-color-primary) with opacity */
      color: var(--app-color-primary, #3b82f6);
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .icon {
      font-size: 1.2rem;
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .actor-details {
    display: flex;
    flex-direction: column;
    gap: 4px;

    .detail-item {
      font-size: 0.9rem;
      margin-bottom: 2px;

      .detail-value {
        color: var(--app-color-text-secondary);
        font-weight: 400;
      }
    }

    .nationality-tag {
      display: inline-block;
      background: var(--app-color-primary);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-top: 0.25rem;
      align-self: flex-start;

      @media (max-width: 768px) {
        align-self: flex-start;
      }
    }
  }
}
</style>
