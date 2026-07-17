<template>
  <span class="app-badge" :class="colorClass">
    <slot></slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'medium' | 'light' | 'dark' | string;
}>();

const colorClass = computed(() => {
  return props.color ? `app-badge-${props.color}` : 'app-badge-primary';
});
</script>

<style scoped>
.app-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
  vertical-align: baseline;
}

.app-badge-primary { background: var(--app-color-primary, #3880ff); color: white; }
.app-badge-secondary { background: var(--app-color-secondary, #3dc2ff); color: white; }
.app-badge-success { background: var(--app-color-success, #2dd36f); color: white; }
.app-badge-warning { background: var(--app-color-warning, #ffc409); color: black; }
.app-badge-danger { background: var(--app-color-danger, #eb445a); color: white; }
.app-badge-medium { background: var(--app-color-medium, #92949c); color: white; }
.app-badge-light { background: var(--app-color-light, #f4f5f8); color: black; }
.app-badge-dark { background: var(--app-color-dark, #222428); color: white; }
</style>
