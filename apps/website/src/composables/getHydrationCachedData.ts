import { clearNuxtData } from "#app";
import { getCurrentInstance, onBeforeUnmount } from "vue";

interface HydrationPayloadContext<T> {
  isHydrating?: boolean;
  payload: { data: Record<string, T | undefined> };
  runWithContext?: (fn: () => void) => unknown;
}

const cleanupKeysByInstance = new WeakMap<object, Set<string>>();

/** Reuses payload only during hydration and drops shared page data on unmount. */
export function getHydrationCachedData<T>(
  key: string,
  nuxtApp: HydrationPayloadContext<T>,
): T | undefined {
  const instance = getCurrentInstance();
  if (import.meta.client && instance && nuxtApp.runWithContext) {
    let keys = cleanupKeysByInstance.get(instance);
    if (!keys) {
      const cleanupKeys = new Set<string>();
      keys = cleanupKeys;
      cleanupKeysByInstance.set(instance, cleanupKeys);
      onBeforeUnmount(() => {
        nuxtApp.runWithContext?.(() => clearNuxtData([...cleanupKeys]));
        cleanupKeysByInstance.delete(instance);
      });
    }
    keys.add(key);
  }

  return nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined;
}
