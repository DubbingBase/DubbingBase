<template>
  <div class="avatar">
    <IonImg class="avatar-image" v-if="path" :src="path" />
  </div>
</template>

<script lang="ts" setup>
import { computed, toRefs } from "vue";
import { IonImg } from "@ionic/vue";
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
});

const { path, height, width, rawPath, fromStorage } = toRefs(props);

const defaultSrc = computed(() => {
  return `https://placehold.co/${width.value}x${height.value}?text=?`;
});

const heightStyle = computed(() => {
  return `${height.value}px`;
});
const widthStyle = computed(() => {
  return `${width.value}px`;
});
</script>

<style lang="scss" scoped>
.avatar-image::part(image) {
  display: block;
  overflow: hidden;
  object-fit: cover;
  border-radius: var(--thumbnail-border-radius);
  height: v-bind(heightStyle);
  width: v-bind(widthStyle);
  border: var(--thumbnail-border);
  box-shadow: var(--thumbnail-box-shadow-small);
}
</style>
