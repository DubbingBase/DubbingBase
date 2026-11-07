<template>
  <div class="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
    <div>
      <h2 class="text-2xl font-bold theme-text flex items-center gap-2">
        <span>{{ title }}</span>
      </h2>
      <slot />
      <div v-if="subtitle" class="theme-text-muted text-sm mt-1">
        {{ subtitle }}
      </div>
    </div>
    <div v-if="searchable" class="relative w-full sm:w-64">
      <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 theme-text-muted" />
      <input
        v-model="search"
        type="search"
        :placeholder="placeholder ?? $t('search.placeholder')"
        :aria-label="placeholder ?? $t('search.placeholder')"
        class="w-full theme-input border theme-border-subtle theme-border rounded-xl pl-10 pr-4 py-2 text-sm theme-focus transition-all theme-text"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { SearchIcon } from "lucide-vue-next";
const search = defineModel<string>("search", { default: "" });
withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    searchable?: boolean;
    placeholder?: string;
  }>(),
  { searchable: true },
);
</script>
