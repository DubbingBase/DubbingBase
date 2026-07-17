<template>
  <div class="app-input-container" :class="{ 'is-disabled': disabled, 'has-focus': isFocused }">
    <label v-if="label" class="app-input-label" :class="labelPlacement">{{ label }}</label>
    <input
      :type="type"
      class="app-input-field"
      :placeholder="placeholder"
      :value="modelValue"
      :disabled="disabled"
      @input="onInput"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  modelValue?: string | number | null;
  label?: string;
  labelPlacement?: 'stacked' | 'floating' | 'fixed';
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}>(), {
  modelValue: '',
  labelPlacement: 'stacked',
  type: 'text',
  placeholder: '',
  disabled: false
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
  (e: 'ionInput', event: { target: { value: string | number } }): void;
}>();

const isFocused = ref(false);

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
  emit('ionInput', { target: { value: target.value } });
};
</script>

<style scoped lang="scss">
.app-input-container {
  display: flex;
  flex-direction: column;
  background: var(--app-color-card, #1e1e1e);
  padding: 10px 16px;
  border-bottom: 1px solid var(--app-color-border, #333333);
  transition: border-bottom-color 0.2s ease;

  &.has-focus {
    border-bottom-color: var(--app-color-primary, #4a90e2);
  }

  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.app-input-label {
  font-size: 13px;
  color: var(--app-color-text-primary, #ffffff);
  margin-bottom: 4px;
}

.app-input-field {
  background: transparent;
  border: none;
  color: var(--app-color-text-secondary, #b3b3b3);
  font-size: 16px;
  padding: 4px 0;
  width: 100%;
  outline: none;
  font-family: inherit;

  &::placeholder {
    color: var(--app-color-text-muted, #8e8e8e);
  }
}
</style>
