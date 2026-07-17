<template>
  <div class="app-label" :class="{ 'text-wrap': wrap }">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  wrap?: boolean;
}>();
</script>

<style scoped lang="scss">
.app-label {
  display: block;
  font-size: 16px;
  color: var(--app-color-text-primary, #ffffff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  
  &.text-wrap {
    white-space: normal;
    overflow: visible;
    text-overflow: clip;
  }
}
</style>
