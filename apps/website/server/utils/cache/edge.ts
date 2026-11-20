/**
 * Cloudflare edge-cache options for an outbound provider `fetch`.
 *
 * This is the first persistence layer for raw provider responses: it is free
 * (no KV writes), per data center, best-effort, and cannot be purged by key.
 * Use KV only for small derived results that are costly to rebuild.
 * `cf` is a Workers-only fetch option; other runtimes ignore it. Only 2xx
 * responses are kept for `ttl`; a 404 lives briefly and 5xx never.
 */
export type EdgeCacheInit = { cf?: Record<string, unknown> };

export function edgeCache(ttlSeconds: number): EdgeCacheInit {
  if (ttlSeconds <= 0) return {};
  return {
    cf: {
      cacheEverything: true,
      cacheTtlByStatus: { "200-299": ttlSeconds, "404": 60, "500-599": 0 },
    },
  };
}
