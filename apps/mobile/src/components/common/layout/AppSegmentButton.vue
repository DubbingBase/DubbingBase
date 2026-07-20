<template>
  <ion-segment-button 
    :value="value"
    :content-id="contentId"
    class="app-segment-button" 
  >
    <ion-label class="segment-label">
      <slot></slot>
    </ion-label>
  </ion-segment-button>
</template>

<script setup lang="ts">
import { IonSegmentButton, IonLabel } from '@ionic/vue';
import { inject, Ref, onMounted } from 'vue';

const props = defineProps<{
  value: string;
  contentId?: string;
}>();

const segmentValue = inject<Ref<string>>('segmentValue');
const updateSegment = inject<(value: string) => void>('updateSegment');

onMounted(() => {
  if (!segmentValue?.value && updateSegment) {
    updateSegment(props.value);
  }
});
</script>

<style scoped>
.app-segment-button {
  --color: var(--app-color-step-500, #888);
  --color-checked: var(--app-color-text-primary, #fff);
  --indicator-color: var(--app-color-step-300, #3a3a3a);
  --border-radius: 6px;
  font-weight: 500;
  font-size: 14px;
  min-height: 36px;
  /* Reset some default Ionic padding if necessary */
  margin: 0;
}

ion-segment-button::part(indicator) {
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

ion-segment-button::part(native) {
  padding: 8px 16px;
  gap: 8px; /* For icons and text */
}
</style>
