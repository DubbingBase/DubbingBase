<template>
  <AppModal :is-open="isOpen" @didDismiss="$emit('close')">
    <AppHeader>
      <AppToolbar>
        <AppTitle>Select Job Role</AppTitle>
        <template #end>
          <AppButton fill="clear" color="text" @click="$emit('close')">
            <XCircle class="app-icon" />
          </AppButton>
        </template>
      </AppToolbar>
      <AppToolbar>
        <AppSearchbar
          v-model="searchTerm"
          placeholder="Search job roles..."
          animated
        ></AppSearchbar>
      </AppToolbar>
    </AppHeader>
    <AppContent class="ion-padding">
      <!-- No results state -->
      <div v-if="!filteredJobs.length && searchTerm" class="flex flex-col items-center text-center py-8">
        <AppButton fill="outline" @click="$emit('create-new', searchTerm)">
          Create Job '{{ searchTerm }}'
        </AppButton>
      </div>

      <!-- Results list -->
      <AppList v-else>
        <AppListItem
          v-for="job in filteredJobs"
          :key="job.id"
          button
          @click="$emit('select', job)"
        >
          <AppLabel>{{ job.name }}</AppLabel>
        </AppListItem>
      </AppList>
    </AppContent>
  </AppModal>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
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
import XCircle from "~icons/lucide/x-circle";

const props = defineProps<{
  isOpen: boolean;
  jobs: Array<{ id: number; name: string }>;
}>();

const emit = defineEmits<{
  close: [];
  select: [job: { id: number; name: string }];
  "create-new": [query: string];
}>();

const searchTerm = ref("");

const filteredJobs = computed(() => {
  if (!searchTerm.value.trim()) {
    return props.jobs;
  }
  const query = searchTerm.value.toLowerCase().trim();
  return props.jobs.filter((job) =>
    job.name.toLowerCase().includes(query)
  );
});
</script>

<style scoped>
.app-icon {
  width: 24px;
  height: 24px;
}
</style>
