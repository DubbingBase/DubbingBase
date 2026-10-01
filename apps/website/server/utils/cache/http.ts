import { removeResponseHeader, setHeader, type H3Event } from "h3";

export type CacheProfile = "discovery" | "static";

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

  return error.statusCode >= 400;
}

export function setErrorCacheHeaders(event: H3Event, error: unknown): void {
  if (shouldDisableErrorCaching(error)) setNoCacheHeaders(event);
}

const PUBLIC_CACHE_CONTROL: Record<CacheProfile, string> = {
  discovery: "public, max-age=60, stale-while-revalidate=3600",
  static: "public, max-age=86400, stale-while-revalidate=2592000",
};

const CLOUDFLARE_CACHE_CONTROL: Record<CacheProfile, string> = {
  discovery: "public, max-age=600, stale-while-revalidate=3600",
  static: "public, max-age=604800, stale-while-revalidate=2592000",
};

export function getPublicCacheControl(profile: CacheProfile): string {
  return PUBLIC_CACHE_CONTROL[profile];
}

export function getCloudflareCacheControl(profile: CacheProfile): string {
  return CLOUDFLARE_CACHE_CONTROL[profile];
}

export function setNoCacheHeaders(event: H3Event): void {
  removeResponseHeader(event, "Cloudflare-CDN-Cache-Control");
  setHeader(event, "Cache-Control", NO_STORE_CACHE_CONTROL);
  setHeader(event, "Pragma", "no-cache");
  setHeader(event, "Expires", "0");
}

/**
 * Sets standardized public cache headers on the H3 event.
 */
export function setPublicCacheHeaders(
  event: H3Event,
  profile: CacheProfile,
): void {
  if (import.meta.dev || process.env.NODE_ENV === "development") {
    setNoCacheHeaders(event);
    return;
  }

  removeResponseHeader(event, "Pragma");
  removeResponseHeader(event, "Expires");
  setHeader(event, "Cache-Control", getPublicCacheControl(profile));
  setHeader(
    event,
    "Cloudflare-CDN-Cache-Control",
    getCloudflareCacheControl(profile),
  );
}
