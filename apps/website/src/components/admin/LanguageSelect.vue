<template>
  <select
    :value="modelValue"
    @change="onChange"
    :required="required"
    class="w-full px-4 py-2.5 theme-input border theme-border rounded-xl theme-text focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <option v-if="!isDubbingLanguage(modelValue)" :value="modelValue" disabled>
      {{ $t("admin.regionalDubbingLanguageRequired")
      }}{{ modelValue ? ` (${modelValue})` : "" }}
    </option>
    <option v-for="code in DUBBING_LANGUAGES" :key="code" :value="code">
      {{ displayDubbingLanguage(code, locale) }}
    </option>
  </select>
</template>

<script setup lang="ts">
import {
  DUBBING_LANGUAGES,
  displayDubbingLanguage,
  isDubbingLanguage,
} from "@app/shared-logic";

const { locale } = useI18n();
defineProps<{ modelValue: string; required?: boolean }>();
const emit = defineEmits<{ (e: "update:modelValue", value: string): void }>();

function onChange(event: Event): void {
  const target = event.target;
  if (target instanceof HTMLSelectElement && isDubbingLanguage(target.value)) {
    emit("update:modelValue", target.value);
  }
}
</script>
