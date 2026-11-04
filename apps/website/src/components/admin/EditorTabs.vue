<template>
  <!-- Sticks below the 68px site header; full-bleed blur keeps content legible while scrolling. -->
  <nav
    :aria-label="navLabel"
    class="sticky top-[68px] z-30 -mx-4 border-b theme-border theme-header px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-2xl lg:border lg:px-2"
    data-testid="editor-sections"
  >
    <div class="flex" role="tablist">
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        role="tab"
        :aria-selected="modelValue === item.id"
        :aria-current="modelValue === item.id ? 'page' : undefined"
        class="relative flex min-h-12 flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--app-color-focus)] lg:flex-none lg:px-5"
        :class="modelValue === item.id ? 'theme-text' : 'theme-text-muted theme-hover-text'"
        :data-testid="`section-${item.id}`"
        @click="emit('update:modelValue', item.id)"
      >
        {{ item.label }}
        <span
          v-if="item.count !== null"
          class="rounded-full px-1.5 text-[11px] tabular-nums"
          :class="
            modelValue === item.id
              ? 'theme-status-info theme-status-info-text'
              : 'theme-surface-muted theme-text-muted'
          "
        >
          {{ item.count }}
        </span>
        <span
          v-if="modelValue === item.id"
          class="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[var(--app-color-primary)]"
          aria-hidden="true"
        />
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts" generic="T extends string">
defineProps<{
  items: { id: T; label: string; count: number | null }[];
  modelValue: T;
  navLabel: string;
}>();

const emit = defineEmits<{ "update:modelValue": [id: T] }>();
</script>
