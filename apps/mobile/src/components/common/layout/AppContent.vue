<template>
  <ion-content ref="contentRef" class="app-content" :class="{ 'fullscreen': fullscreen }" :scroll-events="true" @ionScroll="onScroll">
    <slot></slot>
  </ion-content>
</template>

<script setup lang="ts">
import { ref, onActivated, onDeactivated } from 'vue';
import { IonContent } from '@ionic/vue';

defineProps<{
  fullscreen?: boolean;
}>();

const contentRef = ref<any>(null);
let savedScrollTop = 0;

const onScroll = (e: any) => {
  if (e.detail && e.detail.scrollTop > 0) {
    savedScrollTop = e.detail.scrollTop;
  }
};

onDeactivated(() => {
  // Rely on the savedScrollTop continuously updated by onScroll
});

onActivated(() => {
  if (contentRef.value && savedScrollTop > 0) {
    // Delay slightly to ensure cap-router-outlet has unhidden the DOM
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (contentRef.value && typeof contentRef.value.$el?.scrollToPoint === 'function') {
          contentRef.value.$el.scrollToPoint(0, savedScrollTop, 0);
        }
      });
    }, 50);
  }
});
</script>

<style scoped>
.app-content {
  --background: var(--app-color-step-50, #121212);
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
