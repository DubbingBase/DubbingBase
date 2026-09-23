import { setHeader, type H3Event } from "h3";

export type CacheProfile =
  "detail" | "catalog" | "discovery" | "search" | "static";

export const NO_STORE_CACHE_CONTROL = "no-store, no-cache, must-revalidate";

export function shouldDisableErrorCaching(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("statusCode" in error) ||
    typeof error.statusCode !== "number"
  ) {
    return true;
  }

  return error.statusCode >= 500;
}

export function setErrorCacheHeaders(event: H3Event, error: unknown): void {
  if (shouldDisableErrorCaching(error)) setNoCacheHeaders(event);
}

const CACHE_PROFILE_HEADERS: Record<CacheProfile, string> = {
  // Mutable detail/catalog/discovery data: 5m browser, 10m edge, 15m stale.
  detail: "public, max-age=300, s-maxage=600, stale-while-revalidate=900",
  catalog: "public, max-age=300, s-maxage=600, stale-while-revalidate=900",
  discovery: "public, max-age=300, s-maxage=600, stale-while-revalidate=900",
  // Dynamic search and autocomplete data: 1m browser, 5m edge, 10m stale.
  search: "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  // Long-lived static lookups/assets are not mutable DubbingBase pages.
  static: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
};

export function getPublicCacheControl(
  profile: CacheProfile = "detail",
): string {
  return CACHE_PROFILE_HEADERS[profile] || CACHE_PROFILE_HEADERS.detail;
}

export function setNoCacheHeaders(event: H3Event): void {
  setHeader(event, "Cache-Control", NO_STORE_CACHE_CONTROL);
  setHeader(event, "Pragma", "no-cache");
  setHeader(event, "Expires", "0");
}

/**
 * Sets no-store headers on the H3 event. Use for cron/queue and other
 * mutation endpoints whose responses must never be served from edge cache.
 */
export function setNoStoreHeaders(event: H3Event): void {
  setHeader(event, "Cache-Control", "no-store, no-cache, must-revalidate");
  setHeader(event, "Pragma", "no-cache");
  setHeader(event, "Expires", "0");
}

/**
 * Sets standardized Edge & Browser SWR Cache-Control headers on the H3 event.
 */
export function setPublicCacheHeaders(
  event: H3Event,
  profile: CacheProfile = "detail",
): void {
  if (import.meta.dev || process.env.NODE_ENV === "development") {
    setNoCacheHeaders(event);
    return;
  }

  setHeader(event, "Cache-Control", getPublicCacheControl(profile));
}
