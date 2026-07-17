<template>
  <div class="app-segment-view" @touchstart="onTouchStart" @touchend="onTouchEnd">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { provide, toRef, ref } from 'vue';

const props = defineProps<{
  activeSegment?: string;
}>();

const emit = defineEmits<{
  (e: 'update:activeSegment', value: string): void;
}>();

if (props.activeSegment !== undefined) {
  provide('segmentValue', toRef(props, 'activeSegment'));
}

const segments = ref<string[]>([]);
provide('registerSegment', (id: string) => {
  if (!segments.value.includes(id)) {
    segments.value.push(id);
  }
});
provide('unregisterSegment', (id: string) => {
  segments.value = segments.value.filter((s) => s !== id);
});

const touchStartX = ref(0);
const touchStartY = ref(0);
const minSwipeDistance = 50;

const onTouchStart = (e: TouchEvent) => {
  touchStartX.value = e.changedTouches[0].screenX;
  touchStartY.value = e.changedTouches[0].screenY;
};

const onTouchEnd = (e: TouchEvent) => {
  const touchEndX = e.changedTouches[0].screenX;
  const touchEndY = e.changedTouches[0].screenY;

  // Make sure it's a horizontal swipe and not a vertical scroll
  if (
    Math.abs(touchEndY - touchStartY.value) >
    Math.abs(touchEndX - touchStartX.value)
  ) {
    return;
  }

  const distance = touchEndX - touchStartX.value;
  if (Math.abs(distance) >= minSwipeDistance) {
    handleSwipe(distance < 0 ? 'left' : 'right');
  }
};

const handleSwipe = (direction: 'left' | 'right') => {
  if (!props.activeSegment || segments.value.length === 0) return;

  const currentIndex = segments.value.indexOf(props.activeSegment);
  if (currentIndex === -1) return;

  if (direction === 'left' && currentIndex < segments.value.length - 1) {
    emit('update:activeSegment', segments.value[currentIndex + 1]);
  } else if (direction === 'right' && currentIndex > 0) {
    emit('update:activeSegment', segments.value[currentIndex - 1]);
  }
};
</script>

<style scoped>
.app-segment-view {
  flex: 1;
  display: flex;
  flex-direction: column;
}
</style>
