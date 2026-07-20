<template>
  <ion-segment-view>
    <slot></slot>
  </ion-segment-view>
</template>

<script setup lang="ts">
import { IonSegmentView } from '@ionic/vue';

// Keep the props and emits to avoid Vue warnings from existing usages
defineProps<{
  activeSegment?: string;
}>();

defineEmits<{
  (e: 'update:activeSegment', value: string): void;
}>();
</script>


