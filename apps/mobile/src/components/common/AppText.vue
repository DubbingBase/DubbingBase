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

const isThemeColor = computed(() => {
  return ['primary', 'secondary', 'tertiary', 'success', 'warning', 'danger', 'light', 'medium', 'dark'].includes(props.color || '');
});

const colorClass = computed(() => {
  return isThemeColor.value ? `app-color-${props.color}` : '';
});

const customColorStyle = computed(() => {
  return props.color && !isThemeColor.value ? { color: props.color } : {};
});
</script>

<style scoped>
.app-text {
  margin: 0;
}
</style>
