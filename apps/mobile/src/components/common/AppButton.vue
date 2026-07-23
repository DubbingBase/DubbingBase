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
  color?: 'primary' | 'danger' | 'success' | 'warning' | 'medium' | 'light' | 'dark' | 'text';
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
    --btn-color: var(--app-color-primary, #4a90e2);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-danger {
    --btn-color: var(--app-color-danger, #f44336);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-success {
    --btn-color: var(--app-color-success, #4caf50);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-medium {
    --btn-color: var(--app-color-medium, #424242);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-light {
    --btn-color: var(--app-color-light, #2d2d2d);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-dark {
    --btn-color: var(--app-color-dark, #1a1a1a);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: #ffffff;
  }
  &.color-text {
    --btn-color: var(--app-color-text-primary);
    --btn-color-hover: color-mix(in srgb, var(--btn-color) 85%, black);
    --btn-text: var(--app-color-background);
  }

  /* Fills */
  &.fill-solid {
    background: linear-gradient(135deg, var(--btn-color) 0%, color-mix(in srgb, var(--btn-color) 80%, black) 100%);
    color: var(--btn-text);
    border: none;
    box-shadow: 0 4px 12px -2px color-mix(in srgb, var(--btn-color) 40%, transparent);

    &:hover:not(.is-disabled) {
      background: linear-gradient(135deg, color-mix(in srgb, var(--btn-color) 90%, white) 0%, color-mix(in srgb, var(--btn-color) 70%, black) 100%);
      transform: translateY(-2px);
      box-shadow: 0 6px 16px -2px color-mix(in srgb, var(--btn-color) 50%, transparent);
    }
    &:active:not(.is-disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 6px -2px color-mix(in srgb, var(--btn-color) 40%, transparent);
    }
  }

  &.fill-outline {
    background: transparent;
    color: var(--btn-color);
    border: 2px solid var(--btn-color);

    &:hover:not(.is-disabled) {
      background: var(--app-overlay-5);
    }
    &:active:not(.is-disabled) {
      background: var(--app-overlay-10);
    }
  }

  &.fill-clear {
    background: transparent;
    color: var(--btn-color);
    border: none;
    padding: 8px;

    &:hover:not(.is-disabled) {
      background: var(--app-overlay-5);
    }
    &:active:not(.is-disabled) {
      background: var(--app-overlay-10);
    }
  }
}
</style>
