<template>
  <router-link
    class="media-item"
    :to="{ name: routeName, params: routeParams }"
    :style="{
      flexBasis: widthStyle ,
      minWidth: widthStyle ,
      maxWidth: widthStyle ,
    }"
  >
    <div class="poster">
      <img
        v-if="!loading"
        :src="hasError ? fallbackImagePath : (imagePath ?? fallbackImagePath)"
        @error="onImageError"
        alt=""
        :style="{ width: widthStyle, height: heightStyle }"
      />
      <AppSkeleton :animated="true"
        v-else
        :style="{
          width: widthStyle,
          height: heightStyle,
          borderRadius: '12px',
          margin: 0,
        }"
      ></AppSkeleton>
    </div>
    <div class="caption" v-if="title">
      <template v-if="!loading">{{ title }}</template>
      <AppSkeleton :animated="true"
        v-else
        :style="{
          width: '100%',
          height: '42px',
          borderRadius: '4px',
          margin: 0,
        }"
      ></AppSkeleton>
    </div>
  </router-link>
</template>

<script lang="ts" setup>

import {
  MEDIA_ITEM_DEFAULT_WIDTH,
  MEDIA_ITEM_DEFAULT_HEIGHT,
} from "@/constants/thumbnails";
import { computed, ref, watch } from "vue";

interface Props {
  imagePath: string | undefined;
  title?: string;
  /** @deprecated */
  routeName: string;
  /** @deprecated */
  routeParams: Record<string, any>;
  loading?: boolean;
  fallbackImagePath?: string;
  height?: number;
  width?: number;
}

const props = defineProps<Props>();

const heightStyle = computed(() => {
  return `${props.height ?? MEDIA_ITEM_DEFAULT_HEIGHT}px`;
});
const widthStyle = computed(() => {
  return `${props.width ?? MEDIA_ITEM_DEFAULT_WIDTH}px`;
});

const hasError = ref(false);

watch(
  () => props.imagePath,
  () => {
    hasError.value = false;
  }
);

const onImageError = () => {
  hasError.value = true;
};
</script>
<style lang="scss" scoped>
.media-item {
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  vertical-align: top;
  height: auto;
  flex: 1 0 auto;
  color: inherit;
  text-decoration: none;
  border-radius: 12px;
  padding: 0;

  .poster {
    display: flex;
    justify-content: center;
    align-items: center;
    flex: 0;

    img {
      width: 100%;
      height: 100%;
      border-radius: 12px;
      max-width: 100%;
      max-height: 100%;
      object-fit: cover;
      
      border: none;
      outline: none;
      color: transparent;
      background: var(--ion-color-step-100, #1e1e1e);

      display: flex;
      flex-direction: column;
    }
  }

  .caption {
    font-size: 14px;
    flex: 1 0 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    margin: 8px 4px;
    word-break: break-word;
    text-align: left;
  }
}
</style>
