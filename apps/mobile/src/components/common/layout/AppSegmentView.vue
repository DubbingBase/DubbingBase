<template>
  <ion-segment-view class="app-segment-view">
    <slot></slot>
  </ion-segment-view>
</template>

<script setup lang="ts">
import { IonSegmentView } from '@ionic/vue';

defineProps<{
  activeSegment?: string;
}>();

defineEmits<{
  (e: 'update:activeSegment', value: string): void;
}>();
</script>

<style scoped>
.app-segment-view {
  align-items: flex-start;
}
</style>
