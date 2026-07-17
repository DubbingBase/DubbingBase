<template>
  <div class="app-searchbar" :class="{ 'is-disabled': disabled, 'is-animated': animated }">
    <div class="searchbar-input-container">
      <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <path d="M221.09 64a157.09 157.09 0 10157.09 157.09A157.1 157.1 0 00221.09 64z" fill="none" stroke="currentColor" stroke-miterlimit="10" stroke-width="32"/>
        <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-miterlimit="10" stroke-width="32" d="M338.29 338.29L448 448"/>
      </svg>
      <input
        type="search"
        class="searchbar-input"
        :placeholder="placeholder"
        :value="modelValue"
        :disabled="disabled"
        @input="onInput"
        @focus="$emit('ionFocus', $event)"
        @blur="$emit('ionBlur', $event)"
      />
      <button v-if="modelValue && modelValue.length > 0 && !disabled" class="searchbar-clear-button" type="button" @click="clearInput">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
          <path fill="currentColor" d="M289.94 256l95-95A24 24 0 00351 127l-95 95-95-95a24 24 0 00-34 34l95 95-95 95a24 24 0 1034 34l95-95 95 95a24 24 0 0034-34z"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  modelValue?: string;
  placeholder?: string;
  disabled?: boolean;
  animated?: boolean;
  debounce?: number;
}>(), {
  modelValue: '',
  placeholder: 'Search',
  disabled: false,
  animated: false,
  debounce: 0
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'ionInput', event: { target: { value: string } }): void;
  (e: 'ionFocus', event: Event): void;
  (e: 'ionBlur', event: Event): void;
  (e: 'ionClear'): void;
}>();

let debounceTimeout: any = null;

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  
  if (props.debounce > 0) {
    if (debounceTimeout) clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      emit('update:modelValue', value);
      emit('ionInput', { target: { value } });
    }, props.debounce);
  } else {
    emit('update:modelValue', value);
    emit('ionInput', { target: { value } });
  }
};

const clearInput = () => {
  emit('update:modelValue', '');
  emit('ionInput', { target: { value: '' } });
  emit('ionClear');
};
</script>

<style scoped lang="scss">
.app-searchbar {
  padding: 8px 12px;
  width: 100%;
  
  &.is-disabled {
    opacity: 0.5;
    pointer-events: none;
  }
}

.searchbar-input-container {
  display: flex;
  align-items: center;
  background: var(--ion-color-step-100, #1e1e1e);
  border-radius: 12px; /* Increased to match screenshot */
  padding: 0 16px;
  height: 44px; /* Increased to match screenshot */
}

.search-icon {
  width: 18px;
  height: 18px;
  color: var(--ion-color-text-muted, #8e8e8e);
  margin-right: 12px;
  flex-shrink: 0;
}

.searchbar-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--ion-color-text-primary, #ffffff);
  font-size: 16px;
  height: 100%;
  outline: none;
  padding: 0;
  width: 100%;
  font-family: inherit;

  &::placeholder {
    color: var(--ion-color-text-muted, #8e8e8e);
  }
  
  /* Hide default clear button on webkit */
  &::-webkit-search-decoration,
  &::-webkit-search-cancel-button,
  &::-webkit-search-results-button,
  &::-webkit-search-results-decoration {
    display: none;
  }
}

.searchbar-clear-button {
  background: transparent;
  border: none;
  padding: 4px;
  margin-left: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-text-muted, #8e8e8e);
  cursor: pointer;
  border-radius: 50%;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  svg {
    width: 16px;
    height: 16px;
  }
}
</style>
