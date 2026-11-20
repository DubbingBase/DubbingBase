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

interface WorkersEdgeCache {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
}

function isWorkersEdgeCache(value: unknown): value is WorkersEdgeCache {
  return (
    typeof value === "object" &&
    value !== null &&
    "match" in value &&
    typeof value.match === "function" &&
    "put" in value &&
    typeof value.put === "function"
  );
}

function workersDefaultCache(): WorkersEdgeCache | null {
  const storage: unknown = Reflect.get(globalThis, "caches");
  const cache: unknown =
    typeof storage === "object" && storage !== null ? Reflect.get(storage, "default") : null;
  return isWorkersEdgeCache(cache) ? cache : null;
}

/**
 * Edge caching for provider POST queries (IGDB), which `cf.cacheEverything`
 * cannot cache. Uses the Workers Cache API under a synthetic GET key built from
 * the caller's `identity` (never include credentials). Free, per data center,
 * best-effort; a no-op where the Cache API does not exist (dev, tests).
 * Only 2xx responses are stored.
 */
export async function fetchWithEdgePostCache(
  identity: string,
  ttlSeconds: number,
  send: () => Promise<Response>,
): Promise<Response> {
  const cache = workersDefaultCache();
  if (!cache || ttlSeconds <= 0) return send();

  const key = new Request(`https://edge-cache.invalid/${encodeURIComponent(identity)}`);
  try {
    const hit = await cache.match(key);
    if (hit) return hit;
  } catch {
    // A cache read failure behaves like a miss.
  }

  const response = await send();
  if (response.ok) {
    try {
      const stored = new Response(response.clone().body, response);
      stored.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
      await cache.put(key, stored);
    } catch {
      // Not caching is always safe.
    }
  }
  return response;
}
