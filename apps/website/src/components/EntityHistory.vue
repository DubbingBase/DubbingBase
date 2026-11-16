<template>
  <section class="theme-surface border theme-border rounded-2xl p-4 sm:p-6">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 text-left theme-focus rounded-lg"
      :aria-expanded="isOpen"
      :aria-controls="panelId"
      @click="toggle"
    >
      <h2 class="text-lg font-semibold theme-text">{{ $t("history.title") }}</h2>
      <span class="text-sm theme-text-muted">
        {{ isOpen ? $t("history.hide") : $t("history.show") }}
      </span>
    </button>

    <div v-if="isOpen" :id="panelId" class="mt-4">
      <p v-if="isLoading" class="text-sm theme-text-muted">{{ $t("history.loading") }}</p>
      <p v-else-if="hasError" class="text-sm theme-text-muted">{{ $t("history.error") }}</p>
      <p v-else-if="entries.length === 0" class="text-sm theme-text-muted">
        {{ $t("history.empty") }}
      </p>
      <ol v-else class="space-y-4">
        <li v-for="entry in entries" :key="entry.id" class="border-l-2 theme-border pl-4">
          <p class="text-sm theme-text">
            <span class="font-medium">{{ entry.contributor }}</span>
            <span class="theme-text-muted">
              · {{ formatDate(entry.createdAt) }}
              <template v-if="entry.target === 'cast_credit'">
                · {{ $t("history.castCredit")
                }}<template v-if="entry.label"> ({{ entry.label }})</template>
              </template>
            </span>
          </p>
          <ul class="mt-1 space-y-1">
            <li v-for="change in entry.changes" :key="change.field" class="text-sm">
              <span class="theme-text-muted">{{ fieldLabel(change.field) }}:</span>
              <span class="theme-text-muted line-through break-words">
                {{ change.before ?? $t("history.noValue") }}
              </span>
              →
              <span class="theme-text break-words">
                {{ change.after ?? $t("history.noValue") }}
              </span>
            </li>
          </ul>
        </li>
      </ol>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useEntityHistory, type HistoryEntityType } from "../composables/useEntityHistory";

const props = defineProps<{
  type: HistoryEntityType;
  entityId: string | number | undefined;
}>();

const { t, te, locale } = useI18n();
const { entries, isLoading, hasError, isLoaded, load } = useEntityHistory(
  props.type,
  () => props.entityId,
);

const isOpen = ref(false);
const panelId = useId();

async function toggle(): Promise<void> {
  isOpen.value = !isOpen.value;
  if (isOpen.value && !isLoaded.value) await load();
}

function fieldLabel(field: string): string {
  const key = `history.fields.${field}`;
  return te(key) ? t(key) : field;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale.value, { dateStyle: "medium" }).format(date);
}
</script>
