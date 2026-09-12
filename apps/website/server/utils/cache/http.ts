import type { H3Event } from "h3";

export type CacheProfile =
  "detail" | "catalog" | "discovery" | "search" | "static";

const CACHE_PROFILE_HEADERS: Record<CacheProfile, string> = {
  // Detail media/profile pages: 1h browser, 1d CDN/Edge, 7d stale-while-revalidate
  detail: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  // Catalog listing pages: 1h browser, 1d CDN/Edge, 7d stale-while-revalidate
  catalog:
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  // Discovery, trending, and contributor stats: 30m browser, 1h CDN/Edge, 1d stale-while-revalidate
  discovery:
    "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
  // Dynamic search and autocompletes: 5m browser, 30m CDN/Edge, 1d stale-while-revalidate
  search: "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400",
  // Static assets/lookups: 24h browser, 7d CDN/Edge, 30d stale-while-revalidate
  static:
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
};

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
    setHeader(event, "Cache-Control", "no-store, no-cache, must-revalidate");
    setHeader(event, "Pragma", "no-cache");
    setHeader(event, "Expires", "0");
    return;
  }

  const headerValue =
    CACHE_PROFILE_HEADERS[profile] || CACHE_PROFILE_HEADERS.detail;
  setHeader(event, "Cache-Control", headerValue);
}
