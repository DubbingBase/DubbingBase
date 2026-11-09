<template>
  <component :is="tag" v-bind="tagAttrs" :class="classes">
    <slot />
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Highlights the chip as the current selection. */
    selected?: boolean;
    /** Renders a NuxtLink instead of a button when provided. */
    to?: string;
    /** Dashed outline, used for "add" affordances. */
    dashed?: boolean;
    size?: "sm" | "md";
  }>(),
  { selected: false, to: undefined, dashed: false, size: "sm" },
);

const NuxtLink = resolveComponent("NuxtLink");
const tag = computed(() => (props.to ? NuxtLink : "button"));
const tagAttrs = computed(() =>
  props.to ? { to: props.to } : { type: "button", "aria-pressed": props.selected },
);

const classes = computed(() => [
  "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors cursor-pointer",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]",
  props.size === "md" ? "min-h-10 px-4 text-sm" : "min-h-9 px-3.5 text-xs",
  props.dashed && "border-dashed",
  props.selected
    ? "theme-status-info theme-status-info-text border-[var(--app-color-focus)]"
    : "theme-border theme-surface-overlay theme-text-secondary theme-hover-surface-muted",
]);
</script>
