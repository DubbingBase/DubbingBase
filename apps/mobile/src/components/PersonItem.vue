<template>
  <router-link class="no-link" :to="{ name: routeName, params: routeParams }">
    <div class="person-item">
      <MediaItem
        :image-path="image"
        :route-name="routeName"
        :route-params="routeParams"
        :width="THUMBNAIL_DEFAULT_WIDTH"
        :height="THUMBNAIL_DEFAULT_HEIGHT"
        :fallbackImagePath="`https://api.dicebear.com/9.x/initials/svg?scale=50&backgroundColor=212121&seed=${displayName}`"
      />

      <MediaItem
        v-for="role in person.roles?.filter((role) => role.image)"
        :key="role.character"
        :imagePath="role.image"
        :routeName="'ActorDetails'"
        :routeParams="{ id: person.id }"
        :width="THUMBNAIL_DEFAULT_WIDTH"
        :height="THUMBNAIL_DEFAULT_HEIGHT"
      />

      <div class="person-info">
        <div class="person-name">{{ displayName }}</div>
        <div v-if="subtitle" class="person-subtitle">{{ subtitle }}</div>
        <div v-if="tags.length > 0" class="person-tags">
          <span v-for="tag in tags" :key="tag" class="tag">{{ tag }}</span>
        </div>
      </div>

      <div class="person-actions">
        <slot name="actions"></slot>
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MediaItem from "@/components/MediaItem.vue";
import {
  THUMBNAIL_DEFAULT_HEIGHT,
  THUMBNAIL_DEFAULT_WIDTH,
} from "@/constants/thumbnails";

export interface Role {
  character: string;
  image?: string;
}

export interface PersonData<T = unknown | undefined> {
  id: number;
  name?: string;
  roles?: Role[];
  profile_picture?: string;
  performance?: string;
  tags?: string[] | string;
  tmdb_id: number;
  data: T;
  character?: string;
  // TODO: remove this as it's only for voice actors
  reviewed_status?: string | null;
  work_id: number;
}

const props = withDefaults(
  defineProps<{
    person: PersonData;
    type?: "actor" | "voice-actor";
    subtitleOverride?: string;
  }>(),
  {}
);

const displayName = computed(() => {
  if (props.person.name) return props.person.name;
  return "Unknown";
});

const image = computed(() => {
  return props.person.profile_picture;
});

const subtitle = computed(() => {
  if (props.subtitleOverride) {
    return props.subtitleOverride;
  }
  if (props.type === "actor" && props.person.character) {
    return props.person.character;
  }
  if (props.type === "voice-actor" && props.person.performance) {
    return props.person.performance;
  }
  return undefined;
});

const tags = computed(() => {
  if (!props.person.tags) return [];
  if (Array.isArray(props.person.tags)) {
    return props.person.tags;
  }
  if (typeof props.person.tags === "string") {
    return props.person.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
  return [];
});

const routeName = computed(() => {
  return props.type === "actor" ? "ActorDetails" : "VoiceActorDetails";
});

const routeParams = computed(() => {
  const id = props.type === "actor" ? props.person.tmdb_id : props.person.id;
  return { id };
});
</script>

<style scoped lang="scss">
.person-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.3s ease;

  &:focus-within {
    outline: 2px solid #007bff;
    outline-offset: 2px;
  }
}

.person-info {
  flex: 1;
  min-width: 0;

  .person-name {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
    line-height: 1.4;
    margin-bottom: 2px;
  }

  .person-subtitle {
    font-size: 12px;
    color: #b0b0b0;
    line-height: 1.2;
  }

  .person-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;

    .tag {
      display: inline-block;
      padding: 2px 6px;
      background-color: rgba(0, 123, 255, 0.2);
      color: #4dabf7;
      font-size: 10px;
      font-weight: 500;
      border-radius: 4px;
      border: 1px solid rgba(0, 123, 255, 0.3);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }
}

.person-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}

@media (max-width: 768px) {
  .person-item {
    padding: 6px;
    gap: 8px;
  }

  .person-info {
    .person-name {
      font-size: 13px;
    }

    .person-subtitle {
      font-size: 11px;
    }
  }

  .person-tags {
    .tag {
      font-size: 9px;
      padding: 1px 4px;
    }
  }
}
</style>
