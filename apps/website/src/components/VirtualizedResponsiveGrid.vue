<script setup lang="ts" generic="T">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  type ComponentPublicInstance,
} from "vue";
import { useWindowSize } from "@vueuse/core";
import { useWindowVirtualizer } from "@tanstack/vue-virtual";

export interface VirtualGridBreakpoint {
  minWidth: number;
  columns: number;
}

const props = withDefaults(
  defineProps<{
    items: readonly T[];
    breakpoints: readonly VirtualGridBreakpoint[];
    estimateRowHeight: number;
    rowClass?: string;
    itemKey?: (item: T, index: number) => string | number;
  }>(),
  {
    rowClass: "grid gap-4",
  },
);

defineSlots<{
  default(props: { item: T; index: number }): unknown;
}>();

const container = ref<HTMLElement | null>(null);
const { width } = useWindowSize();
const scrollMargin = ref(0);

const columnCount = computed(() => {
  const matching = props.breakpoints
    .filter((breakpoint) => width.value >= breakpoint.minWidth)
    .sort((left, right) => left.minWidth - right.minWidth)
    .at(-1);

  return matching?.columns ?? props.breakpoints[0]?.columns ?? 1;
});

const rows = computed(() => {
  const result: T[][] = [];
  const columns = Math.max(1, columnCount.value);

  for (let index = 0; index < props.items.length; index += columns) {
    result.push(props.items.slice(index, index + columns));
  }

  return result;
});

const virtualizer = useWindowVirtualizer<HTMLElement>(
  computed(() => ({
    count: rows.value.length,
    estimateSize: () => props.estimateRowHeight,
    getItemKey: (index) => {
      const item = rows.value[index]?.[0];
      return item === undefined
        ? index
        : (props.itemKey?.(item, index) ?? index);
    },
    overscan: 3,
    scrollMargin: scrollMargin.value,
    initialRect: { width: 1024, height: 800 },
  })),
);

const measureRow = (element: Element | ComponentPublicInstance | null) => {
  if (element instanceof globalThis.HTMLElement) {
    virtualizer.value.measureElement(element);
  }
};

const updateScrollMargin = () => {
  if (container.value) {
    scrollMargin.value = container.value.getBoundingClientRect().top + window.scrollY;
  }
};

onMounted(() => {
  updateScrollMargin();
  window.addEventListener("resize", updateScrollMargin, { passive: true });
});

watch(
  () => [props.items, columnCount.value] as const,
  async () => {
    await nextTick();
    virtualizer.value.measure();
    updateScrollMargin();
  },
  { deep: false },
);

onUnmounted(() => {
  window.removeEventListener("resize", updateScrollMargin);
});
</script>

<template>
  <div ref="container" class="relative w-full" :style="{ height: `${virtualizer.getTotalSize()}px` }">
    <div
      v-for="virtualRow in virtualizer.getVirtualItems()"
      :key="String(virtualRow.key)"
      :data-index="virtualRow.index"
      class="absolute left-0 top-0 w-full"
      :style="{ transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)` }"
      :ref="measureRow"
    >
      <div
        :class="rowClass"
        :style="{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }"
      >
        <template v-for="(item, index) in rows[virtualRow.index]" :key="itemKey?.(item, virtualRow.index * columnCount + index) ?? virtualRow.index * columnCount + index">
          <slot :item="item" :index="virtualRow.index * columnCount + index" />
        </template>
      </div>
    </div>
  </div>
</template>
