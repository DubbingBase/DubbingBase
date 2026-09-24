import { SimpleCache } from "../cache";
import { buildCacheKey } from "../cache/constants";
import type { CacheFetchOptions } from "./cache-options";

function debugLog(message: string, data?: any) {
  console.log(`[TMDB] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

export class TMDBClient {
  private apiKey: string;
  private baseUrl: string;
  private cache: SimpleCache;

  constructor(cache: SimpleCache) {
    const config = useRuntimeConfig();
    this.apiKey = (config.tmdbApiKey as string) || "";
    this.baseUrl = "https://api.themoviedb.org/3";
    this.cache = cache;
    debugLog("TMDB Client initialized", {
      hasApiKey: !!this.apiKey,
      baseUrl: this.baseUrl,
    });
  }

  async get(endpoint: string, params?: Record<string, string>, language?: string) {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    const preferredLang = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    url.searchParams.set("language", preferredLang);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(language ? { "Accept-Language": language } : {}),
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      return await response.json();
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        console.warn(`[TMDB] Request timed out for ${endpoint}`);
        throw new Error(`TMDB API timeout: ${endpoint}`);
      }
      throw e;
    }
  }

  async getMediaWithCredits(
    contentType: "movie" | "tv",
    id: number,
    language?: string,
    options: CacheFetchOptions = {},
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: contentType,
      id,
      language: langStr,
      params: { append_to_response: "credits,external_ids" },
    });

    return this.cache.getOrFetch(
      cacheKey,
      () =>
        this.get(`${contentType}/${id}`, { append_to_response: "credits,external_ids" }, language),
      { ttl: 86400, ...options },
    );
  }

  async getSeasonWithCredits(
    seriesId: number,
    seasonNumber: number,
    language?: string,
    options: CacheFetchOptions = {},
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: "season",
      id: seriesId,
      language: langStr,
      params: {
        season: seasonNumber,
        append_to_response: "credits,external_ids",
      },
    });

    return this.cache.getOrFetch(
      cacheKey,
      () =>
        this.get(
          `tv/${seriesId}/season/${seasonNumber}`,
          { append_to_response: "credits,external_ids" },
          language,
        ),
      { ttl: 86400, ...options },
    );
  }

  async getEpisodeWithCredits(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
    language?: string,
    options: CacheFetchOptions = {},
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: "episode",
      id: seriesId,
      language: langStr,
      params: {
        season: seasonNumber,
        episode: episodeNumber,
        append_to_response: "credits,external_ids",
      },
    });

    return this.cache.getOrFetch(
      cacheKey,
      () =>
        this.get(
          `tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
          { append_to_response: "credits,external_ids" },
          language,
        ),
      { ttl: 86400, ...options },
    );
  }

  async fetchMediaDetails(
    contentId: number,
    contentType: string,
    language?: string,
    options: CacheFetchOptions = {},
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: contentType,
      id: contentId,
      language: langStr,
      params: { append_to_response: "credits,external_ids" },
    });

    return this.cache.getOrFetch(
      cacheKey,
      () =>
        this.get(
          `${contentType}/${contentId}`,
          { append_to_response: "credits,external_ids" },
          language,
        ),
      { ttl: 86400, ...options },
    );
  }

  async fetchMediaCredits(
    mediaType: "movie" | "tv",
    mediaId: number,
    language = "fr-FR",
    options: CacheFetchOptions = {},
  ): Promise<{ cast?: unknown[] }> {
    const endpoint = mediaType === "tv" ? "aggregate_credits" : "credits";
    const langStr = (language.split(",")[0] || "fr-FR").trim();
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: mediaType,
      id: mediaId,
      language: langStr,
      params: { endpoint },
    });

    return this.cache.getOrFetch(
      cacheKey,
      () => this.get(`${mediaType}/${mediaId}/${endpoint}`, undefined, langStr),
      { ttl: 86400, ...options },
    );
  }

  async getPersonWithCredits(personId: number, language?: string, options: CacheFetchOptions = {}) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: "person",
      id: personId,
      language: langStr,
      params: { append_to_response: "tv_credits,movie_credits,external_ids" },
    });

    return this.cache.getOrFetch(
      cacheKey,
      () =>
        this.get(
          `person/${personId}`,
          { append_to_response: "tv_credits,movie_credits,external_ids" },
          language,
        ),
      { ttl: 86400, ...options },
    );
  }

  async getTrending(
    mediaType: "movie" | "tv",
    timeWindow: "day" | "week",
    language = "en-US",
    options: CacheFetchOptions = {},
  ) {
    const langStr = (language.split(",")[0] || "en-US").trim();
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: "trending",
      id: mediaType,
      language: langStr,
      params: { timeWindow },
    });

    return this.cache.getOrFetch(
      cacheKey,
      () => this.get(`trending/${mediaType}/${timeWindow}`, undefined, language),
      { ttl: 3600, ...options },
    );
  }

  async searchMulti(query: string, page = 1, language = "fr-FR") {
    return this.get("search/multi", { query, page: String(page) }, language);
  }

  async getCollection(collectionId: number) {
    const cacheKey = buildCacheKey({
      provider: "tmdb",
      resource: "collection",
      id: collectionId,
      params: { endpoint: "details" },
    });

    return this.cache.getOrFetch(cacheKey, () => this.get(`collection/${collectionId}`), {
      ttl: 86400,
    });
  }
}
