<template>
  <div class="app-segment-content" v-show="isActive">
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { inject, computed, Ref, onMounted } from 'vue';

const props = defineProps<{
  id: string;
}>();

const segmentValue = inject<Ref<string>>('segmentValue');
const updateSegment = inject<(value: string) => void>('updateSegment');

const isActive = computed(() => segmentValue?.value === props.id);

onMounted(() => {
  // If no segment is selected globally and we are the first one, we could self-select, 
  // but it's better if AppSegment handles default value initialization.
  // Actually, we can just do a simple check.
  if (!segmentValue?.value && updateSegment) {
    updateSegment(props.id);
  }
});
</script>

<style scoped>
.app-segment-content {
  flex: 1;
}
</style>
