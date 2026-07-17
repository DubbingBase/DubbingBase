<template>
  <div class="app-chip" :class="[outline ? 'app-chip-outline' : '', color ? `app-chip-${color}` : 'app-chip-default']">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  outline?: boolean;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'medium' | 'light' | 'dark' | string;
}>();
</script>

<style scoped>
.app-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  height: 32px;
  border-radius: 16px;
  font-size: 14px;
  background: var(--app-color-step-150, #2a2a2a);
  color: var(--app-color-text-primary, #fff);
  white-space: nowrap;
}

.app-chip-outline {
  background: transparent;
  border: 1px solid var(--app-color-step-300, #444);
}

.app-chip-primary { background: var(--app-color-primary, #3880ff); color: white; }
.app-chip-secondary { background: var(--app-color-secondary, #3dc2ff); color: white; }
.app-chip-success { background: var(--app-color-success, #2dd36f); color: white; }
.app-chip-warning { background: var(--app-color-warning, #ffc409); color: black; }
.app-chip-danger { background: var(--app-color-danger, #eb445a); color: white; }

.app-chip-outline.app-chip-primary { background: transparent; border-color: var(--app-color-primary, #3880ff); color: var(--app-color-primary, #3880ff); }
.app-chip-outline.app-chip-secondary { background: transparent; border-color: var(--app-color-secondary, #3dc2ff); color: var(--app-color-secondary, #3dc2ff); }
.app-chip-outline.app-chip-success { background: transparent; border-color: var(--app-color-success, #2dd36f); color: var(--app-color-success, #2dd36f); }
.app-chip-outline.app-chip-warning { background: transparent; border-color: var(--app-color-warning, #ffc409); color: var(--app-color-warning, #ffc409); }
.app-chip-outline.app-chip-danger { background: transparent; border-color: var(--app-color-danger, #eb445a); color: var(--app-color-danger, #eb445a); }
</style>
