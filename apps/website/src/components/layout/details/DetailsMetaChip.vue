<template>
  <span :class="classes"><slot /></span>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{ variant?: "primary" | "secondary" | "rating" | "text" }>(),
  { variant: "primary" },
);

const base = "theme-surface-overlay backdrop-blur-md px-3 py-1 rounded-lg";
const variants = {
  primary: "theme-text font-semibold text-base md:text-lg",
  text: "theme-text font-medium text-sm md:text-base truncate max-w-[200px] md:max-w-xs",
  secondary: "theme-text-secondary font-medium text-sm md:text-base",
  rating: "flex items-center gap-1.5 theme-text font-bold text-sm md:text-base",
} as const;

const classes = computed(() => [base, variants[props.variant]]);
</script>
