<template>
  <AppListItem>
    <AppImage class="app-thumbnail" slot="start">
      <img
        v-if="workEntry.media?.poster_path"
        :src="`https://image.tmdb.org/t/p/w92${workEntry.media.poster_path}`"
        :alt="getMediaTitle(workEntry.media)"
      />
      <div v-else class="placeholder">
        <Film class="app-icon"  />
      </div>
    </AppImage>

    <AppText>
      <h2>{{ getMediaTitle(workEntry.media) }}</h2>
      <p v-if="workEntry.character_name">{{ workEntry.character_name }} ({{ (workEntry as any).performance }})</p>
      <p class="media-type">
        <span>{{ workEntry.media_type === 'movie' ? 'Film' : 'Série' }}</span>
        <span v-if="workEntry.media?.release_date">
          • {{ new Date(workEntry.media.release_date).getFullYear() }}
        </span>
      </p>
    </AppText>

    <AppButton
      v-if="canEdit"
      slot="end"
      fill="clear"
      size="small"
      @click="handleEdit"
    >
      <Pencil class="app-icon" />
    </AppButton>

    <AppButton
      v-if="canEdit"
      slot="end"
      fill="clear"
      size="small"
      @click="confirmDelete"
    >
      <Trash2 class="app-icon" />
    </AppButton>
  </AppListItem>
</template>

<script setup lang="ts">
import { alertController } from '@/composables/useAlert';
import AppListItem from '@/components/common/AppListItem.vue';
import AppButton from '@/components/common/AppButton.vue';
import AppImage from '@/components/common/AppImage.vue';
import AppText from '@/components/common/AppText.vue';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';

import type { WorkEntry } from '@/stores/profile'
import { onMounted } from 'vue';


interface Props {
  workEntry: WorkEntry
  canEdit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canEdit: true
})

onMounted(() => {
    console.log('props.workEntry', props.workEntry)
})

const emit = defineEmits<{
  edit: [workEntry: WorkEntry]
  delete: [workEntryId: number]
}>()

const getMediaTitle = (media: any) => {
  return media?.title || media?.name || 'Titre inconnu'
}

const handleEdit = () => {
  emit('edit', props.workEntry)
}

const confirmDelete = async () => {
  const alert = await alertController.create({
    header: 'Confirmer la suppression',
    message: 'Êtes-vous sûr de vouloir supprimer ce projet de votre liste ?',
    buttons: [
      {
        text: 'Annuler',
        role: 'cancel'
      },
      {
        text: 'Supprimer',
        role: 'destructive',
        handler: () => {
          emit('delete', props.workEntry.id)
        }
      }
    ]
  })

  await alert.present()
}
</script>

<style scoped>
.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--ion-color-light);
  border-radius: 4px;
}

.placeholder .app-icon {
  font-size: 2rem;
  color: var(--ion-color-medium);
}

.media-type {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin: 0.25rem 0 0 0;
}
</style>
