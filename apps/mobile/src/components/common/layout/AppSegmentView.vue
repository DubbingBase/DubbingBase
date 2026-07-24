<template>
  <ion-segment-view class="app-segment-view" ref="viewRef">
    <slot></slot>
  </ion-segment-view>
</template>

<script setup lang="ts">
import { IonSegmentView } from '@ionic/vue';
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps<{
  activeSegment?: string;
}>();

defineEmits<{
  (e: 'update:activeSegment', value: string): void;
}>();

const viewRef = ref<InstanceType<typeof IonSegmentView> | null>(null);
let resizeObserver: ResizeObserver | null = null;
let currentChild: HTMLElement | null = null;

const updateHeight = () => {
  if (!viewRef.value?.$el || !props.activeSegment) return;
  const el = viewRef.value.$el as HTMLElement;
  const activeChild = el.querySelector(`#${props.activeSegment}`) as HTMLElement;
  if (!activeChild) return;

  if (currentChild !== activeChild) {
    if (resizeObserver && currentChild) {
      resizeObserver.unobserve(currentChild);
    }
    currentChild = activeChild;
    if (resizeObserver) {
      resizeObserver.observe(currentChild);
    }
  }

  el.style.height = `${activeChild.offsetHeight}px`;
};

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    updateHeight();
  });
  nextTick(() => {
    updateHeight();
  });
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
});

watch(() => props.activeSegment, () => {
  nextTick(() => {
    updateHeight();
  });
});
</script>

<style scoped>
.app-segment-view {
  align-items: flex-start;
  transition: height 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}
</style>
