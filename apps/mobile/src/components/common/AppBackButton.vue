<template>
  <button @click="handleBack" class="app-back-button">
    <ChevronLeft class="app-back-icon" />
  </button>
</template>

<script setup lang="ts">
import { useIonRouter } from '@ionic/vue';
import ChevronLeft from '~icons/lucide/chevron-left';

const ionRouter = useIonRouter();

const handleBack = () => {
  if (ionRouter.canGoBack()) {
    ionRouter.back();
  } else {
    ionRouter.navigate('/home', 'back', 'replace');
  }
};
</script>

<style scoped>
.app-back-button {
  background: transparent;
  color: var(--app-color-text-primary);
  border: none;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s ease;
}

.app-back-button:active {
  background-color: var(--app-overlay-10);
}

.app-back-icon {
  width: 24px;
  height: 24px;
}
</style>
