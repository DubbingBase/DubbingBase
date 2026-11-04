<template>
  <NuxtLink
    :to="to"
    class="text-sm theme-primary-text theme-hover-primary-text transition-colors flex items-center gap-1.5 font-medium"
  >
    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M11 17l-5-5m0 0l5-5m-5 5h12"
      />
    </svg>
    <span class="hidden sm:inline">{{ label }}</span>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { RouteLocationRaw } from "vue-router";

defineProps<{ to: RouteLocationRaw; label: string }>();
</script>
