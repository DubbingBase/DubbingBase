<template>
  <div :class="wide ? 'col-span-2 md:col-span-1' : ''">
    <h3 class="text-xs font-bold theme-text-muted uppercase tracking-wider mb-2">
      {{ label }}
    </h3>
    <slot>
      <p class="font-medium text-sm">{{ value || "-" }}</p>
    </slot>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value?: string | number | null;
  wide?: boolean;
}>();
</script>
