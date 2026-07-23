<template>
  <AppModal :is-open="isOpen" @didDismiss="$emit('close')">
    <AppHeader>
      <AppToolbar>
        <AppTitle>Select TMDB Person</AppTitle>
        <template #end>
          <AppButton fill="clear" color="text" @click="$emit('close')">
            <XCircle class="app-icon" />
          </AppButton>
        </template>
      </AppToolbar>
      <AppToolbar>
        <AppSearchbar
          v-model="searchQuery"
          placeholder="Filter person by name or role..."
          animated
        ></AppSearchbar>
      </AppToolbar>
    </AppHeader>
    
    <AppContent class="ion-padding">
      <AppList v-if="filteredPersons.length > 0">
        <AppListItem
          v-for="p in filteredPersons"
          :key="p.id + p.character"
          button
          @click="selectPerson(p)"
        >
          <AppAvatar slot="start">
            <User class="w-6 h-6 text-indigo-400" />
          </AppAvatar>
          <AppText>
            <h3>{{ p.name }}</h3>
            <p v-if="p.character">{{ p.isCrew ? 'Job:' : 'as' }} {{ p.character }}</p>
          </AppText>
        </AppListItem>
      </AppList>

      <AppListItem v-else class="ion-text-center">
        <AppText color="medium">No persons found.</AppText>
      </AppListItem>
    </AppContent>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppModal from "@/components/common/AppModal.vue";
import AppList from "@/components/common/AppList.vue";
import AppListItem from "@/components/common/AppListItem.vue";
import AppAvatar from "@/components/common/AppAvatar.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppSearchbar from "@/components/common/AppSearchbar.vue";
import AppText from "@/components/common/AppText.vue";
import XCircle from "~icons/lucide/x-circle";
import User from "~icons/lucide/user";

export interface TmdbPerson {
  id: number;
  name: string;
  character: string;
  isCrew?: boolean;
}

const props = defineProps<{
  isOpen: boolean;
  persons: TmdbPerson[];
}>();

const emit = defineEmits(["close", "select"]);

const searchQuery = ref("");

const filteredPersons = computed(() => {
  if (!searchQuery.value.trim()) return props.persons;
  const q = searchQuery.value.trim().toLowerCase();
  return props.persons.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.character.toLowerCase().includes(q)
  );
});

const selectPerson = (person: TmdbPerson) => {
  emit("select", person);
  searchQuery.value = "";
};
</script>

<style scoped lang="scss">
// Styles handled by Ionic components
</style>
