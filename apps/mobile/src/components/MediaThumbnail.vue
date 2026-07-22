<template>
  <div class="avatar" :style="{ width: widthStyle, height: heightStyle }">
    <img 
      class="avatar-image" 
      :src="imgSrc" 
      @error="handleImageError"
      :style="{ width: widthStyle, height: heightStyle }"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, toRefs, ref, watch } from "vue";

import { THUMBNAIL_DEFAULT_WIDTH, THUMBNAIL_DEFAULT_HEIGHT } from '@/constants/thumbnails';

const props = defineProps({
  path: {
    type: String,
    required: false,
    default: undefined,
  },
  height: {
    type: Number,
    required: false,
    default: THUMBNAIL_DEFAULT_HEIGHT,
  },
  width: {
    type: Number,
    required: false,
    default: THUMBNAIL_DEFAULT_WIDTH,
  },
  radius: {
    type: String,
    required: false,
    default: '0',
  },
  fallbackPath: {
    type: String,
    required: false,
    default: undefined,
  },
});

const { height, width } = toRefs(props);
const hasError = ref(false);

watch(() => props.path, () => {
  hasError.value = false;
});

const defaultSrc = computed(() => {
  return props.fallbackPath || `https://placehold.co/${width.value}x${height.value}?text=?`;
});

const imgSrc = computed(() => {
  return (hasError.value || !props.path) ? defaultSrc.value : props.path;
});

const handleImageError = () => {
  hasError.value = true;
};

const heightStyle = computed(() => {
  return `${height.value}px`;
});
const widthStyle = computed(() => {
  return `${width.value}px`;
});
</script>

<style lang="scss" scoped>
.avatar-image {
  display: block;
  overflow: hidden;
  object-fit: cover;
  border-radius: var(--thumbnail-border-radius);
  height: v-bind(heightStyle);
  width: v-bind(widthStyle);
  border: var(--thumbnail-border);
  box-shadow: var(--thumbnail-box-shadow-small);
  color: transparent;
  outline: none;
  background: var(--app-color-step-100, #1e1e1e);
}
</style>
