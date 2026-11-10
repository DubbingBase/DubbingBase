<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    page: number;
    totalItems: number;
    scrollTargetId: string;
    label?: string;
    position?: "top" | "bottom";
    pageSize?: number;
  }>(),
  { pageSize: 12, position: "bottom", label: undefined },
);

const emit = defineEmits<{
  "update:page": [page: number];
}>();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.totalItems / Math.max(1, props.pageSize))),
);
const currentPage = computed(() => Math.min(Math.max(1, props.page), totalPages.value));

function setPage(page: number) {
  const nextPage = Math.min(Math.max(1, page), totalPages.value);
  if (nextPage === currentPage.value) return;
  document.getElementById(props.scrollTargetId)?.scrollIntoView({ block: "start" });
  emit("update:page", nextPage);
}
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border theme-border-subtle theme-surface-overlay p-2.5 shadow-sm sm:gap-3 sm:p-3"
    :class="position === 'top' ? 'mb-4' : 'mt-4'"
    :aria-label="
      [label, $t(position === 'top' ? 'common.paginationTop' : 'common.paginationBottom')]
        .filter(Boolean)
        .join(': ')
    "
  >
    <span v-if="label" class="w-full text-xs font-semibold theme-text-secondary sm:w-auto">
      {{ label }}
    </span>
    <button
      type="button"
      class="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border theme-border theme-surface-muted px-2.5 text-xs font-semibold theme-text-secondary transition theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-4 sm:text-sm"
      :disabled="currentPage === 1"
      @click="setPage(currentPage - 1)"
    >
      <ChevronLeftIcon aria-hidden="true" class="hidden h-4 w-4 sm:block" />
      <span>{{ $t("admin.spreadsheet.previous") }}</span>
    </button>
    <span
      class="shrink-0 rounded-xl px-3 py-2 text-center text-xs font-semibold tabular-nums theme-text theme-surface-muted sm:min-w-28 sm:text-sm"
    >
      {{
        $t("admin.spreadsheet.pageOf", {
          page: currentPage,
          total: totalPages,
        })
      }}
    </span>
    <button
      type="button"
      class="inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border theme-border theme-surface-muted px-2.5 text-xs font-semibold theme-text-secondary transition theme-hover-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-color-focus)] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-4 sm:text-sm"
      :disabled="currentPage === totalPages"
      @click="setPage(currentPage + 1)"
    >
      <span>{{ $t("admin.spreadsheet.next") }}</span>
      <ChevronRightIcon aria-hidden="true" class="hidden h-4 w-4 sm:block" />
    </button>
  </nav>
</template>
