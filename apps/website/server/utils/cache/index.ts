import { SimpleKeyBuilder, SimpleKeyValidator } from "./constants";

// TTL presets in seconds. These values are used for external API data in KV;
// mutable DubbingBase data is always read from Supabase.
export const CACHE_TTL = {
  SHORT: 60 * 60, // 1 hour
  MEDIUM: 6 * 60 * 60, // 6 hours
  LONG: 24 * 60 * 60, // 24 hours
  EXTENDED: 7 * 24 * 60 * 60, // 7 days
} as const;

export type CacheTTLPreset = keyof typeof CACHE_TTL | number;

/** Cloudflare KV cache utility for external API responses. */
export class SimpleCache {
  private get enabled(): boolean {
    return !(
      import.meta.dev ||
      (typeof process !== "undefined" && process.env.NODE_ENV === "development")
    );
  }

  constructor(private kvGetter: () => any) {}

  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);

      const kv = this.kvGetter();
      if (kv && typeof kv.get === "function") {
        try {
          const cached = await kv.get(sanitizedKey, { type: "json" });
          if (cached !== null && cached !== undefined) {
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
    if (!this.enabled) return false;

    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
      const ttlSeconds =
        typeof ttl === "number"
          ? Math.max(60, ttl)
          : (CACHE_TTL[ttl] ?? CACHE_TTL.MEDIUM);

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
    if (!this.enabled) return true;

    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);
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
    if (!this.enabled) return false;

    try {
      const sanitizedKey = SimpleKeyValidator.sanitizeKey(key);

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
    return SimpleKeyBuilder.tmdb(type, id, suffix);
  }

  tvdbKey(type: string, id: string | number, suffix?: string): string {
    return SimpleKeyBuilder.tvdb(type, id, suffix);
  }

  wikipediaKey(type: string, id: string, suffix?: string): string {
    return SimpleKeyBuilder.wikipedia(type, id, suffix);
  }
}

/**
 * Read-through-bypass cache for cron/queue work: reads always miss (fresh
 * upstream fetch) while writes still warm the shared tiers for public pages.
 */
export class FreshCache extends SimpleCache {
  override async get<T>(): Promise<T | null> {
    return null;
  }
}
