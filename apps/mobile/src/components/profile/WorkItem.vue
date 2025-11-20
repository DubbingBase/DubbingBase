<template>
  <ion-item>
    <ion-thumbnail slot="start">
      <img
        v-if="workEntry.media?.poster_path"
        :src="`https://image.tmdb.org/t/p/w92${workEntry.media.poster_path}`"
        :alt="getMediaTitle(workEntry.media)"
      />
      <div v-else class="placeholder">
        <ion-icon name="film"></ion-icon>
      </div>
    </ion-thumbnail>

    <ion-label>
      <h2>{{ getMediaTitle(workEntry.media) }}</h2>
      <p v-if="workEntry.character_name">{{ workEntry.character_name }} ({{ workEntry.performance }})</p>
      <p class="media-type">
        <span>{{ workEntry.media_type === 'movie' ? 'Film' : 'Série' }}</span>
        <span v-if="workEntry.media?.release_date">
          • {{ new Date(workEntry.media.release_date).getFullYear() }}
        </span>
      </p>
    </ion-label>

    <ion-button
      slot="end"
      fill="clear"
      size="small"
      @click="handleEdit"
    >
      <ion-icon :name="create" color="primary"></ion-icon>
    </ion-button>

    <ion-button
      slot="end"
      fill="clear"
      size="small"
      @click="confirmDelete"
    >
      <ion-icon :name="trash" color="danger"></ion-icon>
    </ion-button>
  </ion-item>
</template>

<script setup lang="ts">
import {
  IonItem,
  IonThumbnail,
  IonLabel,
  IonButton,
  IonIcon,
  alertController
} from '@ionic/vue'
import type { WorkEntry } from '@/stores/profile'
import { onMounted } from 'vue';
import { trash, create } from 'ionicons/icons';

interface Props {
  workEntry: WorkEntry
}

const props = defineProps<Props>()

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

.placeholder ion-icon {
  font-size: 2rem;
  color: var(--ion-color-medium);
}

.media-type {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
  margin: 0.25rem 0 0 0;
}
</style>
