<template>
  <AppModal :is-open="isOpen" @didDismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title>Select Voice Actor</ion-title>
        <ion-buttons slot="end">
          <AppButton @click="$emit('close')">
            <XCircle class="app-icon" />
          </AppButton>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar>
        <AppSearchbar
          v-model="searchTerm"
          @ionInput="handleSearchInput"
          placeholder="Search voice actors..."
          animated
          :debounce="300"
        ></AppSearchbar>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <!-- Loading state -->
      <AppListItem v-if="isSearching" class="ion-text-center">
        <LoadingSpinner></LoadingSpinner>
      </AppListItem>

      <!-- Error state -->
      <AppListItem v-else-if="searchError" class="ion-text-center">
        <AppText color="danger">{{ searchError }}</AppText>
      </AppListItem>

      <!-- No results state -->
      <AppListItem
        v-else-if="!searchResults.length && searchTerm"
        class="ion-text-center"
      >
        <AppText>No voice actors found</AppText>
      </AppListItem>

      <!-- Results list -->
      <AppList v-else-if="searchResults.length > 0">
        <AppListItem
          v-for="va in searchResults"
          :key="va.id"
          button
          @click="
            () => {
              if (linkVoiceActor) linkVoiceActor(va, mediaId);
            }
          "
        >
          <AppAvatar slot="start" v-if="va.profile_picture">
            <img
              :src="va.profile_picture"
              :alt="va.firstname + ' ' + va.lastname"
            />
          </AppAvatar>
          <AppAvatar slot="start" v-else>
            <img
              src="https://placehold.co/40?text=VA"
              :alt="va.firstname + ' ' + va.lastname"
            />
          </AppAvatar>
          <AppText>
            <h3>{{ va.firstname }} {{ va.lastname }}</h3>
            <p v-if="va.nationality">{{ va.nationality }}</p>
          </AppText>
        </AppListItem>
      </AppList>
    </ion-content>
  </AppModal>
</template>


<script setup lang="ts">
import AppModal from '@/components/common/AppModal.vue';
import AppList from '@/components/common/AppList.vue';
import AppListItem from '@/components/common/AppListItem.vue';
import AppAvatar from '@/components/common/AppAvatar.vue';
import AppButton from '@/components/common/AppButton.vue';
import AppSearchbar from '@/components/common/AppSearchbar.vue';
import AppText from '@/components/common/AppText.vue';
import XCircle from '~icons/lucide/x-circle';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';
import { IonButtons,   IonHeader, IonToolbar, IonTitle, IonContent, } from '@ionic/vue';
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
