<template>
  <div class="app-spinner" :class="[`spinner-${name}`, colorClass]">
    <svg viewBox="0 0 50 50" class="spinner-svg">
      <circle class="path" cx="25" cy="25" r="20" fill="none" stroke-width="5"></circle>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  name?: string;
  color?: string;
}>(), {
  name: 'crescent'
});

const isThemeColor = computed(() => {
  return ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'light', 'medium', 'dark'].includes(props.color || '');
});

const colorClass = computed(() => {
  return isThemeColor.value ? `app-color-${props.color}` : '';
});
</script>

<style scoped>
.app-spinner {
  display: inline-block;
  width: 28px;
  height: 28px;
  color: currentColor;
}

.app-color-primary { color: var(--app-color-primary, #3b82f6); }
.app-color-secondary { color: var(--app-color-secondary, #10b981); }
.app-color-tertiary { color: var(--app-color-tertiary, #8b5cf6); }
.app-color-success { color: var(--app-color-success, #22c55e); }
.app-color-warning { color: var(--app-color-warning, #f59e0b); }
.app-color-danger { color: var(--app-color-danger, #ef4444); }
.app-color-light { color: var(--app-color-light, #f3f4f6); }
.app-color-medium { color: var(--app-color-medium, #9ca3af); }
.app-color-dark { color: var(--app-color-dark, #1f2937); }
.spinner-svg {
  animation: rotate 2s linear infinite;
  width: 100%;
  height: 100%;
}
.spinner-svg .path {
  stroke: currentColor;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}
@keyframes rotate {
  100% { transform: rotate(360deg); }
}
@keyframes dash {
  0% { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}
</style>
