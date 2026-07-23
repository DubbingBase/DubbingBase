<template>
  <div class="actors-list">
    <div class="inner-list">
      <template v-if="loading">
        <!-- Don't show anything while loading -->
      </template>
      <template v-else-if="actors && actors.length">
        <AppSearchbar
          v-model="searchQuery"
          :placeholder="t('common.search', 'Search...')"
          animated
          class="custom-searchbar"
        ></AppSearchbar>
        <ActorWithVoiceActors
          v-for="actor in filteredActors"
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
import AppSearchbar from '@/components/common/AppSearchbar.vue';
import ActorWithVoiceActors from "./ActorWithVoiceActors.vue";
import NoActors from "./NoActors.vue";
import { PersonData } from "./PersonItem.vue";
import { Actor } from "@supabase/functions/_shared/types";
import type { VoiceActorInfo } from "@/types/models";

import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();
const searchQuery = ref("");

// Props
const props = defineProps<{
  actors?: Array<{ id: number; name: string; profile_path?: string; roles?: Array<{ character?: string }>; character?: string }>;
  voiceActors?: Array<VoiceActorInfo>;
  goToActor: (id: number) => void;
  goToVoiceActor: (id: number) => void;
  loading?: boolean;
  mediaLanguage?: string;
  editVoiceActorLink?: (workItem: Pick<VoiceActorInfo, 'work_id' | 'performance'>) => void;
  confirmDeleteVoiceActorLink?: (workItem: Pick<VoiceActorInfo, 'work_id'>) => void;
  openVoiceActorSearch?: (actorId: number) => void;
  workType?: "movie" | "tv" | "season" | "episode";
  contentId?: string;
}>();

console.log("actors", props.actors);
console.log("voiceActors", props.voiceActors);

// Filter voice actors for a specific actor
const getVoiceActorsForActor = (actorId: number) => {
  if (!props.voiceActors) return [];
  return props.voiceActors.filter(
    (item) =>
      Number(item.tmdb_id) === Number(actorId) ||
      Number(('actor_id' in item ? item.actor_id : null)) === Number(actorId)
  );
};

const filteredActors = computed(() => {
  if (!props.actors) return [];
  if (!searchQuery.value) return props.actors;
  
  const query = searchQuery.value.toLowerCase();
  
  return props.actors.filter((actor) => {
    const actorName = (actor.name || "").toLowerCase();
    if (actorName.includes(query)) return true;
    
    if (actor.roles && actor.roles.some((role: { character?: string }) => (role.character || "").toLowerCase().includes(query))) {
      return true;
    }
    
    const voiceActors = getVoiceActorsForActor(actor.id);
    if (voiceActors.some((va) => (va.name || "").toLowerCase().includes(query))) {
      return true;
    }
    
    return false;
  });
});

// Wrapper functions to handle prop type requirements
const handleActorClick = (actor: PersonData<Actor>) => {
  props.goToActor(actor.id);
};

const handleVoiceActorClick = (voiceActor: { id: number }) => {
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
    color: var(--app-color-medium);
    font-style: italic;
    padding: 20px;

    p {
      margin: 0;
    }
  }
}
</style>
