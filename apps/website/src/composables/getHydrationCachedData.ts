interface HydrationPayloadContext<T> {
  isHydrating?: boolean;
  payload: { data: Record<string, T | undefined> };
}

/** Reuses Nuxt payload data only during the initial client hydration pass. */
export function getHydrationCachedData<T>(
  key: string,
  nuxtApp: HydrationPayloadContext<T>,
): T | undefined {
  return nuxtApp.isHydrating ? nuxtApp.payload.data[key] : undefined;
}
