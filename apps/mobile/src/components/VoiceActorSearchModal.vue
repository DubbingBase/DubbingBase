<template>
  <ion-modal :is-open="isOpen" @didDismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Voice Actor</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">
            <XCircle class="app-icon" />
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
      <!-- Loading state -->
      <ion-item v-if="isSearching" class="ion-text-center">
        <LoadingSpinner></LoadingSpinner>
      </ion-item>

      <!-- Error state -->
      <ion-item v-else-if="searchError" class="ion-text-center">
        <AppText color="danger">{{ searchError }}</AppText>
      </ion-item>

      <!-- No results state -->
      <ion-item
        v-else-if="!searchResults.length && searchTerm"
        class="ion-text-center"
      >
        <AppText>No voice actors found</AppText>
      </ion-item>

      <!-- Results list -->
      <ion-list v-else-if="searchResults.length > 0">
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
          <AppText>
            <h3>{{ va.firstname }} {{ va.lastname }}</h3>
            <p v-if="va.nationality">{{ va.nationality }}</p>
          </AppText>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-modal>
</template>


<script setup lang="ts">
import AppText from '@/components/common/AppText.vue';
import XCircle from '~icons/lucide/x-circle';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonSearchbar, IonContent, IonList, IonItem, IonAvatar } from '@ionic/vue';
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { useVoiceActorManagement, type VoiceActor } from "@/composables/useVoiceActorManagement";
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
