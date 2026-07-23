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
  --color: var(--app-color-text-muted, #94a3b8);
  --color-checked: var(--app-color-text-primary, #ffffff);
  --indicator-color: var(--app-color-primary, #3b82f6);
  --border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
  min-height: 36px;
  margin: 0;
  transition: all 0.2s ease;
}

ion-segment-button::part(indicator) {
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

ion-segment-button::part(indicator-background) {
  background: linear-gradient(135deg, var(--app-color-primary, #3b82f6) 0%, color-mix(in srgb, var(--app-color-primary) 80%, black) 100%);
}

ion-segment-button::part(native) {
  padding: 8px 16px;
  gap: 8px;
}
</style>
