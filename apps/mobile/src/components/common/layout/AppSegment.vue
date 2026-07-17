<template>
  <div class="app-segment">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { provide, computed, ref, watch } from 'vue';

const props = defineProps<{
  modelValue?: string;
  scrollable?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const internalValue = ref(props.modelValue || '');

watch(() => props.modelValue, (newVal) => {
  if (newVal !== undefined) {
    internalValue.value = newVal;
  }
});

const activeSegment = computed(() => props.modelValue !== undefined ? props.modelValue : internalValue.value);

provide('segmentValue', activeSegment);
provide('updateSegment', (value: string) => {
  internalValue.value = value;
  emit('update:modelValue', value);
});
</script>

<style scoped>
.app-segment {
  display: flex;
  background: var(--app-color-step-100, #1e1e1e);
  border-radius: 8px;
  padding: 4px;
  margin: 16px;
  overflow-x: auto;
  width: calc(100% - 32px); /* 100% minus horizontal margins */
  box-sizing: border-box;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none;  /* Internet Explorer 10+ */
}
.app-segment::-webkit-scrollbar { 
  display: none;  /* Safari and Chrome */
}
</style>
