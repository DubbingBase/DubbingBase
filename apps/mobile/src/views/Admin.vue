<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Admin</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-segment v-model="activeTab" scrollable class="admin-segment">
        <ion-segment-button value="duplicates">
          <ion-label>Doublons VA</ion-label>
        </ion-segment-button>
        <ion-segment-button value="users">
          <ion-label>Utilisateurs</ion-label>
        </ion-segment-button>
        <ion-segment-button value="work">
          <ion-label>Doublons Work</ion-label>
        </ion-segment-button>
        <ion-segment-button value="voice-actors">
          <ion-icon :icon="micOutline"></ion-icon>
          <ion-label>Voice Actors</ion-label>
        </ion-segment-button>
        <ion-segment-button value="user-va-profiles">
          <ion-icon :icon="micOutline"></ion-icon>
          <ion-label>User -- VA</ion-label>
        </ion-segment-button>
        <ion-segment-button value="queue">
          <ion-icon :icon="listOutline"></ion-icon>
          <ion-label>Queue</ion-label>
        </ion-segment-button>
      </ion-segment>

      <div v-if="activeTab === 'duplicates'">
        <DuplicateVATool />
      </div>
      <div v-if="activeTab === 'users'">
        <UserManagement />
      </div>
      <div v-if="activeTab === 'work'">
        <DuplicateWork />
      </div>
      <div v-if="activeTab === 'voice-actors'" class="ion-padding">
        <ion-button expand="block" @click="navigateToNewVoiceActor" class="new-voice-actor-btn">
          <ion-icon :icon="addCircleOutline" slot="start"></ion-icon>
          New Voice Actor
        </ion-button>
      </div>
      <div v-if="activeTab === 'user-va-profiles'" class="ion-padding">
        <LinkUserVoiceActor />
      </div>
      <div v-if="activeTab === 'queue'">
        <QueueManagement />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useIonRouter } from '@ionic/vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonButton,
  IonIcon
} from '@ionic/vue';
import { addCircleOutline, micOutline, listOutline } from 'ionicons/icons';
import DuplicateVATool from '@/components/admin/DuplicateVATool.vue';
import UserManagement from '@/components/admin/UserManagement.vue';
import DuplicateWork from '@/components/admin/DuplicateWork.vue';
import LinkUserVoiceActor from './admin/LinkUserVoiceActor.vue';
import QueueManagement from '@/components/admin/QueueManagement.vue';

const ionRouter = useIonRouter();
const activeTab = ref('duplicates');

const navigateToNewVoiceActor = () => {
  ionRouter.push('/admin/edit-voice-actor/new');
};
</script>

<style scoped>
ion-segment {
  margin: 1rem 0;
}

.new-voice-actor-btn {
  --padding-top: 1.5rem;
  --padding-bottom: 1.5rem;
  --border-radius: 8px;
  margin: 1rem 0;
  font-weight: 600;
  font-size: 1.1rem;
}

ion-tab-button {
  --color-selected: var(--ion-color-primary);
  --color: var(--ion-color-medium);
}

ion-icon {
  font-size: 1.5rem;
  margin-bottom: 0.25rem;
}
</style>
