<template>
  <component :is="tag" class="app-text" :class="colorClass" :style="customColorStyle">
    <slot></slot>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  color?: string;
  tag?: string;
}>(), {
  tag: 'span'
});

const isIonicColor = computed(() => {
  return ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'light', 'medium', 'dark'].includes(props.color || '');
});

const colorClass = computed(() => {
  return isIonicColor.value ? `ion-color-${props.color}` : '';
});

const customColorStyle = computed(() => {
  return props.color && !isIonicColor.value ? { color: props.color } : {};
});
</script>

<style scoped>
.app-text {
  margin: 0;
}
</style>
