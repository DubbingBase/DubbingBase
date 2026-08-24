import { SimpleCache } from "./cache";
import { TMDBClient } from "./api/tmdb";
import { TVDBClient } from "./api/tvdb";
import { IgdbClient } from "./api/igdb";
import { WikipediaCache } from "./cache/wikipedia";

let _cache: SimpleCache | null = null;

export function useCache(): SimpleCache {
  if (!_cache) {
    _cache = new SimpleCache(() => {
      try {
        const event = useEvent();
        if (event?.context?.cloudflare?.env?.CACHE_KV) {
          return event.context.cloudflare.env.CACHE_KV;
        }
      } catch {
        // useEvent not available in non-event context
      }
      if (typeof globalThis !== "undefined" && (globalThis as any).CACHE_KV) {
        return (globalThis as any).CACHE_KV;
      }
      return null;
    });
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

export function useWikipediaCache(): WikipediaCache {
  return new WikipediaCache(useCache());
}
