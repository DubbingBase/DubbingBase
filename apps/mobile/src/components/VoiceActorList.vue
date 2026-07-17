<template>
  <div class="voice-actor-list">
    <template v-if="voiceActors && voiceActors.length">
      <div class="voice-actor-container">
        <PersonItem
          v-for="item in voiceActors"
          :key="item.voiceActorDetails.id"
          type="voice-actor"
          :person="item.voiceActorDetails"
          @click="handlePersonClick"
        >
          <template #actions v-if="isAdmin">
            <AppButton fill="clear" size="small" @click.stop="editVoiceActorLink && editVoiceActorLink(item)">
              <Pencil class="app-icon" />
            </AppButton>
            <AppButton fill="clear" size="small" @click.stop="confirmDeleteVoiceActorLink && confirmDeleteVoiceActorLink(item)" color="danger">
              <Trash2 class="app-icon" />
            </AppButton>
          </template>
        </PersonItem>
      </div>
    </template>
    <NoVoiceActor
      v-else
      :actor="actor"
      :isAdmin="isAdmin || false"
      :openVoiceActorSearch="openVoiceActorSearch || (() => {})"
    />
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue';
import Pencil from '~icons/lucide/pencil';
import Trash2 from '~icons/lucide/trash2';


import PersonItem from "@/components/PersonItem.vue";
import NoVoiceActor from "@/components/NoVoiceActor.vue";

const props = defineProps<{
  voiceActors: any[];
  actor: any;
  isAdmin?: boolean;
  goToVoiceActor: (id: number) => void;
  editVoiceActorLink?: (item: any) => void;
  confirmDeleteVoiceActorLink?: (item: any) => void;
  openVoiceActorSearch?: (actorId: number) => void;
}>();

const handlePersonClick = (person: any) => {
  props.goToVoiceActor(person.id);
};
</script>

<style scoped lang="scss">
.voice-actor-list {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;
}

.voice-actor-container {
  width: 100%;
}
</style>
