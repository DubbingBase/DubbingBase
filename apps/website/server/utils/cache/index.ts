import { SimpleKeyBuilder, SimpleKeyValidator } from "./constants";

interface CacheInFlightRequest<T> {
  cachePolicy: CachePolicy;
  promise: Promise<T>;
}

/** A stable, typed scope for sharing in-flight requests without type casts. */
export class CacheNamespace<T> {
  private readonly requests = new Map<
    string,
    Map<CachePolicy, CacheInFlightRequest<T>>
  >();

  get(
    key: string,
    cachePolicy: CachePolicy,
  ): CacheInFlightRequest<T> | undefined {
    return this.requests.get(key)?.get(cachePolicy);
  }

  set(key: string, request: CacheInFlightRequest<T>): void {
    const requests =
      this.requests.get(key) ?? new Map<CachePolicy, CacheInFlightRequest<T>>();
    requests.set(request.cachePolicy, request);
    this.requests.set(key, requests);
  }

  delete(key: string, request: CacheInFlightRequest<T>): void {
    const requests = this.requests.get(key);
    if (requests?.get(request.cachePolicy) !== request) return;
    requests.delete(request.cachePolicy);
    if (!requests.size) this.requests.delete(key);
  }
}

export function createCacheNamespace<T>(): CacheNamespace<T> {
  return new CacheNamespace<T>();
}

/** The three supported lifetimes, in seconds. */
export const CACHE_TTL = {
  NORMAL: 24 * 60 * 60,
  STABLE: 7 * 24 * 60 * 60,
} as const;

export type CachePolicy = "persistent" | "read-only" | "none";
export type CacheTTLPreset = keyof typeof CACHE_TTL | number;
export interface GetOrFetchOptions {
  ttl?: CacheTTLPreset;
  /** `persistent` reads and writes KV, `read-only` reads KV, `none` bypasses KV. */
  cachePolicy: CachePolicy;
}

export interface CacheKv {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  put(
    key: string,
    value: string,
    options: { expirationTtl: number },
  ): Promise<void>;
  delete?(key: string): Promise<void>;
}

function ttlSeconds(ttl: CacheTTLPreset = "NORMAL"): number {
  return typeof ttl === "number" ? Math.max(60, ttl) : CACHE_TTL[ttl];
}

/** Cloudflare KV adapter for external API responses; it has no local data tier. */
export class SimpleCache {
  private get enabled(): boolean {
    return !(
      import.meta.dev ||
      (typeof process !== "undefined" && process.env.NODE_ENV === "development")
    );
  }

  constructor(private readonly kvGetter: () => CacheKv | null) {}

  private async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;
    try {
      const kv = this.kvGetter();
      if (kv) {
        const cached = await kv.get<T>(SimpleKeyValidator.sanitizeKey(key), {
          type: "json",
        });
        if (cached !== null && cached !== undefined) return cached;
      }
    } catch {
      // A KV read failure behaves like a cache miss.
    }
    return null;
  }

  /** Persists a fetched value to KV using the selected expiration lifetime. */
  private async set<T>(
    key: string,
    data: T,
    ttl: CacheTTLPreset = "NORMAL",
  ): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const kv = this.kvGetter();
      if (kv) {
        await kv.put(
          SimpleKeyValidator.sanitizeKey(key),
          JSON.stringify(data),
          {
            expirationTtl: ttlSeconds(ttl),
          },
        );
        return true;
      }
    } catch (kvErr) {
      console.warn("[SimpleCache] KV put error:", kvErr);
    }
    return false;
  }

  async del(key: string): Promise<boolean> {
    if (!this.enabled) return true;
    try {
      const kv = this.kvGetter();
      if (kv?.delete) {
        await kv.delete(SimpleKeyValidator.sanitizeKey(key));
      }
      return true;
    } catch {
      return false;
    }
  }

  /** Returns cached data or fetches it upstream according to one policy. */
  getOrFetch<T>(
    namespace: CacheNamespace<T>,
    key: string,
    fetcher: () => Promise<T>,
    options: GetOrFetchOptions,
  ): Promise<T> {
    const safeKey = SimpleKeyValidator.sanitizeKey(key);
    const cachePolicy = options.cachePolicy;
    const existingRequest = namespace.get(safeKey, cachePolicy);
    if (existingRequest) return existingRequest.promise;

    const promise = Promise.resolve().then(async () => {
      if (cachePolicy !== "none") {
        const cached = await this.get<T>(safeKey);
        if (cached !== null) return cached;
      }

      const value = await fetcher();
      if (
        cachePolicy === "persistent" &&
        value !== null &&
        value !== undefined
      ) {
        await this.set(safeKey, value, options.ttl ?? "NORMAL");
      }
      return value;
    });
    const request = { cachePolicy, promise };
    namespace.set(safeKey, request);
    void promise.then(
      () => namespace.delete(safeKey, request),
      () => namespace.delete(safeKey, request),
    );
    return promise;
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

  tvdbKey(
    type: string,
    id: string | number,
    suffix?: string,
    language?: string,
  ): string {
    return SimpleKeyBuilder.tvdb(type, id, suffix, language);
  }

  wikipediaKey(type: string, id: string, suffix?: string): string {
    return SimpleKeyBuilder.wikipedia(type, id, suffix);
  }
}
