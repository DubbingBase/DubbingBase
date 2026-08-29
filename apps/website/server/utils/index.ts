import { SimpleCache } from "./cache";
import { TMDBClient } from "./api/tmdb";
import { TVDBClient } from "./api/tvdb";
import { IgdbClient } from "./api/igdb";
import { OpenLibraryClient } from "./api/openlibrary";
import { PodcastClient } from "./api/podcast";
import { AdvertisementClient } from "./api/advertisement";
import { ToyClient } from "./api/toy";
import { WikipediaCache } from "./cache/wikipedia";

let _resolvedKv: any = null;
let _cache: SimpleCache | null = null;

export function getCloudflareKv(event?: any): any {
  if (_resolvedKv && typeof _resolvedKv.get === "function") {
    return _resolvedKv;
  }

  // 1. Check passed event context
  if (event?.context?.cloudflare?.env?.CACHE_KV) {
    _resolvedKv = event.context.cloudflare.env.CACHE_KV;
    return _resolvedKv;
  }
  if (event?.context?.env?.CACHE_KV) {
    _resolvedKv = event.context.env.CACHE_KV;
    return _resolvedKv;
  }
  if (event?.context?.CACHE_KV) {
    _resolvedKv = event.context.CACHE_KV;
    return _resolvedKv;
  }

  // 2. Check useEvent() context (Nitro / H3)
  try {
    const currentEvent = useEvent();
    if (currentEvent?.context?.cloudflare?.env?.CACHE_KV) {
      _resolvedKv = currentEvent.context.cloudflare.env.CACHE_KV;
      return _resolvedKv;
    }
    if (currentEvent?.context?.env?.CACHE_KV) {
      _resolvedKv = currentEvent.context.env.CACHE_KV;
      return _resolvedKv;
    }
    if (currentEvent?.context?.CACHE_KV) {
      _resolvedKv = currentEvent.context.CACHE_KV;
      return _resolvedKv;
    }
  } catch {
    // useEvent not available in this scope
  }

  // 3. Check globalThis (Cloudflare workers / global scope)
  if (typeof globalThis !== "undefined") {
    const g = globalThis as any;
    if (g.CACHE_KV && typeof g.CACHE_KV.get === "function") {
      _resolvedKv = g.CACHE_KV;
      return _resolvedKv;
    }
    if (g.__env__?.CACHE_KV && typeof g.__env__.CACHE_KV.get === "function") {
      _resolvedKv = g.__env__.CACHE_KV;
      return _resolvedKv;
    }
    if (g.env?.CACHE_KV && typeof g.env.CACHE_KV.get === "function") {
      _resolvedKv = g.env.CACHE_KV;
      return _resolvedKv;
    }
  }

  // 4. Check process.env (Node / SSR fallback)
  if (typeof process !== "undefined") {
    const p = process as any;
    if (p.env?.CACHE_KV && typeof p.env.CACHE_KV.get === "function") {
      _resolvedKv = p.env.CACHE_KV;
      return _resolvedKv;
    }
  }

  return null;
}

export function useCache(event?: any): SimpleCache {
  if (event) {
    getCloudflareKv(event);
  }
  if (!_cache) {
    _cache = new SimpleCache(() => getCloudflareKv());
  }
  return _cache;
}

export function useTmdbClient(): TMDBClient {
  return new TMDBClient(useCache());
}

export function useTvdbClient(): TVDBClient {
  return new TVDBClient(useCache());
}

export function useIgdbClient(): IgdbClient {
  return new IgdbClient(useCache());
}

export function useOpenLibraryClient(): OpenLibraryClient {
  return new OpenLibraryClient(useCache());
}

export function usePodcastClient(): PodcastClient {
  return new PodcastClient();
}

export function useAdvertisementClient(): AdvertisementClient {
  return new AdvertisementClient();
}

export function useToyClient(): ToyClient {
  return new ToyClient();
}

export function useWikipediaCache(): WikipediaCache {
  return new WikipediaCache(useCache());
}
