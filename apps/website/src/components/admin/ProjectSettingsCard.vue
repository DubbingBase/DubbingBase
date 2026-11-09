<template>
  <AdminFormCard :title="$t('projectEditor.sectionSettings')">
    <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
      <AdminFormField
        :label="languageLabel ?? $t('projectEditor.dubbingLanguage')"
        :for-id="`${idPrefix}-dubbing-language`"
      >
        <AdminLanguageSelect :id="`${idPrefix}-dubbing-language`" v-model="language" required />
      </AdminFormField>
      <AdminFormField :label="$t('common.status')" :for-id="`${idPrefix}-status`">
        <select
          :id="`${idPrefix}-status`"
          v-model="status"
          class="h-11 w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)]"
        >
          <option value="validated">{{ $t("common.validated") }}</option>
          <option value="pending">{{ $t("common.pendingValidation") }}</option>
          <option value="draft">{{ $t("common.draft") }}</option>
        </select>
      </AdminFormField>
    </div>
  </AdminFormCard>
</template>

<script setup lang="ts">
import type { DubbingProjectStatus } from "~/utils/dubbing-project-save";

/** Dubbing language and publication status, shared by every project editor. */
defineProps<{ idPrefix: string; languageLabel?: string }>();
const language = defineModel<string>("language", { required: true });
const status = defineModel<DubbingProjectStatus>("status", { required: true });
</script>
