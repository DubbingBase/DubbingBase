<template>
  <div
    class="sticky bottom-0 z-40 -mx-2 px-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    data-testid="editor-save-bar"
  >
    <div
      class="theme-surface-overlay border theme-border rounded-2xl shadow-2xl px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="min-w-0 text-sm flex items-start gap-2">
        <span
          aria-hidden="true"
          class="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          :class="indicatorClass"
        />
        <p
          v-if="status === 'error'"
          role="alert"
          class="theme-status-danger-text break-words"
          data-testid="editor-save-status"
        >
          <span class="font-semibold">{{ $t("projectEditor.saveBar.error") }}</span>
          <span v-if="errorMessage"> {{ errorMessage }}</span>
        </p>
        <p
          v-else
          role="status"
          aria-live="polite"
          class="theme-text-secondary"
          data-testid="editor-save-status"
        >
          {{ statusLabel }}
        </p>
      </div>

      <div class="flex items-center gap-2 sm:shrink-0">
        <slot />
        <button
          type="button"
          class="flex-1 sm:flex-none min-h-11 px-4 py-2 text-sm font-semibold rounded-xl border theme-border theme-surface-muted theme-hover-surface-muted theme-text-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
          :disabled="!canDiscard"
          data-testid="editor-discard"
          @click="$emit('discard')"
        >
          {{ $t("projectEditor.saveBar.discard") }}
        </button>
        <button
          type="submit"
          :form="formId"
          class="flex-1 sm:flex-none min-h-11 px-6 py-2 text-sm font-bold rounded-xl theme-primary-bg hover:bg-[var(--app-color-primary-hover)] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
          :disabled="status === 'saving' || disabled"
          :aria-busy="status === 'saving'"
          data-testid="editor-save"
        >
          <Loader2Icon v-if="status === 'saving'" class="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>{{ saveLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Loader2Icon } from "lucide-vue-next";
import type { EditorSaveStatus } from "~/composables/useEditorFormState";

const props = defineProps<{
  status: EditorSaveStatus;
  isDirty: boolean;
  errorMessage?: string | null;
  saveLabel: string;
  /** Id of the editor form; the submit button lives outside it to stay reachable. */
  formId: string;
  disabled?: boolean;
}>();

defineEmits<{ (e: "discard"): void }>();

const { t } = useI18n();

const canDiscard = computed(() => props.isDirty && props.status !== "saving");

const statusLabel = computed(() => {
  switch (props.status) {
    case "dirty":
      return t("projectEditor.saveBar.dirty");
    case "saving":
      return t("projectEditor.saveBar.saving");
    case "saved":
      return t("projectEditor.saveBar.saved");
    default:
      return t("projectEditor.saveBar.pristine");
  }
});

const indicatorClass = computed(() => {
  switch (props.status) {
    case "dirty":
      return "bg-[var(--app-color-warning-text)]";
    case "saving":
      return "bg-[var(--app-color-info-text)] animate-pulse";
    case "saved":
      return "bg-[var(--app-color-success-text)]";
    case "error":
      return "bg-[var(--app-color-danger-text)]";
    default:
      return "bg-[var(--app-color-border)]";
  }
});
</script>
