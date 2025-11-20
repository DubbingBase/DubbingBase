<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Admin</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-tabs>
        <ion-router-outlet></ion-router-outlet>
        <ion-tab-bar slot="top">
          <ion-tab-button tab="duplicates" @click="activeTab = 'duplicates'">
            <ion-label>Doublons VA</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="users" @click="activeTab = 'users'">
            <ion-label>Utilisateurs</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="work" @click="activeTab = 'work'">
            <ion-label>Doublons Work</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="voice-actors" @click="activeTab = 'voice-actors'">
            <ion-icon :icon="micOutline"></ion-icon>
            <ion-label>Voice Actors</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="link-user-to-va" @click="activeTab = 'user-va-profiles'">
            <ion-icon :icon="micOutline"></ion-icon>
            <ion-label>User -- VA </ion-label>
          </ion-tab-button>
        </ion-tab-bar>
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
      </ion-tabs>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useIonRouter } from '@ionic/vue';
import {
  IonPage,
  IonHeader,
  IonRouterOutlet,
  IonToolbar,
  IonTitle,
  IonContent,
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonLabel,
  IonButton,
  IonBackButton,
  IonIcon
} from '@ionic/vue';
import { addCircleOutline, micOutline } from 'ionicons/icons';
import DuplicateVATool from '@/components/admin/DuplicateVATool.vue';
import UserManagement from '@/components/admin/UserManagement.vue';
import DuplicateWork from '@/components/admin/DuplicateWork.vue';
import LinkUserVoiceActor from './admin/LinkUserVoiceActor.vue';

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
