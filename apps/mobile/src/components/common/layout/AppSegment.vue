<template>
  <ion-segment
    ref="segmentEl"
    :scrollable="scrollable"
    @ionChange="onChange"
    class="app-segment"
    :style="bgColor ? { '--background': bgColor, background: bgColor } : {}"
  >
    <slot></slot>
  </ion-segment>
</template>

<script setup lang="ts">
import { IonSegment } from '@ionic/vue';
import { provide, computed, ref, watch, onMounted } from 'vue';

const props = defineProps<{
  modelValue?: string;
  scrollable?: boolean;
  bgColor?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const segmentEl = ref<any>(null);

watch(() => props.modelValue, (newVal) => {
  if (segmentEl.value?.$el && newVal !== undefined) {
    segmentEl.value.$el.value = newVal;
  }
});

onMounted(() => {
  if (props.modelValue !== undefined && segmentEl.value?.$el) {
    segmentEl.value.$el.value = props.modelValue;
  }
});

const onChange = (e: any) => {
  emit('update:modelValue', e.detail.value);
};

// Provide updateSegment just in case any custom logic needs it
provide('segmentValue', computed(() => props.modelValue || ''));
provide('updateSegment', (value: string) => {
  emit('update:modelValue', value);
});
</script>

<style scoped>
.app-segment {
  background: var(--app-color-step-100, #1e1e1e);
  border-radius: 8px;
  padding: 4px;
  margin: 0 16px;
  width: calc(100% - 32px); /* 100% minus horizontal margins */
  box-sizing: border-box;
  --background: var(--app-color-step-100, #1e1e1e);
}
</style>
