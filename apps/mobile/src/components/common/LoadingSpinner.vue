<template>
  <div v-if="props.overlay" class="loading-overlay">
    <div class="loading-container" :class="{ 'inline': props.inline }">
      <ion-spinner
        :name="props.name"
        :color="props.color"
        :size="props.size"
      ></ion-spinner>
      <span v-if="props.text" class="loading-text">{{ props.text }}</span>
    </div>
  </div>
  <div v-else class="loading-container" :class="{ 'inline': props.inline }">
    <ion-spinner
      :name="props.name"
      :color="props.color"
      :size="props.size"
    ></ion-spinner>
    <span v-if="props.text" class="loading-text">{{ props.text }}</span>
  </div>
</template>

<script setup lang="ts">
import { IonSpinner } from '@ionic/vue'

interface Props {
  name?: 'crescent' | 'bubbles' | 'circles' | 'circular' | 'dots' | 'lines' | 'lines-small' | 'lines-sharp' | 'lines-sharp-small'
  color?: string
  size?: string
  text?: string
  inline?: boolean
  overlay?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  name: 'crescent',
  color: 'primary',
  size: undefined,
  text: '',
  inline: false,
  overlay: false
})
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 50vh;
}

.loading-container.inline {
  flex-direction: row;
  gap: 0.5rem;
}

.loading-text {
  font-size: 0.875rem;
  color: var(--ion-color-medium);
}
</style>
