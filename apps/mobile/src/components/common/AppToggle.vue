<template>
  <label class="app-toggle" :class="{ 'is-disabled': disabled }">
    <input
      type="checkbox"
      class="app-toggle-input"
      :checked="checked"
      :disabled="disabled"
      @change="onChange"
    />
    <span class="app-toggle-slider" :class="colorClass"></span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  checked?: boolean;
  disabled?: boolean;
  color?: 'primary' | 'danger' | 'success' | 'warning' | 'medium' | 'light' | 'dark';
}>(), {
  checked: false,
  disabled: false,
  color: 'primary'
});

const emit = defineEmits<{
  (e: 'update:checked', value: boolean): void;
  (e: 'ionChange', event: { detail: { checked: boolean } }): void;
}>();

const onChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const isChecked = target.checked;
  emit('update:checked', isChecked);
  emit('ionChange', { detail: { checked: isChecked } });
};

const colorClass = computed(() => `color-${props.color}`);
</script>

<style scoped lang="scss">
.app-toggle {
  position: relative;
  display: inline-block;
  width: 52px;
  height: 32px;
  
  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.app-toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
}

.app-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--app-color-border, #333333);
  transition: .3s;
  border-radius: 32px;

  &:before {
    position: absolute;
    content: "";
    height: 24px;
    width: 24px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    transition: .3s;
    border-radius: 50%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
  
  /* Color variants */
  &.color-primary { --active-color: var(--app-color-primary, #4a90e2); }
  &.color-danger { --active-color: var(--app-color-danger, #f44336); }
  &.color-success { --active-color: var(--app-color-success, #4caf50); }
  &.color-warning { --active-color: var(--app-color-warning, #ff9800); }
  &.color-medium { --active-color: var(--app-color-medium, #424242); }
  &.color-light { --active-color: var(--app-color-light, #2d2d2d); }
  &.color-dark { --active-color: var(--app-color-dark, #1a1a1a); }
}

.app-toggle-input:checked + .app-toggle-slider {
  background-color: var(--active-color);
}

.app-toggle-input:focus + .app-toggle-slider {
  box-shadow: 0 0 1px var(--active-color);
}

.app-toggle-input:checked + .app-toggle-slider:before {
  transform: translateX(20px);
}
</style>
