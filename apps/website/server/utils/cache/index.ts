import { SimpleKeyBuilder, SimpleKeyValidator } from "./constants";

/** The three supported lifetimes, in seconds. */
export const CACHE_TTL = {
  TRENDING: 60 * 60,
  NORMAL: 24 * 60 * 60,
  STABLE: 7 * 24 * 60 * 60,
} as const;

export type CacheTTLPreset = keyof typeof CACHE_TTL | number;
export interface GetOrFetchOptions {
  ttl?: CacheTTLPreset;
  forceRefresh?: boolean;
}

interface InFlightRequest {
  forceRefresh: boolean;
  promise: Promise<void>;
  shouldCache: boolean;
  finish: () => void;
  writePromise?: Promise<boolean>;
}

export interface CacheKv {
  get<T>(key: string, options: { type: "json" }): Promise<T | null>;
  put(key: string, value: string, options: { expirationTtl: number }): Promise<void>;
  delete?(key: string): Promise<void>;
}

const inFlight = new Map<string, InFlightRequest>();

function ttlSeconds(ttl: CacheTTLPreset = "NORMAL"): number {
  return typeof ttl === "number" ? Math.max(60, ttl) : CACHE_TTL[ttl];
}

function isAuthenticationTokenKey(key: string): boolean {
  return /(^|:)auth_token$/i.test(key);
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
        const cached = await kv.get(SimpleKeyValidator.sanitizeKey(key), {
          type: "json",
        });
        if (cached !== null && cached !== undefined) return cached;
      }
    } catch {
      // A KV read failure behaves like a cache miss.
    }
    return null;
  }

  private async set<T>(key: string, data: T, ttl: CacheTTLPreset = "NORMAL"): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const kv = this.kvGetter();
      if (kv) {
        await kv.put(SimpleKeyValidator.sanitizeKey(key), JSON.stringify(data), {
          expirationTtl: ttlSeconds(ttl),
        });
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

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: GetOrFetchOptions = {},
  ): Promise<T> {
    const safeKey = SimpleKeyValidator.sanitizeKey(key);
    const forceRefresh = Boolean(options.forceRefresh) && !isAuthenticationTokenKey(key);
    const inProgress = inFlight.get(safeKey);
    if (inProgress && (!forceRefresh || inProgress.forceRefresh)) {
      await inProgress.promise;
      const cached = await this.get<T>(safeKey);
      return cached !== null ? cached : this.getOrFetch(key, fetcher, options);
    }
    let pendingSupersededWrite: Promise<boolean> | undefined;
    if (forceRefresh && inProgress && !inProgress.forceRefresh) {
      inProgress.shouldCache = false;
      pendingSupersededWrite = inProgress.writePromise;
    }

    const request: InFlightRequest = {
      forceRefresh,
      shouldCache: true,
      promise: Promise.resolve(),
      finish: () => undefined,
    };
    request.promise = new Promise<void>((resolve) => {
      request.finish = resolve;
    });
    inFlight.set(safeKey, request);
    const promise = (async () => {
      if (!forceRefresh) {
        const cached = await this.get<T>(safeKey);
        if (cached !== null) return cached;
      }

      const value = await fetcher();
      if (pendingSupersededWrite) {
        await pendingSupersededWrite.catch(() => false);
      }
      if (value !== null && value !== undefined && request.shouldCache) {
        request.writePromise = this.set(safeKey, value, options.ttl ?? "NORMAL");
        await request.writePromise;
      }
      return value;
    })();

    try {
      return await promise;
    } finally {
      if (inFlight.get(safeKey) === request) inFlight.delete(safeKey);
      request.finish();
    }
  }

  generateKey(api: string, type: string, id: string | number, suffix?: string): string {
    return SimpleKeyBuilder.key(api, type, id, suffix);
  }

  tmdbKey(type: string, id: string | number, suffix?: string): string {
    return SimpleKeyBuilder.tmdb(type, id, suffix);
  }

  tvdbKey(type: string, id: string | number, suffix?: string, language?: string): string {
    return SimpleKeyBuilder.tvdb(type, id, suffix, language);
  }

  wikipediaKey(type: string, id: string, suffix?: string): string {
    return SimpleKeyBuilder.wikipedia(type, id, suffix);
  }
}
