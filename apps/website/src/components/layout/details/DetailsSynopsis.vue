<template>
  <section class="mb-10" :aria-label="$t('details.synopsis')">
    <div class="max-w-4xl min-w-0">
      <!-- No visible heading: a paragraph right under the hero is understood as the plot. -->
      <p
        :class="[
          'theme-text-secondary leading-relaxed text-base md:text-lg whitespace-pre-line',
          expanded ? '' : 'line-clamp-3',
        ]"
      >
        {{ text || emptyLabel || $t("details.noSynopsis") }}
      </p>
      <button
        v-if="text && text.length > clampThreshold"
        type="button"
        class="mt-2 text-sm font-medium theme-primary-text theme-hover-primary-text transition-colors"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? $t("common.showLess") : $t("common.readMore") }}
      </button>
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

defineProps<{ text?: string | null; emptyLabel?: string }>();

// About three lines of text at the widest layout.
const clampThreshold = 260;
const expanded = ref(false);
</script>
