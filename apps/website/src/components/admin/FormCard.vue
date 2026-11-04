<template>
  <section class="space-y-5 rounded-2xl border theme-border theme-surface-overlay p-4 sm:p-6">
    <header v-if="title" class="space-y-0.5">
      <h2 class="text-base font-bold theme-text">{{ title }}</h2>
      <p v-if="description" class="text-xs theme-text-muted">{{ description }}</p>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title?: string; description?: string }>();
</script>
