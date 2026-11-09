<template>
  <AdminFormField :label="label" :for-id="id" :hint="hint">
    <textarea
      v-if="multiline"
      :id="id"
      v-model="value"
      :rows="rows"
      :maxlength="maxlength"
      :placeholder="placeholder"
      :class="[inputClass, 'py-2.5']"
    />
    <input
      v-else
      :id="id"
      v-model="value"
      :type="type"
      :required="required"
      :readonly="readonly"
      :disabled="disabled"
      :maxlength="maxlength"
      :min="min"
      :max="max"
      :inputmode="type === 'number' ? 'numeric' : undefined"
      :placeholder="placeholder"
      :class="[inputClass, 'h-11', readonly ? 'cursor-not-allowed opacity-60' : '']"
    />
  </AdminFormField>
</template>

<script setup lang="ts">
const inputClass =
  "w-full rounded-xl border theme-border theme-input px-4 text-base sm:text-sm theme-text theme-placeholder focus:outline-none focus:ring-2 focus:ring-[var(--app-color-focus)] disabled:cursor-not-allowed disabled:opacity-50";

/** Labelled text/number/url input (or textarea) in the shared editor style. */
withDefaults(
  defineProps<{
    label: string;
    id: string;
    type?: "text" | "number" | "url";
    placeholder?: string;
    hint?: string;
    maxlength?: number;
    min?: number | string;
    max?: number | string;
    rows?: number;
    multiline?: boolean;
    required?: boolean;
    readonly?: boolean;
    disabled?: boolean;
  }>(),
  { type: "text", rows: 4 },
);
const value = defineModel<string | number | null>({ required: true });
</script>
