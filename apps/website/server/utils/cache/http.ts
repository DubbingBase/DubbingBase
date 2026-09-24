import { removeResponseHeader, setHeader, type H3Event } from "h3";

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

const PUBLIC_CACHE_CONTROL = "public, max-age=300, s-maxage=300";
const STATIC_CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

export function getPublicCacheControl(
  profile: CacheProfile = "detail",
): string {
  return profile === "static" ? STATIC_CACHE_CONTROL : PUBLIC_CACHE_CONTROL;
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
  setNoCacheHeaders(event);
}

/**
 * Sets standardized public cache headers on the H3 event.
 */
export function setPublicCacheHeaders(
  event: H3Event,
  profile: CacheProfile = "detail",
): void {
  if (import.meta.dev || process.env.NODE_ENV === "development") {
    setNoCacheHeaders(event);
    return;
  }

  removeResponseHeader(event, "Pragma");
  removeResponseHeader(event, "Expires");
  setHeader(event, "Cache-Control", getPublicCacheControl(profile));
}
