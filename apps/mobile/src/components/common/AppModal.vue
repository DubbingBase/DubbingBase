<template>
  <ion-modal
    :is-open="isOpen"
    @didPresent="onOpened"
    @didDismiss="onClosed"
    :initial-breakpoint="isFullScreen ? undefined : (initialBreakpoint ?? 1)"
    :breakpoints="isFullScreen ? undefined : (breakpoints ?? [0, 1])"
    :backdrop-dismiss="overlay"
    class="app-bottom-sheet"
  >
    <div class="app-modal-content" :style="{ maxHeight: isFullScreen ? '100%' : (maxHeight || 'auto') }">
      <slot></slot>
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal } from '@ionic/vue';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  isFullScreen?: boolean;
  maxHeight?: string;
  canSwipe?: boolean;
  overlay?: boolean;
  breakpoints?: number[];
  initialBreakpoint?: number;
}>(), {
  isOpen: false,
  isFullScreen: false,
  canSwipe: true,
  overlay: true
});

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'didPresent'): void;
  (e: 'didDismiss'): void;
}>();

const onOpened = () => {
  emit('update:isOpen', true);
  emit('didPresent');
};

const onClosed = () => {
  emit('update:isOpen', false);
  emit('didDismiss');
};
</script>

<style scoped lang="scss">
.app-modal-content {
  width: 100%;
  height: 100%;
  background: var(--app-color-step-50, #1e1e1e);
  color: var(--app-color-text-primary, #fff);
  display: flex;
  flex-direction: column;
}
</style>
