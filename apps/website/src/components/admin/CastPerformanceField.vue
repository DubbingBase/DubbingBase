<template>
  <fieldset class="space-y-1.5">
    <legend class="text-xs font-semibold theme-text-secondary">
      {{ $t("projectEditor.performanceType") }}
    </legend>
    <div class="-mx-1 flex flex-wrap gap-2 px-1" role="radiogroup">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="performance === option.value"
        class="min-h-10 rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)]"
        :class="
          performance === option.value
            ? 'theme-status-info theme-status-info-text border-[var(--app-color-focus)]'
            : 'theme-border theme-surface-overlay theme-text-secondary theme-hover-surface-muted'
        "
        @click="performance = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
/** Performance type chips (dialogues, chant, narration...) shared by the cast editors. */
const { t } = useI18n();
const performance = defineModel<string>({ required: true });
const options = computed(() => [
  { value: "dialogues", label: t("admin.movieEditor.dialogues") },
  { value: "dialogues & chant", label: t("admin.movieEditor.dialoguesAndChant") },
  { value: "chant", label: t("admin.movieEditor.chant") },
  { value: "bruitages", label: t("projectEditor.performanceBruitages") },
  { value: "narration", label: t("projectEditor.performanceNarration") },
]);
</script>
