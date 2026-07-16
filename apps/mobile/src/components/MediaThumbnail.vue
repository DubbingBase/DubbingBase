<template>
  <div class="avatar">
    <IonImg 
      class="avatar-image" 
      v-if="path" 
      :src="imgSrc" 
      @ionError="handleImageError"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, toRefs, ref, watch } from "vue";
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

const { height, width } = toRefs(props);
const hasError = ref(false);

watch(() => props.path, () => {
  hasError.value = false;
});

const defaultSrc = computed(() => {
  return `https://placehold.co/${width.value}x${height.value}?text=?`;
});

const imgSrc = computed(() => {
  return hasError.value ? defaultSrc.value : props.path;
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
.avatar-image::part(image) {
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
  background: var(--ion-color-step-100, #1e1e1e);
}
</style>
