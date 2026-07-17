<template>
  <div class="app-list" :class="{ 'app-list-inset': inset }">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  inset?: boolean;
}>();
</script>

<style scoped lang="scss">
.app-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  background: var(--app-color-step-50, #1e1e1e);
  
  &.app-list-inset {
    border-radius: 8px;
    overflow: hidden;
    margin: 16px;
    width: calc(100% - 32px);
  }
}
</style>
