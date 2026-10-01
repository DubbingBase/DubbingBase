import { SimpleKeyBuilder, SimpleKeyValidator } from "./constants";

interface CacheInFlightRequest<T> {
  forceRefresh: boolean;
  writeCache: boolean;
  promise: Promise<T>;
  shouldCache: boolean;
  superseded: boolean;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  writePromise?: Promise<boolean>;
}

/** A stable, typed scope for sharing in-flight requests without type casts. */
export class CacheNamespace<T> {
  private readonly requests = new Map<string, CacheInFlightRequest<T>[]>();

  get(key: string): CacheInFlightRequest<T>[] {
    return this.requests.get(key) ?? [];
  }

  set(key: string, request: CacheInFlightRequest<T>): void {
    this.requests.set(key, [...this.get(key), request]);
  }

  delete(key: string, request: CacheInFlightRequest<T>): void {
    const active = this.get(key).filter(
      (activeRequest) => activeRequest !== request,
    );
    if (active.length) this.requests.set(key, active);
    else this.requests.delete(key);
  }
}

export function createCacheNamespace<T>(): CacheNamespace<T> {
  return new CacheNamespace<T>();
}

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
  /** Persist fetched data to KV; defaults to true. */
  writeCache?: boolean;
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

  /**
   * Returns cached data or fetches it upstream. `forceRefresh` skips KV reads;
   * set `writeCache` to false when the refreshed value must not be persisted.
   */
  getOrFetch<T>(
    namespace: CacheNamespace<T>,
    key: string,
    fetcher: () => Promise<T>,
    options: GetOrFetchOptions = {},
  ): Promise<T> {
    const safeKey = SimpleKeyValidator.sanitizeKey(key);
    const forceRefresh =
      Boolean(options.forceRefresh) && !isAuthenticationTokenKey(key);
    const writeCache = options.writeCache !== false;
    const inProgress = namespace.get(safeKey);
    // Coalesce only when callers agree on whether the fetched value is persisted.
    const coalescedRequest = inProgress.find(
      (request) =>
        request.writeCache === writeCache &&
        (!forceRefresh || request.forceRefresh) &&
        (request.forceRefresh || !request.superseded),
    );
    if (coalescedRequest) return coalescedRequest.promise;

    let pendingSupersededWrites: Promise<boolean>[] = [];
    if (forceRefresh) {
      const supersededRequests = inProgress.filter(
        (request) => !request.forceRefresh,
      );
      for (const request of supersededRequests) {
        request.superseded = true;
        request.shouldCache = false;
      }
      pendingSupersededWrites = supersededRequests.flatMap((request) =>
        request.writePromise ? [request.writePromise] : [],
      );
    }

    let resolvePromise: (value: T) => void = () => undefined;
    let rejectPromise: (reason: unknown) => void = () => undefined;
    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const request: CacheInFlightRequest<T> = {
      forceRefresh,
      writeCache,
      shouldCache: writeCache,
      superseded: false,
      promise,
      resolve: resolvePromise,
      reject: rejectPromise,
    };
    namespace.set(safeKey, request);

    void (async () => {
      try {
        if (!forceRefresh) {
          const cached = await this.get<T>(safeKey);
          if (cached !== null) {
            request.resolve(cached);
            return;
          }
        }

        const value = await fetcher();
        if (pendingSupersededWrites.length) {
          await Promise.all(
            pendingSupersededWrites.map((write) => write.catch(() => false)),
          );
        }
        if (value !== null && value !== undefined && request.shouldCache) {
          request.writePromise = this.set(
            safeKey,
            value,
            options.ttl ?? "NORMAL",
          );
          await request.writePromise;
        }
        request.resolve(value);
      } catch (error) {
        request.reject(error);
      } finally {
        namespace.delete(safeKey, request);
      }
    })();

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
