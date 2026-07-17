<template>
  <main class="app-content" :class="{ 'fullscreen': fullscreen }">
    <slot></slot>
  </main>
</template>

<script setup lang="ts">
defineProps<{
  fullscreen?: boolean;
}>();
</script>

<style scoped>
.app-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  background: var(--app-color-step-50, #121212);
}

.app-content.fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}
</style>
