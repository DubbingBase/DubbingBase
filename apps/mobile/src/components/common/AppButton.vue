<template>
  <button
    class="app-button"
    :class="[
      `fill-${fill}`,
      `color-${color}`,
      { 'expand-block': expand === 'block' },
      { 'is-disabled': disabled },
      { 'shape-circle': shape === 'circle' || shape === 'round' }
    ]"
    :disabled="disabled"
    :type="type"
    @click="$emit('click', $event)"
  >
    <slot></slot>
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  fill?: 'solid' | 'outline' | 'clear';
  expand?: 'block';
  color?: 'primary' | 'danger' | 'success' | 'warning' | 'medium' | 'light' | 'dark';
  shape?: 'round' | 'circle';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}>(), {
  fill: 'solid',
  color: 'primary',
  type: 'button',
});

defineEmits<{
  (e: 'click', event: MouseEvent): void;
}>();
</script>

<style scoped lang="scss">
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  border-radius: 6px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  gap: 8px;

  &.expand-block {
    display: flex;
    width: 100%;
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  &.shape-circle {
    border-radius: 50%;
    padding: 8px;
    width: 40px;
    height: 40px;
  }

  /* Colors */
  &.color-primary {
    --btn-color: var(--ion-color-primary, #4a90e2);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-danger {
    --btn-color: var(--ion-color-danger, #f44336);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-success {
    --btn-color: var(--ion-color-success, #4caf50);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-medium {
    --btn-color: var(--ion-color-medium, #424242);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-light {
    --btn-color: var(--ion-color-light, #2d2d2d);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-dark {
    --btn-color: var(--ion-color-dark, #1a1a1a);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }

  /* Fills */
  &.fill-solid {
    background: var(--btn-color);
    color: var(--btn-text);
    border: none;

    &:hover:not(.is-disabled) {
      background: var(--btn-color-hover);
    }
    &:active:not(.is-disabled) {
      transform: scale(0.98);
    }
  }

  &.fill-outline {
    background: transparent;
    color: var(--btn-color);
    border: 2px solid var(--btn-color);

    &:hover:not(.is-disabled) {
      background: rgba(255, 255, 255, 0.05);
    }
    &:active:not(.is-disabled) {
      background: rgba(255, 255, 255, 0.1);
    }
  }

  &.fill-clear {
    background: transparent;
    color: var(--btn-color);
    border: none;
    padding: 8px;

    &:hover:not(.is-disabled) {
      background: rgba(255, 255, 255, 0.05);
    }
    &:active:not(.is-disabled) {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}
</style>
