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
        :path="`https://api.dicebear.com/9.x/initials/svg?scale=50&backgroundColor=212121&seed=${voiceActor.firstname} ${voiceActor.lastname}`"
        :width="60"
        :height="80"
      />
    </div>
    <div class="actor-info">
      <div class="actor-name">
        {{ voiceActor.firstname }} {{ voiceActor.lastname }}
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

interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  bio: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  awards: string | null;
  years_active: string | null;
  social_media_links: any | null;
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

  .actor-name {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;

    @media (max-width: 768px) {
      font-size: 1.3rem;
    }
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
