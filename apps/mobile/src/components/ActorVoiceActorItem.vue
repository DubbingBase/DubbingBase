<template>
  <div v-if="type === 'actor' && actor" class="actor-voice-actor-wrapper">
    <div class="character-name">
      <div v-for="role in actor.roles" :key="role.character">
        {{ role.character }}
      </div>
    </div>
    <div
      class="actor"
      @click="goToActor && goToActor(actor.id)"
      tabindex="0"
      role="button"
      :aria-label="`Go to details for ${actor.name}`"
    >
      <div>
        <MediaItem
          :imagePath="actor.profile_picture"
          :title="actor.name"
          routeName="ActorDetails"
          :routeParams="{ id: actor.id }"
        />
        <MediaItem
          v-for="(role, index) in actor.roles"
          :key="role.character"
          :imagePath="role.image"
          :routeName="'ActorDetails'"
          :routeParams="{ id: actor.id }"
        />
      </div>

      <AppText class="line-label">
        <span class="ellipsis label actor">{{ actor.name }}</span>
      </AppText>
    </div>
    <VoiceActorList
      v-if="voiceActors"
      :voiceActors="voiceActors"
      :actor="actor"
      :isAdmin="isAdmin || false"
      :goToVoiceActor="goToVoiceActor"
      :editVoiceActorLink="editVoiceActorLink || (() => {})"
      :confirmDeleteVoiceActorLink="confirmDeleteVoiceActorLink || (() => {})"
      :openVoiceActorSearch="openVoiceActorSearch || (() => {})"
    />
  </div>

  <div
    v-else-if="type === 'voice-actor' && item"
    class="actor-voice-actor-wrapper"
  >
    <div
      class="voice-actor"
      @click="
        goToVoiceActor && goToVoiceActor(item.voiceActorDetails?.id || item.id)
      "
      tabindex="0"
      role="button"
      :aria-label="`Go to details for ${getDisplayName()}`"
    >
      <MediaThumbnail
        v-if="getProfilePicture()"
        :path="getProfilePicture()"
        from-storage
      />
      <MediaThumbnail v-else :path="undefined" :fallbackPath="getAvatarFallbackUrl(getDisplayName())" />

      <AppText class="line-label">
        <span class="ellipsis label name">
          {{ getDisplayName() }}
        </span>
        <span v-if="getTags().length > 0" class="ellipsis label tags">
          {{ getTags().join(", ") }}
        </span>
        <span v-if="item.performance" class="ellipsis label performance">
          {{ item.performance }}
        </span>
      </AppText>

      <div class="voice-actor-actions" v-if="isAdmin">
        <AppButton
          fill="clear"
          size="small"
          @click.stop="editVoiceActorLink && editVoiceActorLink(item)"
          aria-label="Edit voice actor link"
        >
          <Pencil class="app-icon" />
        </AppButton>
        <AppButton
          fill="clear"
          size="small"
          @click.stop="
            confirmDeleteVoiceActorLink && confirmDeleteVoiceActorLink(item)
          "
          color="danger"
          aria-label="Delete voice actor link"
        >
          <Trash2 class="app-icon" />
        </AppButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue';
import AppText from '@/components/common/AppText.vue';
import Pencil from '~icons/lucide/pencil';
import Trash2 from '~icons/lucide/trash2';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';


import MediaItem from "@/components/MediaItem.vue";
import MediaThumbnail from "@/components/MediaThumbnail.vue";
import VoiceActorList from "@/components/VoiceActorList.vue";
import { PersonData } from "./PersonItem.vue";
import type { VoiceActorInfo } from "@/types/models";

import { getAvatarFallbackUrl } from "@/utils/image";

export type ItemType = "actor" | "voice-actor";

const props = defineProps<{
  type: ItemType;
  actor?: PersonData;
  item?: (PersonData & { profile_picture?: string; character?: string }) | (VoiceActorInfo & { tags?: string | string[]; dialogue?: boolean; songs?: boolean });
  goToActor?: (id: number) => void;
  goToVoiceActor: (id: number) => void;
  isAdmin?: boolean;
  editVoiceActorLink?: (item: Pick<VoiceActorInfo, 'work_id' | 'performance'>) => void;
  confirmDeleteVoiceActorLink?: (item: Pick<VoiceActorInfo, 'work_id'>) => void;
  openVoiceActorSearch?: (actorId: number) => void;
  voiceActors?: VoiceActorInfo[];
}>();

const getDisplayName = (): string => {
  if (!props.item) return "";

  switch (props.type) {
    case "actor":
      return props.item.name || props.item.character || "";
    case "voice-actor":
      return `${props.item.firstname || ""} ${
        props.item.lastname || ""
      }`.trim();
    default:
      return "";
  }
};

const getProfilePicture = (): string | undefined => {
  if (!props.item) return undefined;

  switch (props.type) {
    case "actor":
      return props.item.profile_path || props.item.profile_picture;
    case "voice-actor":
      return props.item.profile_picture;
    default:
      return undefined;
  }
};

const getTags = (): string[] => {
  if (!props.item || props.type !== "voice-actor") return [];

  // Extract tags from the item, could be in different formats
  if (Array.isArray(props.item.tags)) {
    return props.item.tags;
  }

  if (props.item.tags && typeof props.item.tags === "string") {
    return props.item.tags.split(",").map((tag: string) => tag.trim());
  }

  // Default tags based on common use cases
  const tags: string[] = [];
  if (props.item.dialogue) tags.push("dialogue");
  if (props.item.songs) tags.push("songs");

  return tags;
};
</script>

<style scoped lang="scss">
.actor-voice-actor-wrapper {
  display: flex;
  flex-direction: column;
  padding: 12px;
  margin: 0 8px;
  border-radius: 12px;
  gap: 8px;
  transition: all 0.3s ease;

  .actor,
  .voice-actor {
    width: 100%;
    display: flex;
    flex-direction: row;
    gap: 8px;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
  }

  @media (max-width: 768px) {
    padding: 8px;
    margin: 0 4px;
    border-radius: 8px;

    .actor,
    .voice-actor {
      padding: 6px;
      gap: 6px;
    }

    .line-label {
      margin-left: 8px;
    }
  }
}

.line-label {
  margin-left: 12px;
  width: 100%;
  display: flex;
  justify-content: space-between;
  flex-direction: column;

  .label {
    width: 100%;
    display: block;
    color: var(--app-color-text-primary);
    font-size: 14px;
    line-height: 1.4;
  }

  .name {
    font-weight: 600;
  }

  .tags {
    text-align: left;
    color: #b0b0b0;
    font-size: 12px;
    font-style: italic;
  }

  .performance {
    text-align: left;
    color: #b0b0b0;
    font-size: 12px;
  }
}

.voice-actor-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
  align-items: center;
}
</style>
