<template>
  <div ref="root" class="relative shrink-0">
    <button
      id="home-search-type"
      type="button"
      role="combobox"
      data-testid="home-search-type"
      aria-haspopup="listbox"
      :aria-expanded="open"
      aria-controls="home-search-type-list"
      :aria-label="t('home.hero.searchTypeLabel')"
      class="flex cursor-pointer items-center gap-2 rounded-full py-2 pl-3 pr-2 text-sm font-semibold theme-text transition theme-hover-surface-muted theme-focus md:py-2.5 md:pl-4 md:text-base"
      @click="open = !open"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.esc="open = false"
    >
      <component
        :is="searchTypeIcons[modelValue]"
        class="h-4 w-4 md:h-5 md:w-5"
        :class="searchTypeColors[modelValue]"
        aria-hidden="true"
      />
      <span class="whitespace-nowrap">{{ labelFor(modelValue) }}</span>
      <ChevronDownIcon
        class="h-4 w-4 theme-text-muted transition-transform"
        :class="open ? 'rotate-180' : ''"
        aria-hidden="true"
      />
    </button>
    <ul
      v-show="open"
      id="home-search-type-list"
      role="listbox"
      :aria-label="t('home.hero.searchTypeLabel')"
      class="absolute left-0 top-full z-20 mt-2 min-w-48 rounded-2xl border p-1 shadow-xl theme-surface-raised theme-border"
    >
      <li
        v-for="option in searchTypeOptions"
        :key="option"
        role="option"
        :aria-selected="option === modelValue"
        class="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition theme-hover-surface-muted"
        :class="option === modelValue ? 'theme-selected' : 'theme-text-secondary'"
        @click="select(option)"
      >
        <component
          :is="searchTypeIcons[option]"
          class="h-4 w-4"
          :class="searchTypeColors[option]"
          aria-hidden="true"
        />
        {{ labelFor(option) }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { ChevronDown as ChevronDownIcon } from "lucide-vue-next";
import {
  searchTypeColors,
  searchTypeIcons,
  searchTypeLabelKeys,
  searchTypeOptions,
  type SearchMediaType,
} from "../utils/search-type-display";

const props = defineProps<{ modelValue: SearchMediaType }>();
const emit = defineEmits<{ "update:modelValue": [value: SearchMediaType] }>();

const { t } = useI18n();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
onClickOutside(root, () => {
  open.value = false;
});

const labelFor = (type: SearchMediaType): string => t(searchTypeLabelKeys[type]);

const select = (type: SearchMediaType): void => {
  emit("update:modelValue", type);
  open.value = false;
};

/** Arrow keys cycle the value without opening the list, like a native select. */
const move = (step: number): void => {
  const index = searchTypeOptions.indexOf(props.modelValue);
  const next =
    searchTypeOptions[(index + step + searchTypeOptions.length) % searchTypeOptions.length];
  if (next) emit("update:modelValue", next);
};
</script>
