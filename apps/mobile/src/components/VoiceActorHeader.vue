<template>
  <div class="voice-actor-header">
    <div class="profile-picture">
      <MediaThumbnail
        v-if="profilePicture"
        :path="profilePicture"
        @click="uploadImage"
      />
      <MediaThumbnail
        v-else
        @click="uploadImage"
        :path="`https://api.dicebear.com/9.x/initials/svg?scale=50&backgroundColor=212121&seed=${voiceActor.firstname} ${voiceActor.lastname}`"
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
  </div>
</template>

<script setup lang="ts">
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import { useFileDialog } from "@vueuse/core";
import { supabase } from "../api/supabase";

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

const { open, onChange } = useFileDialog({
  accept: "image/*",
  directory: false,
});

onChange(async (files) => {
  const file = files?.[0];
  if (!file) {
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
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
  }
});

const uploadImage = async () => {
  open();
};
</script>

<style scoped lang="scss">
.voice-actor-header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--ion-color-card);
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid var(--ion-color-border);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
    text-align: center;
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

      @media (max-width: 768px) {
        height: 100px;
        width: 75px;
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
    font-size: 1.8rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;

    @media (max-width: 768px) {
      font-size: 1.5rem;
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
        color: var(--ion-color-text-secondary);
        font-weight: 400;
      }
    }

    .nationality-tag {
      display: inline-block;
      background: var(--ion-color-primary);
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-top: 0.25rem;
      align-self: flex-start;

      @media (max-width: 768px) {
        align-self: center;
      }
    }
  }
}
</style>
