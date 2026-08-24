import { SimpleKeyBuilder, CACHE_KEYS, SimpleKeyValidator } from "./constants";

// TTL presets in seconds
export const CACHE_TTL = {
  SHORT: 60 * 60, // 1 hour
  MEDIUM: 6 * 60 * 60, // 6 hours
  LONG: 24 * 60 * 60, // 24 hours
  EXTENDED: 7 * 24 * 60 * 60, // 7 days
} as const;

export type CacheTTLPreset = keyof typeof CACHE_TTL;

/**
 * KV-backed cache utility with in-memory fallback.
 * Wraps Cloudflare KV bindings via a lazy accessor function.
 */
export class SimpleCache {
  private memoryCache = new Map<string, { data: any; expiry: number }>();

  constructor(private kvGetter: () => any) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const kv = this.kvGetter();
      if (kv && typeof kv.get === "function") {
        const cached = await kv.get(sanitizedKey, { type: "json" });
        if (!cached) return null;
        return cached as T;
      }
      const memoryEntry = this.memoryCache.get(sanitizedKey);
      if (memoryEntry) {
        if (memoryEntry.expiry > Date.now()) {
          return memoryEntry.data as T;
        }
        this.memoryCache.delete(sanitizedKey);
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
      const ttlSeconds = CACHE_TTL[ttl];
      const kv = this.kvGetter();
      if (kv && typeof kv.put === "function") {
        await kv.put(sanitizedKey, JSON.stringify(data), {
          expirationTtl: ttlSeconds,
        });
        return true;
      }
      this.memoryCache.set(sanitizedKey, {
        data,
        expiry: Date.now() + ttlSeconds * 1000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const kv = this.kvGetter();
      if (kv && typeof kv.delete === "function") {
        await kv.delete(sanitizedKey);
      }
      this.memoryCache.delete(sanitizedKey);
      return true;
    } catch {
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const kv = this.kvGetter();
      if (kv && typeof kv.get === "function") {
        const value = await kv.get(sanitizedKey, { type: "text" });
        return value !== null;
      }
      const memoryEntry = this.memoryCache.get(sanitizedKey);
      return !!memoryEntry && memoryEntry.expiry > Date.now();
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
