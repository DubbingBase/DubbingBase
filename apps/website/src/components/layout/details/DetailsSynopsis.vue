<template>
  <section class="mb-10 max-w-4xl">
    <h2 class="text-2xl font-bold mb-4 theme-text">
      {{ $t("details.synopsis") }}
    </h2>
    <p class="theme-text-secondary leading-relaxed text-lg whitespace-pre-line">
      {{ text || emptyLabel || $t("details.noSynopsis") }}
    </p>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ text?: string | null; emptyLabel?: string }>();
</script>
