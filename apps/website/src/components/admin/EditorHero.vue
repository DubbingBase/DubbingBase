<template>
  <header
    class="overflow-hidden rounded-3xl border theme-border theme-surface-overlay"
    data-testid="editor-hero"
  >
    <div class="flex items-start gap-4 p-4 sm:gap-6 sm:p-6">
      <div
        class="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border theme-border theme-surface-muted shadow-md sm:h-36 sm:w-24"
      >
        <NuxtImg
          v-if="posterUrl"
          :src="posterUrl"
          :alt="title"
          format="webp"
          width="96"
          height="144"
          class="h-full w-full object-cover"
        />
        <span v-else class="flex h-full w-full items-center justify-center theme-text-muted">
          <ImageIcon class="h-6 w-6 opacity-60" aria-hidden="true" />
        </span>
      </div>

      <div class="min-w-0 flex-1 space-y-2">
        <NuxtLink
          :to="backTo"
          class="-ml-1 inline-flex min-h-8 items-center gap-1 rounded-lg px-1 text-xs font-semibold theme-text-muted theme-hover-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
        >
          <ArrowLeftIcon class="h-3.5 w-3.5" aria-hidden="true" />
          {{ backLabel }}
        </NuxtLink>
        <p class="text-[11px] font-semibold uppercase tracking-wider theme-status-info-text">
          {{ eyebrow }}
        </p>
        <h1 class="line-clamp-2 text-xl font-bold leading-tight theme-text sm:text-3xl">
          {{ title }}
        </h1>
        <ul v-if="chips.length > 0" class="flex flex-wrap gap-1.5 pt-1">
          <li v-for="chip in chips" :key="chip">
            <AppChip>{{ chip }}</AppChip>
          </li>
        </ul>
      </div>
    </div>

    <div v-if="$slots.default" class="border-t theme-border px-4 py-3 sm:px-6">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import { ArrowLeftIcon, ImageIcon } from "lucide-vue-next";

withDefaults(
  defineProps<{
    title: string;
    eyebrow: string;
    backTo: string;
    backLabel: string;
    posterUrl?: string;
    chips?: string[];
  }>(),
  { posterUrl: "", chips: () => [] },
);
</script>
