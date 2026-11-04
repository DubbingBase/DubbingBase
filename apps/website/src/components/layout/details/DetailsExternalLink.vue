<template>
  <a
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg theme-surface-overlay theme-text theme-hover-surface-muted transition-colors backdrop-blur-md uppercase tracking-wider"
    >{{ label }}<ExternalLinkIcon class="w-3 h-3 opacity-70" />
  </a>
</template>

<script setup lang="ts">
import { ExternalLinkIcon } from "lucide-vue-next";
defineProps<{ href: string; label: string }>();
</script>
