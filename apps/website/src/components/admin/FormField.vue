<template>
  <div class="space-y-1.5">
    <label :for="forId" class="block text-xs font-semibold theme-text-secondary">
      {{ label }}
    </label>
    <slot />
    <p v-if="hint" class="text-xs theme-text-muted">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; forId?: string; hint?: string }>();
</script>
