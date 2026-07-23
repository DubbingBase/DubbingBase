<template>
  <AppModal :is-open="isOpen" @didDismiss="$emit('close')">
    <AppHeader>
      <AppToolbar>
        <AppTitle>Select Dubbing Studio</AppTitle>
        <template #end>
          <AppButton fill="clear" color="text" @click="$emit('close')">
            <XCircle class="app-icon" />
          </AppButton>
        </template>
      </AppToolbar>
      <AppToolbar>
        <AppSearchbar
          v-model="searchTerm"
          placeholder="Search studio by name..."
          animated
          :debounce="300"
          @ionInput="searchStudios"
        ></AppSearchbar>
      </AppToolbar>
    </AppHeader>
    <AppContent class="ion-padding">
      <!-- Loading state -->
      <AppListItem v-if="isSearching" class="ion-text-center">
        <LoadingSpinner></LoadingSpinner>
      </AppListItem>

      <!-- No results state -->
      <div v-else-if="!searchResults.length && searchTerm" class="flex flex-col items-center text-center py-8">
        <AppButton fill="outline" @click="$emit('create-new', searchTerm)">
          Create Studio '{{ searchTerm }}'
        </AppButton>
      </div>

      <!-- Results list -->
      <AppList v-else>
        <AppListItem
          v-for="studio in searchResults"
          :key="studio.id"
          button
          @click="$emit('select', studio)"
        >
          <AppLabel>{{ studio.name }}</AppLabel>
        </AppListItem>
      </AppList>
    </AppContent>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { supabase } from "@/api/supabase";
import AppModal from "@/components/common/AppModal.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppButton from "@/components/common/AppButton.vue";
import AppSearchbar from "@/components/common/AppSearchbar.vue";
import AppList from "@/components/common/AppList.vue";
import AppListItem from "@/components/common/AppListItem.vue";
import AppLabel from "@/components/common/AppLabel.vue";
import AppText from "@/components/common/AppText.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import XCircle from "~icons/lucide/x-circle";

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  select: [studio: any];
  "create-new": [query: string];
}>();

const searchTerm = ref("");
const searchResults = ref<any[]>([]);
const isSearching = ref(false);

const searchStudios = async () => {
  isSearching.value = true;
  try {
    let query = supabase
      .from("studios")
      .select("*")
      .order("name", { ascending: true });
    
    if (searchTerm.value.trim()) {
      query = query.ilike("name", `%${searchTerm.value.trim()}%`);
    }
    
    const { data } = await query.limit(25);
    searchResults.value = data || [];
  } catch (err) {
    console.error("Error searching studios:", err);
  } finally {
    isSearching.value = false;
  }
};

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      if (searchResults.value.length === 0) {
        searchStudios();
      }
    } else {
      searchTerm.value = "";
    }
  }
);
</script>

<style scoped>
.app-icon {
  width: 24px;
  height: 24px;
}
</style>
