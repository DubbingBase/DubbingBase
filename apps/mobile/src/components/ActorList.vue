<template>
  <div class="actors-list">
    <div class="inner-list">
      <template v-if="loading">
        <!-- Don't show anything while loading -->
      </template>
      <template v-else-if="actors && actors.length">
        <ActorWithVoiceActors
          v-for="actor in actors"
          :key="actor.id"
          :actor="actor"
          :voiceActors="getVoiceActorsForActor(actor.id)"
          :onActorClick="handleActorClick"
          :onVoiceActorClick="handleVoiceActorClick"
          :mediaLanguage="mediaLanguage"
          :editVoiceActorLink="editVoiceActorLink"
          :confirmDeleteVoiceActorLink="confirmDeleteVoiceActorLink"
          :openVoiceActorSearch="openVoiceActorSearch"
          :workType="workType"
          :contentId="contentId"
        />
      </template>
      <template v-else>
        <NoActors />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActorWithVoiceActors from "./ActorWithVoiceActors.vue";
import NoActors from "./NoActors.vue";
import { PersonData } from "./PersonItem.vue";
import { VoiceActorDetails } from "../../supabase/functions/_shared/types";

// Props
const props = defineProps<{
  actors?: PersonData[];
  voiceActors?: PersonData<VoiceActorDetails>[];
  goToActor: (id: number) => void;
  goToVoiceActor: (id: number) => void;
  loading?: boolean;
  mediaLanguage?: string;
  editVoiceActorLink?: (workItem: any) => void;
  confirmDeleteVoiceActorLink?: (workItem: any) => void;
  openVoiceActorSearch?: (actorId: number) => void;
  workType?: "movie" | "tv" | "season" | "episode";
  contentId?: string;
}>();

console.log("actors", props.actors);
console.log("voiceActors", props.voiceActors);

// Filter voice actors for a specific actor
const getVoiceActorsForActor = (actorId: number) => {
  if (!props.voiceActors) return [];
  // console.log('props.voiceActors', props.voiceActors)
  return props.voiceActors.filter((item) => item.tmdb_id === actorId);
};

// Wrapper functions to handle prop type requirements
const handleActorClick = (actor: any) => {
  props.goToActor(actor.id);
};

const handleVoiceActorClick = (voiceActor: any) => {
  props.goToVoiceActor(voiceActor.id);
};
</script>

<style scoped lang="scss">
.actors-list {
  z-index: 1;
  position: relative;

  .inner-list {
    display: flex;
    gap: 12px;
    flex-direction: column;
    border-radius: 1.5rem;
    padding: 16px;

    @media (max-width: 768px) {
      padding: 12px;
      gap: 8px;
      border-radius: 1rem;
    }
  }

  .no-items {
    text-align: center;
    color: var(--ion-color-medium);
    font-style: italic;
    padding: 20px;

    p {
      margin: 0;
    }
  }
}
</style>
