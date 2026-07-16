<template>
  <button @click="router.back()" class="app-back-button">
    <ChevronLeft class="app-back-icon" />
  </button>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import ChevronLeft from '~icons/lucide/chevron-left';

const router = useRouter();
</script>

<style scoped>
.app-back-button {
  background: transparent;
  color: white;
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
  background-color: rgba(255, 255, 255, 0.1);
}

.app-back-icon {
  width: 24px;
  height: 24px;
}
</style>
