<template>
  <div class="flex flex-wrap gap-1.5">
    <span
      v-for="(tag, index) in tags"
      :key="index"
      class="px-2 py-0.5 theme-surface-raised theme-surface-muted text-xs font-medium rounded-md theme-text-secondary"
    >
      {{ tag }}
    </span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ tags: string[] }>();
</script>
