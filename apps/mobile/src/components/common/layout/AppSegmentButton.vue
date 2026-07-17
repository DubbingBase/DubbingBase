<template>
  <button 
    class="app-segment-button" 
    :class="{ active: isActive }"
    @click="select"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
import { inject, computed, Ref, onMounted } from 'vue';

const props = defineProps<{
  value: string;
}>();

const segmentValue = inject<Ref<string>>('segmentValue');
const updateSegment = inject<(value: string) => void>('updateSegment');

const isActive = computed(() => segmentValue?.value === props.value);

onMounted(() => {
  if (!segmentValue?.value && updateSegment) {
    updateSegment(props.value);
  }
});

const select = () => {
  if (updateSegment) {
    updateSegment(props.value);
  }
};
</script>

<style scoped>
.app-segment-button {
  flex: 1;
  background: transparent;
  border: none;
  border-radius: 6px;
  padding: 8px 16px;
  color: var(--app-color-step-500, #888);
  font-weight: 500;
  font-size: 14px;
  transition: all 0.2s ease;
  white-space: nowrap;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px; /* For icons and text */
}

.app-segment-button.active {
  background: var(--app-color-step-300, #3a3a3a);
  color: var(--app-color-text-primary, #fff);
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
</style>
