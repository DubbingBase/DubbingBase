<template>
  <div class="app-textarea-container" :class="{ 'is-disabled': disabled, 'has-focus': isFocused }">
    <label v-if="label" class="app-textarea-label" :class="labelPlacement">{{ label }}</label>
    <textarea
      class="app-textarea-field"
      :placeholder="placeholder"
      :value="modelValue"
      :disabled="disabled"
      :rows="rows"
      @input="onInput"
      @focus="isFocused = true"
      @blur="isFocused = false"
    ></textarea>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  modelValue?: string | null;
  label?: string;
  labelPlacement?: 'stacked' | 'floating' | 'fixed';
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
}>(), {
  modelValue: '',
  labelPlacement: 'stacked',
  placeholder: '',
  disabled: false,
  rows: 4
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'ionInput', event: { target: { value: string } }): void;
}>();

const isFocused = ref(false);

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
  emit('ionInput', { target: { value: target.value } });
};
</script>

<style scoped lang="scss">
.app-textarea-container {
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.03);
  padding: 12px 16px;
  border: 1px solid var(--app-color-border, #2a2a2a);
  border-radius: 12px;
  transition: all 0.2s ease;
  margin-bottom: 4px;

  &.has-focus {
    border-color: var(--app-color-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    background: rgba(255, 255, 255, 0.05);
  }

  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.app-textarea-label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  color: var(--app-color-text-muted, #888888);
  margin-bottom: 6px;
  transition: color 0.2s ease;
}

.app-textarea-container.has-focus .app-textarea-label {
  color: var(--app-color-primary, #3b82f6);
}

.app-textarea-field {
  background: transparent;
  border: none;
  color: var(--app-color-text-primary, #ffffff);
  font-size: 16px;
  padding: 4px 0;
  width: 100%;
  outline: none;
  resize: vertical;
  font-family: inherit;

  &::placeholder {
    color: var(--app-color-text-muted, #6b7280);
  }
}
</style>
