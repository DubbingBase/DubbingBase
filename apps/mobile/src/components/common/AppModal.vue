<template>
  <BottomSheet 
    ref="bottomSheetRef" 
    :is-full-screen="isFullScreen"
    :max-height="maxHeight"
    :can-swipe="canSwipe"
    :overlay="overlay"
    @opened="onOpened"
    @closed="onClosed"
  >
    <div class="app-modal-content">
      <slot></slot>
    </div>
  </BottomSheet>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue';
import { BottomSheet } from '@balalarast/vue-bottom-sheet';
import '@balalarast/vue-bottom-sheet/dist/style.css';

const props = withDefaults(defineProps<{
  isOpen: boolean;
  isFullScreen?: boolean;
  maxHeight?: string;
  canSwipe?: boolean;
  overlay?: boolean;
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

const bottomSheetRef = ref<InstanceType<typeof BottomSheet> | null>(null);

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    bottomSheetRef.value?.open();
  } else {
    bottomSheetRef.value?.close();
  }
});

const onOpened = () => {
  emit('update:isOpen', true);
  emit('didPresent');
};

const onClosed = () => {
  emit('update:isOpen', false);
  emit('didDismiss');
};

onMounted(() => {
  if (props.isOpen) {
    nextTick(() => {
      bottomSheetRef.value?.open();
    });
  }
});
</script>

<style scoped lang="scss">
.app-modal-content {
  width: 100%;
  height: 100%;
  background: var(--ion-color-step-50, #1e1e1e);
  color: var(--ion-color-text-primary, #fff);
  display: flex;
  flex-direction: column;
}

:deep(.bottom-sheet__card) {
  background: var(--ion-color-step-50, #1e1e1e) !important;
  border-top-left-radius: 16px !important;
  border-top-right-radius: 16px !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.bottom-sheet__pan) {
  padding-top: 12px;
  padding-bottom: 12px;
}

:deep(.bottom-sheet__bar) {
  background: var(--ion-color-step-300, #4a4a4a) !important;
  width: 40px !important;
  height: 4px !important;
}

:deep(.bottom-sheet__content) {
  flex: 1;
  overflow-y: auto;
}
</style>
