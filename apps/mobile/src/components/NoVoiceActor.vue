<template>
  <div class="no-voice-actor">
    <div class="voice-actor-container">
      <div class="voice-actor">
        <ion-thumbnail class="avatar">
          <img src="https://placehold.co/48x72?text=?" alt="No photo" />
        </ion-thumbnail>
        <ion-label class="line-label">
          <span class="ellipsis label">
            No voice actor found.
          </span>
          <ion-button v-if="isAdmin" fill="clear" size="small" @click.stop="openVoiceActorSearch(actor)" class="add-voice-actor-btn">
            <ion-icon :icon="personAddOutline" slot="start"></ion-icon>
            Add
          </ion-button>
        </ion-label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  IonThumbnail,
  IonLabel,
  IonButton,
  IonIcon,
} from "@ionic/vue";
import { personAddOutline } from 'ionicons/icons';

// Props
defineProps<{
  actor: any;
  isAdmin: boolean;
  openVoiceActorSearch: (actor: any) => void;
}>();
</script>

<style scoped lang="scss">
.avatar {
  --border-radius: 4px;
  width: 48px;
  height: auto;
  min-height: 72px;
  flex: 1 0 auto;
}

.line-label {
  margin-left: 8px;
  width: 100%;
  display: flex;
  justify-content: space-between;

  .label {
    width: 100%;
    display: block;
  }
}

.voice-actor-container {
  width: 100%;
}

.voice-actor {
  background-color: #666;
  flex: 1 0 auto;
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 4px;
  border-radius: 4px;
  padding: 4px;
}

.no-voice-actor {
  color: var(--ion-color-medium);
  font-style: italic;
  text-align: center;
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.add-voice-actor-btn {
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 8px;
  --padding-bottom: 8px;
  font-size: 0.85rem;
  height: auto;
  margin-top: 4px;
}

.add-voice-actor-btn ion-icon {
  margin-right: 4px;
}
</style>
