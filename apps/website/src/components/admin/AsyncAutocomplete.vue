<template>
  <div class="relative w-full">
    <ComboboxRoot
      :model-value="modelValue"
      @update:model-value="(val: any) => $emit('update:modelValue', val)"
      :ignore-filter="true"
      :open-on-click="true"
      :open-on-focus="true"
      class="w-full relative"
    >
      <ComboboxAnchor class="relative w-full">
        <ComboboxInput
          v-model="searchTerm"
          :display-value="(val) => val == null ? '' : displayFn(val)"
          class="w-full pl-4 pr-16 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
          :placeholder="placeholder"
          :disabled="disabled"
        />
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button 
            v-if="modelValue && !disabled"
            type="button"
            class="p-1 text-slate-500 hover:text-slate-300 transition-colors"
            @click.stop="$emit('update:modelValue', null); searchTerm = ''"
          >
            <XIcon class="w-4 h-4" />
          </button>
          <div v-if="loading" class="p-1">
            <Loader2Icon class="w-4 h-4 text-slate-500 animate-spin" />
          </div>
        </div>
      </ComboboxAnchor>
      
      <ComboboxPortal>
        <ComboboxContent 
          class="z-[100] w-[var(--reka-popper-anchor-width)] mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden"
          position="popper"
        >
          <ComboboxViewport class="max-h-[300px] overflow-y-auto p-1">
            <ComboboxEmpty class="text-slate-400 text-sm py-3 px-4 text-center">
              <span v-if="loading">{{ $t('common.searching') }}</span>
              <span v-else>{{ $t('search.noResults') }}</span>
            </ComboboxEmpty>
            
            <ComboboxGroup>
              <ComboboxItem
                v-for="option in options"
                :key="option.id"
                :value="option.id"
                class="flex items-center px-3 py-2 text-sm text-slate-200 rounded-lg cursor-pointer data-[highlighted]:bg-blue-600 data-[highlighted]:text-white outline-none"
              >
                <slot name="option" :option="option">
                  {{ displayFn(option.id) }}
                </slot>
              </ComboboxItem>
            </ComboboxGroup>

            <!-- Inline creation option -->
            <div 
              v-if="allowCreate && searchTerm.length >= 2 && !loading && (modelValue == null || searchTerm !== displayFn(modelValue))" 
              class="border-t border-slate-700 mt-1 pt-1"
            >
              <button 
                type="button"
                @click="$emit('create', searchTerm)"
                class="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-slate-800 rounded-lg font-medium outline-none focus:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <PlusIcon class="w-4 h-4" />
                {{ $t('common.create', { name: searchTerm }) }}
              </button>
            </div>
          </ComboboxViewport>
        </ComboboxContent>
      </ComboboxPortal>
    </ComboboxRoot>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  ComboboxRoot,
  ComboboxAnchor,
  ComboboxInput,
  ComboboxPortal,
  ComboboxContent,
  ComboboxViewport,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxItem,
} from 'reka-ui';
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-vue-next';
import { useDebounceFn } from '@vueuse/core';

const { t } = useI18n();

const props = defineProps<{
  modelValue: number | string | null;
  options: any[];
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  displayFn: (val: any) => string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number | string | null): void;
  (e: 'search', query: string): void;
  (e: 'create', query: string): void;
}>();

const searchTerm = ref('');

watch(() => props.modelValue, (newVal) => {
  if (newVal == null) {
    searchTerm.value = '';
  } else {
    searchTerm.value = props.displayFn(newVal) || '';
  }
}, { immediate: true });

const debouncedSearch = useDebounceFn((query: string) => {
  // Prevent searching when the input just synced with the selected model value
  if (props.modelValue !== null && query === props.displayFn(props.modelValue)) {
    return;
  }
  emit('search', query);
}, 300);

watch(searchTerm, (newVal) => {
  debouncedSearch(newVal);
});
</script>
