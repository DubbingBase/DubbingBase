<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    page: number;
    totalItems: number;
    pageSize?: number;
  }>(),
  { pageSize: 12 },
);

const emit = defineEmits<{
  "update:page": [page: number];
}>();

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.totalItems / Math.max(1, props.pageSize))),
);
const currentPage = computed(() =>
  Math.min(Math.max(1, props.page), totalPages.value),
);

function setPage(page: number) {
  emit("update:page", Math.min(Math.max(1, page), totalPages.value));
}
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="mt-6 flex flex-wrap items-center justify-center gap-3"
    :aria-label="$t('common.pagination')"
  >
    <button
      type="button"
      class="rounded-lg border theme-border-subtle px-3 py-2 text-sm theme-text-secondary transition theme-hover-primary-border disabled:cursor-not-allowed disabled:opacity-40 theme-border theme-text-secondary"
      :disabled="currentPage === 1"
      @click="setPage(currentPage - 1)"
    >
      {{ $t("admin.spreadsheet.previous") }}
    </button>
    <span class="text-sm theme-text-muted">
      {{
        $t("admin.spreadsheet.pageOf", {
          page: currentPage,
          total: totalPages,
        })
      }}
    </span>
    <button
      type="button"
      class="rounded-lg border theme-border-subtle px-3 py-2 text-sm theme-text-secondary transition theme-hover-primary-border disabled:cursor-not-allowed disabled:opacity-40 theme-border theme-text-secondary"
      :disabled="currentPage === totalPages"
      @click="setPage(currentPage + 1)"
    >
      {{ $t("admin.spreadsheet.next") }}
    </button>
  </nav>
</template>
