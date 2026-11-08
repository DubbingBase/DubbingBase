<template>
  <span :class="classes"><slot /></span>
</template>

<script setup lang="ts">
export type AppChipTone = "neutral" | "info" | "success" | "warning" | "danger";
export type AppChipSize = "xs" | "sm" | "md";

const props = withDefaults(
  defineProps<{
    /** Semantic colour, mapped to the shared theme tokens. */
    tone?: AppChipTone;
    size?: AppChipSize;
    /** Dashed outline, used for "add / unassigned" affordances. */
    dashed?: boolean;
    /** Uppercase, extra-bold text used by status badges. */
    uppercase?: boolean;
  }>(),
  { tone: "neutral", size: "sm", dashed: false, uppercase: false },
);

const tones: Record<AppChipTone, string> = {
  neutral: "theme-surface-muted theme-border theme-text-secondary",
  info: "theme-status-info",
  success: "theme-status-success",
  warning: "theme-status-warning",
  danger: "theme-status-danger",
};

const sizes: Record<AppChipSize, string> = {
  xs: "px-2 py-0.5 text-[10px]",
  sm: "px-2.5 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

const classes = computed(() => [
  "inline-flex items-center gap-1.5 rounded-full border font-medium",
  tones[props.tone],
  sizes[props.size],
  props.dashed && "border-dashed",
  props.uppercase && "font-extrabold uppercase",
]);
</script>
