import { SimpleKeyBuilder, CACHE_KEYS, SimpleKeyValidator } from "./constants";

// TTL presets in seconds
export const CACHE_TTL = {
  SHORT: 60 * 60, // 1 hour
  MEDIUM: 6 * 60 * 60, // 6 hours
  LONG: 24 * 60 * 60, // 24 hours
  EXTENDED: 7 * 24 * 60 * 60, // 7 days
} as const;

export type CacheTTLPreset = keyof typeof CACHE_TTL | number;

/**
 * Two-tier cache utility:
 * - L1: In-memory Map (ultra-fast 0ms latency per isolate)
 * - L2: Cloudflare KV (persistent across edge isolates globally)
 */
export class SimpleCache {
  private memoryCache = new Map<string, { data: any; expiry: number }>();

  constructor(private kvGetter: () => any) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);

      // 1. Check L1 Memory cache first
      const memoryEntry = this.memoryCache.get(sanitizedKey);
      if (memoryEntry) {
        if (memoryEntry.expiry > Date.now()) {
          return memoryEntry.data as T;
        }
        this.memoryCache.delete(sanitizedKey);
      }

      // 2. Check L2 Cloudflare KV
      const kv = this.kvGetter();
      if (kv && typeof kv.get === "function") {
        try {
          const cached = await kv.get(sanitizedKey, { type: "json" });
          if (cached !== null && cached !== undefined) {
            // Populate L1 cache for fast subsequent lookups in this isolate
            this.memoryCache.set(sanitizedKey, {
              data: cached,
              expiry: Date.now() + CACHE_TTL.SHORT * 1000,
            });
            return cached as T;
          }
        } catch {
          // If JSON parse fails in KV, return null
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  async set<T>(
    key: string,
    data: T,
    ttl: CacheTTLPreset = "MEDIUM",
  ): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const ttlSeconds =
        typeof ttl === "number"
          ? Math.max(60, ttl)
          : (CACHE_TTL[ttl] ?? CACHE_TTL.MEDIUM);

      // 1. Set L1 Memory cache
      this.memoryCache.set(sanitizedKey, {
        data,
        expiry: Date.now() + ttlSeconds * 1000,
      });

      // 2. Set L2 Cloudflare KV
      const kv = this.kvGetter();
      if (kv && typeof kv.put === "function") {
        try {
          await kv.put(sanitizedKey, JSON.stringify(data), {
            expirationTtl: ttlSeconds,
          });
        } catch (kvErr) {
          console.warn("[SimpleCache] KV put error:", kvErr);
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      this.memoryCache.delete(sanitizedKey);

      const kv = this.kvGetter();
      if (kv && typeof kv.delete === "function") {
        try {
          await kv.delete(sanitizedKey);
        } catch (kvErr) {
          console.warn("[SimpleCache] KV delete error:", kvErr);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);

      const memoryEntry = this.memoryCache.get(sanitizedKey);
      if (memoryEntry && memoryEntry.expiry > Date.now()) {
        return true;
      }

      const kv = this.kvGetter();
      if (kv && typeof kv.get === "function") {
        const value = await kv.get(sanitizedKey, { type: "text" });
        return value !== null && value !== undefined;
      }

      return false;
    } catch {
      return false;
    }
  }

  generateKey(
    api: string,
    type: string,
    id: string | number,
    suffix?: string,
  ): string {
    return SimpleKeyBuilder.key(api, type, id, suffix);
  }

  tmdbKey(type: string, id: string | number, suffix?: string): string {
    return SimpleKeyBuilder.tmdb(type, id as any, suffix);
  }

  tvdbKey(type: string, id: string | number, suffix?: string): string {
    return SimpleKeyBuilder.tvdb(type, id, suffix);
  }

  wikipediaKey(type: string, id: string, suffix?: string): string {
    return SimpleKeyBuilder.wikipedia(type, id, suffix);
  }

  appKey(type: string, id: string, suffix?: string): string {
    return SimpleKeyBuilder.app(type, id, suffix);
  }
}
