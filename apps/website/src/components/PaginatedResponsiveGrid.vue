<script setup lang="ts" generic="T">
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    items: readonly T[];
    pageSize?: number;
    totalItems?: number;
    page?: number;
    gridClass?: string;
    itemKey?: (item: T, index: number) => string | number;
  }>(),
  {
    pageSize: 12,
    totalItems: undefined,
    page: undefined,
    gridClass: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4",
    itemKey: undefined,
  },
);

const emit = defineEmits<{
  "update:page": [page: number];
  pageChange: [page: number];
}>();

defineSlots<{
  default(props: { item: T; index: number }): unknown;
}>();

const localPage = ref(1);
const isServerPaginated = computed(() => props.totalItems !== undefined);
const currentPage = computed(() => props.page ?? localPage.value);
const totalPages = computed(() =>
  Math.max(
    1,
    Math.ceil(
      (props.totalItems ?? props.items.length) / Math.max(1, props.pageSize),
    ),
  ),
);
const visibleItems = computed(() => {
  if (isServerPaginated.value) return props.items;
  const start = (currentPage.value - 1) * props.pageSize;
  return props.items.slice(start, start + props.pageSize);
});

watch(
  () => [props.items, props.totalItems, props.page] as const,
  () => {
    if (currentPage.value > totalPages.value) {
      setPage(totalPages.value);
    }
  },
  { deep: false },
);

const setPage = (page: number) => {
  const nextPage = Math.min(Math.max(1, page), totalPages.value);
  if (props.page === undefined) localPage.value = nextPage;
  emit("update:page", nextPage);
  emit("pageChange", nextPage);
};
</script>

<template>
  <div>
    <div :class="gridClass">
      <template
        v-for="(item, index) in visibleItems"
        :key="itemKey?.(item, index) ?? index"
      >
        <slot :item="item" :index="(currentPage - 1) * pageSize + index" />
      </template>
    </div>

    <nav
      v-if="totalPages > 1"
      class="mt-6 flex flex-wrap items-center justify-center gap-3"
      :aria-label="$t('common.pagination')"
    >
      <button
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2a2a2a] dark:text-gray-300"
        :disabled="currentPage === 1"
        @click="setPage(currentPage - 1)"
      >
        {{ $t("admin.spreadsheet.previous") }}
      </button>
      <span class="text-sm text-gray-500 dark:text-gray-400">
        {{
          $t("admin.spreadsheet.pageOf", {
            page: currentPage,
            total: totalPages,
          })
        }}
      </span>
      <button
        type="button"
        class="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2a2a2a] dark:text-gray-300"
        :disabled="currentPage === totalPages"
        @click="setPage(currentPage + 1)"
      >
        {{ $t("admin.spreadsheet.next") }}
      </button>
    </nav>
  </div>
</template>
