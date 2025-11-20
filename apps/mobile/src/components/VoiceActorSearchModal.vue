<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Voice Actor</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">
            <ion-icon :icon="closeCircle"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <ion-searchbar
          v-model="searchTerm"
          @ionInput="handleSearchInput"
          placeholder="Search voice actors..."
          animated
          :debounce="300"
        ></ion-searchbar>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list v-if="searchResults.length > 0">
        <ion-item v-if="isSearching" class="ion-text-center">
          <LoadingSpinner></LoadingSpinner>
        </ion-item>
        <ion-item v-else-if="searchError" class="ion-text-center">
          <ion-text color="danger">{{ searchError }}</ion-text>
        </ion-item>
        <ion-item
          v-else-if="!searchResults.length && searchTerm"
          class="ion-text-center"
        >
          <ion-text>No voice actors found</ion-text>
        </ion-item>
        <ion-item
          v-for="va in searchResults"
          :key="va.id"
          button
          @click="
            () => {
              if (linkVoiceActor) linkVoiceActor(va, mediaId);
            }
          "
        >
          <ion-avatar slot="start" v-if="va.profile_picture">
            <img
              :src="va.profile_picture"
              :alt="va.firstname + ' ' + va.lastname"
            />
          </ion-avatar>
          <ion-avatar slot="start" v-else>
            <img
              src="https://placehold.co/40?text=VA"
              :alt="va.firstname + ' ' + va.lastname"
            />
          </ion-avatar>
          <ion-label>
            <h3>{{ va.firstname }} {{ va.lastname }}</h3>
            <p v-if="va.nationality">{{ va.nationality }}</p>
          </ion-label>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonContent,
  IonList,
  IonItem,
  IonText,
  IonAvatar,
  IonLabel,
} from "@ionic/vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { closeCircle } from "ionicons/icons";

interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture?: string;
  nationality?: string;
}

const props = defineProps<{
  isOpen: boolean;
  mediaId: string;
  workType: "movie" | "tv" | "season" | "episode";
  linkVoiceActor: (va: VoiceActor, mediaId: string) => void;
}>();

const { searchTerm, searchResults, isSearching, searchError } = useVoiceActorManagement(props.workType);

const handleSearchInput = (event: any) => {
  const value = event.target.value;
  searchTerm.value = value;
};
</script>

<style scoped lang="scss">
// Add any specific styles if needed
</style>
