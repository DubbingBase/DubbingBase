import { ref, computed, watch, type Ref } from "vue";
import { useIntersectionObserver } from "@vueuse/core";

export interface UseProgressiveBatchOptions {
  initialCount?: number;
  batchSize?: number;
  rootMargin?: string;
  resetOn?: Ref<any>;
}

/**
 * Provides progressive DOM windowing for long lists (cast members, media rosters, etc.).
 * Dynamically renders items in batches as the user scrolls towards the sentinel element.
 */
export function useProgressiveBatch<T>(
  items: Ref<T[]>,
  options: UseProgressiveBatchOptions = {},
) {
  const initialCount = options.initialCount ?? 36;
  const batchSize = options.batchSize ?? 36;
  const rootMargin = options.rootMargin ?? "400px";

  const displayedCount = ref(initialCount);
  const loadMoreSentinel = ref<HTMLElement | null>(null);

  const visibleItems = computed(() => {
    return (items.value || []).slice(0, displayedCount.value);
  });

  const hasMore = computed(() => {
    return displayedCount.value < (items.value || []).length;
  });

  const loadMore = () => {
    displayedCount.value += batchSize;
  };

  const reset = () => {
    displayedCount.value = initialCount;
  };

  useIntersectionObserver(
    loadMoreSentinel,
    ([entry]) => {
      if (entry?.isIntersecting && hasMore.value) {
        loadMore();
      }
    },
    { rootMargin },
  );

  if (options.resetOn) {
    watch(options.resetOn, () => {
      reset();
    });
  }

  return {
    displayedCount,
    visibleItems,
    hasMore,
    loadMore,
    reset,
    loadMoreSentinel,
  };
}
