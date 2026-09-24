import {
  SimpleCache,
  type CacheNamespace,
  type CacheTTLPreset,
  type CacheKv,
} from "./cache";
import { TMDBClient } from "./api/tmdb";
import { TVDBClient } from "./api/tvdb";
import { IgdbClient } from "./api/igdb";
import { OpenLibraryClient } from "./api/openlibrary";
import { PodcastClient } from "./api/podcast";
import { AdvertisementClient } from "./api/advertisement";
import { ToyClient } from "./api/toy";
import { WikipediaCache } from "./cache/wikipedia";

let _resolvedKv: CacheKv | null = null;
let _cache: SimpleCache | null = null;

function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

function readPath(value: unknown, ...keys: string[]): unknown {
  let current = value;
  for (const key of keys) current = readProperty(current, key);
  return current;
}

function isCacheKv(value: unknown): value is CacheKv {
  return (
    typeof readProperty(value, "get") === "function" &&
    typeof readProperty(value, "put") === "function"
  );
}

function findCacheKv(...values: unknown[]): CacheKv | null {
  for (const value of values) {
    if (isCacheKv(value)) return value;
  }
  return null;
}

export function getCloudflareKv(event?: unknown): CacheKv | null {
  if (_resolvedKv) return _resolvedKv;

  const eventContext = readPath(event, "context");
  const candidates = [
    readPath(eventContext, "cloudflare", "env", "CACHE_KV"),
    readPath(eventContext, "env", "CACHE_KV"),
    readPath(eventContext, "CACHE_KV"),
  ];

  // Check useEvent() context (Nitro / H3).
  try {
    const currentContext = readPath(useEvent(), "context");
    candidates.push(
      readPath(currentContext, "cloudflare", "env", "CACHE_KV"),
      readPath(currentContext, "env", "CACHE_KV"),
      readPath(currentContext, "CACHE_KV"),
    );
  } catch {
    // useEvent not available in this scope.
  }

  // Check worker globals, then the Node SSR fallback.
  candidates.push(
    readPath(globalThis, "CACHE_KV"),
    readPath(globalThis, "__env__", "CACHE_KV"),
    readPath(globalThis, "env", "CACHE_KV"),
  );
  if (typeof process !== "undefined") {
    candidates.push(readPath(process, "env", "CACHE_KV"));
  }

  _resolvedKv = findCacheKv(...candidates);
  return _resolvedKv;
}

export function useCache(event?: unknown): SimpleCache {
  if (event) {
    getCloudflareKv(event);
  }
  if (!_cache) {
    _cache = new SimpleCache(() => getCloudflareKv());
  }
  return _cache;
}

export function getOrFetch<T>(
  namespace: CacheNamespace<T>,
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: CacheTTLPreset; forceRefresh?: boolean },
): Promise<T> {
  return useCache().getOrFetch(namespace, key, fetcher, options);
}

export function useTmdbClient(cache?: SimpleCache): TMDBClient {
  return new TMDBClient(cache ?? useCache());
}

export function useTvdbClient(): TVDBClient {
  return new TVDBClient(useCache());
}

export function useIgdbClient(cache?: SimpleCache): IgdbClient {
  return new IgdbClient(cache ?? useCache());
}

export function useOpenLibraryClient(): OpenLibraryClient {
  return new OpenLibraryClient(useCache());
}

export function usePodcastClient(): PodcastClient {
  return new PodcastClient(useCache());
}

export function useAdvertisementClient(): AdvertisementClient {
  return new AdvertisementClient();
}

export function useToyClient(): ToyClient {
  return new ToyClient();
}

export function useWikipediaCache(cache?: SimpleCache): WikipediaCache {
  return new WikipediaCache(cache ?? useCache());
}
