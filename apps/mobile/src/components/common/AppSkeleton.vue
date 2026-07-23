<template>
  <div class="app-skeleton" :class="{ animated }">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  animated?: boolean;
}>(), {
  animated: true
});
</script>

<style scoped>
.app-skeleton {
  background: var(--app-overlay-10);
  border-radius: 4px;
  min-height: 1em;
  width: 100%;
  display: inline-block;
}
.app-skeleton.animated {
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
@keyframes skeleton-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.4; }
  100% { opacity: 1; }
}
</style>
