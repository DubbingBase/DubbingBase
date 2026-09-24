import { createCacheNamespace, SimpleCache } from "../cache";
import type { CacheFetchOptions } from "./cache-options";

type TvdbApiResponse = Awaited<ReturnType<TVDBClient["get"]>>;

export const TVDB_AUTH_TOKEN_NAMESPACE = createCacheNamespace<string>();
export const TVDB_API_RESPONSE_NAMESPACE =
  createCacheNamespace<TvdbApiResponse>();

function debugLog(message: string, data?: any) {
  console.log(`[TVDB] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

export class TVDBClient {
  private apiKey: string;
  private baseUrl: string;
  private cache: SimpleCache;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(cache: SimpleCache) {
    const config = useRuntimeConfig();
    this.apiKey = (config.tvdbApiKey as string) || "";
    this.baseUrl = "https://api.thetvdb.com/v4";
    this.cache = cache;
    debugLog("TVDB Client initialized", { hasApiKey: !!this.apiKey });
  }

  private async authenticate(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    const token = await this.cache.getOrFetch(
      TVDB_AUTH_TOKEN_NAMESPACE,
      "tvdb:auth_token",
      async () => {
        const response = await fetch(`${this.baseUrl}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apikey: this.apiKey }),
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`TVDB auth failed: ${response.status}`);
        }

        const data = await response.json();
        return data.data.token as string;
      },
      { ttl: 23 * 60 * 60 },
    );
    this.token = token;
    this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
    return token;
  }

  async get(
    endpoint: string,
    params?: Record<string, string>,
    language?: string,
  ) {
    const token = await this.authenticate();
    const url = new URL(`${this.baseUrl}${endpoint}`);

    if (language) {
      url.searchParams.set("lang", (language.split(",")[0] || "fr-FR").trim());
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        throw new Error(`TVDB API error: ${response.status}`);
      }

      return await response.json();
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        throw new Error(`TVDB API timeout: ${endpoint}`);
      }
      throw e;
    }
  }

  async getSeriesById(
    seriesId: number,
    extended?: { meta?: string; short?: boolean },
    language?: string,
    options: CacheFetchOptions = {},
  ) {
    const normalizedLanguage = language
      ? (language.split(",")[0] || "en").trim()
      : "default";
    const suffix = extended
      ? `meta-${extended.meta ?? "default"}-${extended.short ? "short" : "full"}`
      : "basic";
    const cacheKey = this.cache.tvdbKey(
      "series",
      seriesId,
      suffix,
      normalizedLanguage,
    );
    const params: Record<string, string> = {};
    if (extended?.meta) params.meta = extended.meta;
    if (extended?.short) params.short = "true";
    return this.cache.getOrFetch(
      TVDB_API_RESPONSE_NAMESPACE,
      cacheKey,
      () => this.get(`/series/${seriesId}`, params, language),
      { ttl: 86400, ...options },
    );
  }

  async getMovieById(
    movieId: number,
    extended?: { meta?: string; short?: boolean },
    language?: string,
    options: CacheFetchOptions = {},
  ) {
    const normalizedLanguage = language
      ? (language.split(",")[0] || "en").trim()
      : "default";
    const suffix = extended
      ? `meta-${extended.meta ?? "default"}-${extended.short ? "short" : "full"}`
      : "basic";
    const cacheKey = this.cache.tvdbKey(
      "movie",
      movieId,
      suffix,
      normalizedLanguage,
    );
    const params: Record<string, string> = {};
    if (extended?.meta) params.meta = extended.meta;
    return this.cache.getOrFetch(
      TVDB_API_RESPONSE_NAMESPACE,
      cacheKey,
      () => this.get(`/movies/${movieId}`, params, language),
      {
        ttl: 86400,
        ...options,
      },
    );
  }

  async getCharacterById(characterId: number, options: CacheFetchOptions = {}) {
    const cacheKey = this.cache.tvdbKey("character", characterId);
    return this.cache.getOrFetch(
      TVDB_API_RESPONSE_NAMESPACE,
      cacheKey,
      () => this.get(`/characters/${characterId}`),
      {
        ttl: 86400,
        ...options,
      },
    );
  }

  async getCharactersBySeries(
    seriesId: number,
    options: CacheFetchOptions = {},
  ) {
    const cacheKey = this.cache.tvdbKey("series", seriesId, "characters");
    return this.cache.getOrFetch(
      TVDB_API_RESPONSE_NAMESPACE,
      cacheKey,
      () => this.get(`/series/${seriesId}/characters`),
      {
        ttl: 86400,
        ...options,
      },
    );
  }

  async getCharactersByMovie(movieId: number, options: CacheFetchOptions = {}) {
    const cacheKey = this.cache.tvdbKey("movie", movieId, "characters");
    return this.cache.getOrFetch(
      TVDB_API_RESPONSE_NAMESPACE,
      cacheKey,
      () => this.get(`/movies/${movieId}/characters`),
      {
        ttl: 86400,
        ...options,
      },
    );
  }

  async searchSeries(query: string, language?: string) {
    return this.get("/search", { query, type: "series" }, language);
  }
}
