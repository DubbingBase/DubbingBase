<template>
  <span :class="classes"
    ><span v-if="label" class="theme-text-muted font-medium mr-1.5">{{ label }}</span
    ><slot
  /></span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "rating" | "text" | "tag";
    /** Small muted prefix, e.g. "Developer". */
    label?: string;
  }>(),
  { variant: "primary" },
);

const base = "theme-surface-overlay backdrop-blur-md rounded-lg";
const variants = {
  primary: "px-3 py-1 theme-text font-semibold text-base md:text-lg",
  text: "px-3 py-1 theme-text font-medium text-sm md:text-base truncate max-w-[200px] md:max-w-xs",
  secondary: "px-3 py-1 theme-text-secondary font-medium text-sm md:text-base",
  rating: "px-3 py-1 flex items-center gap-1.5 theme-text font-bold text-sm md:text-base",
  tag: "px-2.5 py-1 theme-text-secondary font-medium text-xs md:text-sm",
} as const;

const classes = computed(() => [base, variants[props.variant]]);
</script>
