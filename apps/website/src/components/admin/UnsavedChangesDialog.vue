<template>
  <AlertDialogRoot :open="open" @update:open="(value: boolean) => !value && $emit('stay')">
    <AlertDialogPortal>
      <AlertDialogOverlay
        class="fixed inset-0 z-[110] bg-[var(--app-color-backdrop-scrim)] backdrop-blur-sm"
      />
      <AlertDialogContent
        class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[120] w-[min(420px,calc(100vw-2rem))] theme-surface-overlay border theme-border rounded-2xl p-6 shadow-2xl"
        data-testid="unsaved-changes-dialog"
      >
        <AlertDialogTitle class="text-lg font-bold theme-text">
          {{ $t("projectEditor.unsavedDialog.title") }}
        </AlertDialogTitle>
        <AlertDialogDescription class="mt-2 text-sm theme-text-secondary">
          {{ $t("projectEditor.unsavedDialog.description") }}
        </AlertDialogDescription>
        <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            class="min-h-11 px-4 py-2 text-sm font-semibold rounded-xl border theme-border theme-surface-muted theme-hover-surface-muted theme-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
            data-testid="unsaved-stay"
            @click="$emit('stay')"
          >
            {{ $t("projectEditor.unsavedDialog.stay") }}
          </AlertDialogCancel>
          <button
            type="button"
            class="min-h-11 px-4 py-2 text-sm font-semibold rounded-xl border border-[var(--app-color-danger-border)] theme-status-danger theme-status-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
            data-testid="unsaved-discard"
            @click="$emit('discard')"
          >
            {{ $t("projectEditor.unsavedDialog.discard") }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<script setup lang="ts">
import {
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from "reka-ui";

defineProps<{ open: boolean }>();
defineEmits<{ (e: "stay"): void; (e: "discard"): void }>();
</script>
