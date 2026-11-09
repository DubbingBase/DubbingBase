<template>
  <component
    :is="href ? 'a' : 'span'"
    :href="href"
    :target="href ? '_blank' : undefined"
    :rel="href ? 'noopener noreferrer' : undefined"
    :class="classes"
  >
    <span v-if="label" class="theme-text-muted font-medium mr-1.5">{{ label }}</span>
    <slot />
  </component>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "rating" | "text" | "tag" | "link";
    /** Small muted prefix, e.g. "Developer". */
    label?: string;
    /** Renders the chip as an external link. */
    href?: string;
  }>(),
  { variant: "primary", label: undefined, href: undefined },
);

// Every hero chip shares the same height, padding, radius and type size; variants only
// change colour, weight and truncation.
const base =
  "theme-surface-overlay backdrop-blur-md rounded-lg px-3 py-1 text-sm md:text-base inline-flex items-center";
const variants = {
  primary: "theme-text font-semibold",
  text: "theme-text font-medium truncate max-w-[200px] md:max-w-xs",
  secondary: "theme-text-secondary font-medium",
  rating: "gap-1.5 theme-text font-semibold",
  tag: "theme-text-secondary font-medium",
  link: "gap-1.5 theme-text font-semibold theme-hover-surface-muted transition-colors",
} as const;

const classes = computed(() => [base, variants[props.variant]]);
</script>
