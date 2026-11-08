<template>
  <component :is="tag" v-bind="tagAttrs" :class="classes">
    <slot />
  </component>
</template>

<script setup lang="ts">
/**
 * Single control style for the details action bar (back, studio, edit, share, report),
 * so every control shares the same height, radius, border and typography.
 */
import type { RouteLocationRaw } from "vue-router";

const props = withDefaults(
  defineProps<{
    /** Renders a NuxtLink instead of a button when provided. */
    to?: RouteLocationRaw;
    /** Colour the control takes on hover. */
    hover?: "default" | "primary" | "danger";
  }>(),
  { to: undefined, hover: "default" },
);

const NuxtLink = resolveComponent("NuxtLink");
const tag = computed(() => (props.to ? NuxtLink : "button"));
const tagAttrs = computed(() => (props.to ? { to: props.to } : { type: "button" }));

const hoverClasses = {
  default: "theme-hover-surface-muted",
  primary: "theme-hover-surface-muted theme-hover-primary-text",
  danger: "theme-hover-surface-muted theme-hover-danger-text",
} as const;

const classes = computed(() => [
  "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium cursor-pointer",
  "theme-border-subtle theme-border theme-surface theme-text-secondary transition-colors",
  "focus-visible:outline-2 focus-visible:outline-offset-2",
  hoverClasses[props.hover],
]);
</script>
