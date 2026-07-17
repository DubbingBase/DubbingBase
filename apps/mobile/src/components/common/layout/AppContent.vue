<template>
  <cap-content ref="contentRef" class="app-content" :class="{ 'fullscreen': fullscreen }" @scroll.passive="onScroll">
    <slot></slot>
  </cap-content>
</template>

<script setup lang="ts">
import { ref, onActivated, onDeactivated } from 'vue';

defineProps<{
  fullscreen?: boolean;
}>();

const contentRef = ref<HTMLElement | null>(null);
let savedScrollTop = 0;

const onScroll = (e: Event) => {
  const target = e.target as HTMLElement;
  if (target.scrollTop > 0) {
    savedScrollTop = target.scrollTop;
  }
};

onDeactivated(() => {
  if (contentRef.value && contentRef.value.scrollTop > 0) {
    savedScrollTop = contentRef.value.scrollTop;
  }
});

onActivated(() => {
  if (contentRef.value && savedScrollTop > 0) {
    // Delay slightly to ensure cap-router-outlet has unhidden the DOM
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (contentRef.value) {
          const el = contentRef.value as any;
          if (typeof el.restoreScrollPosition === 'function') {
            el.restoreScrollPosition({ x: 0, y: savedScrollTop });
          } else {
            contentRef.value!.scrollTop = savedScrollTop;
          }
        }
      });
    }, 50);
  }
});
</script>

<style scoped>
.app-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  background: var(--app-color-step-50, #121212);
}

.app-content.fullscreen {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}
</style>
