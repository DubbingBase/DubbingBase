<template>
  <div class="grid items-end gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
    <AdminFormField :label="$t('projectEditor.castNote')" for-id="cast-detail-note">
      <input
        id="cast-detail-note"
        v-model="note"
        type="text"
        enterkeyhint="done"
        class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
      />
    </AdminFormField>
    <label
      class="flex h-11 cursor-pointer items-center gap-3 rounded-xl border theme-border theme-surface-overlay px-4 text-sm theme-text-secondary"
    >
      <StarIcon class="h-4 w-4 text-[var(--app-color-rating)]" aria-hidden="true" />
      {{ $t("projectEditor.highlightCharacter") }}
      <input
        v-model="highlight"
        type="checkbox"
        class="h-5 w-5 rounded accent-[var(--app-color-primary)]"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { StarIcon } from "lucide-vue-next";

/** Free-text note and "highlight" toggle of a cast role. */
const note = defineModel<string>("note", { required: true });
const highlight = defineModel<boolean>("highlight", { required: true });
</script>
