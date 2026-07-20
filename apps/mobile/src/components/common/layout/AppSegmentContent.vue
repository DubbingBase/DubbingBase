<template>
  <ion-segment-content :id="id">
    <slot></slot>
  </ion-segment-content>
</template>

<script setup lang="ts">
import { IonSegmentContent } from '@ionic/vue';

defineProps<{
  id: string;
}>();
</script>


