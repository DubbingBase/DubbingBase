<template>
  <div class="actor-wrapper">
    <div class="character-name">
      <div v-for="(role, index) in actor.roles" :key="role.character">
        {{ index > 0 ? "/ " : "" }} {{ role.character }}
      </div>
    </div>
    <div
      class="actor"
      @click="goToActor(actor.id)"
      :routerLink="{
        name: 'ActorDetails',
        params: { id: actor.id },
      }"
      tabindex="0"
      role="button"
      aria-label="Go to details for {{ actor.name }}"
    >
      <div>
        <MediaItem
          :imagePath="actor.profile_picture"
          :title="actor.name"
          :routeName="'ActorDetails'"
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
      <ion-label class="line-label">
        <span class="ellipsis label actor">{{ actor.name }}</span>
      </ion-label>
    </div>
    <VoiceActorList
      :voiceActors="voiceActors"
      :actor="actor"
      :isAdmin="isAdmin"
      :goToVoiceActor="goToVoiceActor"
      :editVoiceActorLink="editVoiceActorLink"
      :confirmDeleteVoiceActorLink="confirmDeleteVoiceActorLink"
      :openVoiceActorSearch="openVoiceActorSearch"
    />
  </div>
</template>

<script setup lang="ts">
import { IonLabel } from "@ionic/vue";
import MediaItem from "@/components/MediaItem.vue";
import VoiceActorList from "@/components/VoiceActorList.vue";
import { PersonData } from "./PersonItem.vue";

defineProps<{
  actor: PersonData;
  voiceActors: any[];
  isAdmin: boolean;
  goToActor: (id: number) => void;
  goToVoiceActor: (id: number) => void;
  editVoiceActorLink: (item: any) => void;
  confirmDeleteVoiceActorLink: (item: any) => void;
  openVoiceActorSearch: (actor: any) => void;
}>();
</script>

<style scoped lang="scss">
.avatar {
  --border-radius: 8px;
  width: 48px;
  height: auto;
  min-height: 72px;
  flex: 1 0 auto;
  border-radius: 8px;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
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
    color: #e0e0e0;
    font-size: 14px;
    line-height: 1.4;
  }

  .character {
    text-align: left;
    color: #b0b0b0;
    font-size: 12px;
  }

  .actor,
  .voice-actor {
    font-weight: 600;
  }
}

.actor-wrapper {
  display: flex;
  flex-direction: column;
  padding: 12px;
  margin: 0 8px;
  border-radius: 12px;
  gap: 8px;
  transition: all 0.3s ease;

  .character-name {
    font-size: 16px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 4px;
  }

  .actor {
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

    .actor {
      padding: 6px;
      gap: 6px;
    }

    .line-label {
      margin-left: 8px;
    }
  }
}
</style>
