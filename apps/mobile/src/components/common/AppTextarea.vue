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

.app-textarea-label {
  font-size: 13px;
  color: var(--app-color-text-primary, #ffffff);
  margin-bottom: 4px;
}

.app-textarea-field {
  background: transparent;
  border: none;
  color: var(--app-color-text-secondary, #b3b3b3);
  font-size: 16px;
  padding: 4px 0;
  width: 100%;
  outline: none;
  resize: vertical;
  font-family: inherit;

  &::placeholder {
    color: var(--app-color-text-muted, #8e8e8e);
  }
}
</style>
