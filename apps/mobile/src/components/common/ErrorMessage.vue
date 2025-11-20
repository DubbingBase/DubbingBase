<template>
  <div class="error-container" :class="{ 'inline': inline }">
    <ion-icon
      :name="icon"
      :color="color"
      :size="size"
    ></ion-icon>
    <div class="error-content">
      <h4 v-if="title" class="error-title">{{ title }}</h4>
      <p class="error-text">{{ message }}</p>
      <ion-button
        v-if="retry"
        fill="outline"
        size="small"
        @click="$emit('retry')"
      >
        <ion-icon slot="start" name="refresh"></ion-icon>
        Réessayer
      </ion-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IonIcon, IonButton } from '@ionic/vue'

interface Props {
  message: string
  title?: string
  icon?: string
  color?: string
  size?: string
  inline?: boolean
  retry?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  icon: 'alert-circle',
  color: 'danger',
  size: 'large',
  inline: false,
  retry: false
})

defineEmits<{
  retry: []
}>()
</script>

<style scoped>
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1rem;
  gap: 0.5rem;
}

.error-container.inline {
  flex-direction: row;
  text-align: left;
  gap: 1rem;
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.error-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ion-color-danger);
}

.error-text {
  margin: 0;
  color: var(--ion-text-color);
  opacity: 0.8;
}
</style>
