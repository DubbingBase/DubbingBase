<template>
  <div
    v-if="toast.show"
    class="fixed inset-x-4 bottom-24 z-[95] flex max-w-sm flex-col gap-2 rounded-xl border p-4 text-sm shadow-2xl theme-surface-overlay theme-border theme-text sm:inset-x-auto sm:right-6"
    role="status"
  >
    <span>{{ toast.message }}</span>
    <a
      v-if="toast.link"
      :href="toast.link"
      target="_blank"
      class="theme-status-info-text hover:underline"
      >{{ $t("projectEditor.viewDetails") }}</a
    >
  </div>
</template>

<script setup lang="ts">
import type { EditorToastState } from "~/composables/useEditorToast";

defineProps<{ toast: EditorToastState }>();
</script>
