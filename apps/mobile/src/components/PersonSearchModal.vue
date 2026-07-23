<template>
  <AppModal :is-open="isOpen" @didDismiss="$emit('close')">
    <AppHeader>
      <AppToolbar>
        <AppTitle>Select Person</AppTitle>
        <template #end >
          <AppButton fill="clear" color="text" @click="$emit('close')">
            <XCircle class="app-icon" />
          </AppButton>
        </template>
      </AppToolbar>
      <AppToolbar>
        <AppSearchbar
          v-model="searchTerm"
          @ionInput="handleSearchInput"
          placeholder="Search persons..."
          animated
          :debounce="300"
        ></AppSearchbar>
      </AppToolbar>
    </AppHeader>
    <AppContent class="ion-padding">
      <!-- Loading state -->
      <AppListItem v-if="isSearching" class="ion-text-center">
        <LoadingSpinner></LoadingSpinner>
      </AppListItem>

      <!-- Error state -->
      <AppListItem v-else-if="searchError" class="ion-text-center">
        <AppText color="danger">{{ searchError }}</AppText>
      </AppListItem>

      <!-- No results state -->
      <div
        v-else-if="!searchResults.length && searchTerm"
        class="flex flex-col items-center text-center py-8"
      >
        <AppButton fill="outline" @click="$emit('create-new', searchTerm)">
          Create Person '{{ searchTerm }}'
        </AppButton>
      </div>

      <!-- Results list -->
      <AppList v-else-if="searchResults.length > 0">
        <AppListItem
          v-for="va in searchResults"
          :key="va.id"
          button
          @click="
            () => {
              if (linkVoiceActor && mediaId) linkVoiceActor(va, mediaId);
              $emit('select', va);
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
      <div v-if="!isSearching && !searchError && searchResults.length > 0" class="ion-padding-top ion-text-center border-t border-slate-700/50 mt-4">
        <AppButton fill="clear" @click="$emit('create-new', searchTerm)" class="w-full text-blue-400">
          + Create New Person
        </AppButton>
      </div>
    </AppContent>
  </AppModal>
</template>


<script setup lang="ts">
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
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
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { useVoiceActorManagement, type VoiceActor } from "@/composables/useVoiceActorManagement";
const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select', actor: VoiceActor): void;
  (e: 'create-new', searchTerm?: string): void;
}>();

const props = defineProps<{
  isOpen: boolean;
  mediaId?: string;
  workType?: "movie" | "tv" | "season" | "episode";
  linkVoiceActor?: (va: VoiceActor, mediaId: string) => void;
}>();

const { searchTerm, searchResults, isSearching, searchError } = useVoiceActorManagement(props.workType || "movie");

const handleSearchInput = (event: any) => {
  const value = event.target.value;
  searchTerm.value = value;
};
</script>

<style scoped lang="scss">
// Add any specific styles if needed
</style>
