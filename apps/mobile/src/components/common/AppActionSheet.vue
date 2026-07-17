<template>
  <AppModal
    v-model:is-open="isOpen"
    :can-swipe="true"
    :overlay="true"
  >
    <div class="action-sheet-container">
      <div v-if="header" class="action-sheet-header">
        <AppText class="header-text">{{ header }}</AppText>
      </div>
      
      <div class="action-sheet-buttons">
        <button
          v-for="(btn, index) in buttons"
          :key="index"
          class="action-sheet-button"
          :class="[btn.role ? `role-${btn.role}` : '']"
          @click="handleButton(btn)"
        >
          <div v-if="btn.icon" class="button-icon-wrapper">
            <component :is="btn.icon" class="button-icon" />
          </div>
          <AppText class="button-text">{{ btn.text }}</AppText>
        </button>
      </div>
    </div>
  </AppModal>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import AppModal from './AppModal.vue';
import AppText from './AppText.vue';

export interface ActionSheetButton {
  text: string;
  icon?: any;
  role?: 'destructive' | 'cancel' | string;
  handler?: () => void;
}

const props = defineProps<{
  isOpen: boolean;
  header?: string;
  buttons: ActionSheetButton[];
}>();

const emit = defineEmits<{
  (e: 'update:isOpen', value: boolean): void;
  (e: 'didDismiss'): void;
}>();

const isOpen = computed({
  get: () => props.isOpen,
  set: (val) => {
    emit('update:isOpen', val);
    if (!val) emit('didDismiss');
  }
});

const handleButton = (btn: ActionSheetButton) => {
  if (btn.handler) {
    btn.handler();
  }
  isOpen.value = false;
};
</script>

<style scoped>
.action-sheet-container {
  padding: 16px;
  padding-bottom: env(safe-area-inset-bottom, 24px);
  padding-top: 0;
  display: flex;
  flex-direction: column;
}

.action-sheet-header {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid var(--app-color-step-100, #2d2d2d);
  margin-bottom: 8px;
}

.header-text {
  font-weight: 600;
  color: var(--app-color-medium, #92949c);
  font-size: 14px;
}

.action-sheet-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-sheet-button {
  display: flex;
  align-items: center;
  width: 100%;
  background: var(--app-color-step-100, #2d2d2d);
  border: none;
  border-radius: 12px;
  padding: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.action-sheet-button:active {
  background: var(--app-color-step-200, #3d3d3d);
}

.button-icon-wrapper {
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.button-icon {
  width: 24px;
  height: 24px;
  color: var(--app-color-text-primary, #ffffff);
}

.button-text {
  font-size: 16px;
  color: var(--app-color-text-primary, #ffffff);
  font-weight: 500;
  text-align: left;
  flex: 1;
}

.role-destructive .button-text,
.role-destructive .button-icon {
  color: var(--app-color-danger, #ef4444);
}

.role-cancel {
  background: var(--app-color-step-200, #3d3d3d);
  justify-content: center;
  margin-top: 8px;
}

.role-cancel .button-icon-wrapper {
  display: none;
}

.role-cancel .button-text {
  text-align: center;
  font-weight: 600;
}
</style>
