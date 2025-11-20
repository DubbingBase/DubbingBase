<template>
  <div class="work-list">
    <ion-list>
      <WorkItem
        v-for="workEntry in workEntries"
        :key="workEntry.id"
        :work-entry="workEntry"
        @edit="handleEditWork"
        @delete="handleDeleteWork"
      />
    </ion-list>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { IonList } from '@ionic/vue'
import { useProfileStore } from '@/stores/profile'
import WorkItem from './WorkItem.vue'
import type { WorkEntry } from '@/stores/profile'

const profileStore = useProfileStore()

const workEntries = computed(() => profileStore.workEntries)

const emit = defineEmits<{
  edit: [workEntry: WorkEntry]
  delete: [workEntryId: number]
}>()

const handleEditWork = (workEntry: WorkEntry) => {
  emit('edit', workEntry)
}

const handleDeleteWork = async (workEntryId: number) => {
  emit('delete', workEntryId)
}
</script>

<style scoped>
.work-list {
  margin-top: 1rem;
}
</style>
