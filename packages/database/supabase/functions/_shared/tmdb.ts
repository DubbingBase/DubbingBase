import { ITMDBClient } from "./interfaces.ts";
import { SimpleCache } from "./cache-utils.ts";

// Debug logging function
function debugLog(message: string, data?: any) {
  console.log(`[TMDB] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

export class TMDBClient implements ITMDBClient {
  private apiKey: string;
  private baseUrl: string;
  private cache: SimpleCache;

  constructor(cache: SimpleCache) {
    this.apiKey = Deno.env.get("TMDB_API_KEY")!;
    this.baseUrl = "https://api.themoviedb.org/3";
    this.cache = cache;
    debugLog("TMDB Client initialized", {
      hasApiKey: !!this.apiKey,
      baseUrl: this.baseUrl,
      hasCache: true,
    });
  }

  async get(endpoint: string, params?: Record<string, string>) {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    url.searchParams.set("language", "fr-FR");

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
        },
        signal: AbortSignal.timeout(5000), // 5 seconds timeout
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
  ) {
    const langStr = language || "fr-FR";
    const cacheKey = this.cache.tmdbKey(contentType, id, `credits-${langStr}`);

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(
        `TMDB cache hit for ${contentType} ${id} with credits (${langStr})`,
      );
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get(`${contentType}/${id}`, {
      append_to_response: "credits,external_ids",
      ...(language ? { language } : {}),
    });

    // Cache the result with MEDIUM TTL (6 hours for media data)
    await this.cache.set(cacheKey, result, "MEDIUM");
    debugLog(
      `TMDB cache set for ${contentType} ${id} with credits (${langStr})`,
    );

    return result;
  }

  async getSeasonWithCredits(seriesId: number, seasonNumber: number) {
    const cacheKey = this.cache.tmdbKey(
      "tv",
      seriesId,
      `season:${seasonNumber}:credits`,
    );

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(
        `TMDB cache hit for series ${seriesId} season ${seasonNumber} with credits`,
      );
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get(`tv/${seriesId}/season/${seasonNumber}`, {
      append_to_response: "credits,external_ids",
    });

    // Cache the result with MEDIUM TTL (6 hours for season data)
    await this.cache.set(cacheKey, result, "MEDIUM");
    debugLog(
      `TMDB cache set for series ${seriesId} season ${seasonNumber} with credits`,
    );

    return result;
  }

  async getEpisodeWithCredits(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
  ) {
    const cacheKey = this.cache.tmdbKey(
      "tv",
      seriesId,
      `season:${seasonNumber}:episode:${episodeNumber}:credits`,
    );

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(
        `TMDB cache hit for series ${seriesId} S${seasonNumber}E${episodeNumber} with credits`,
      );
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get(
      `tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
      {
        append_to_response: "credits,external_ids",
      },
    );

    // Cache the result with MEDIUM TTL (6 hours for episode data)
    await this.cache.set(cacheKey, result, "MEDIUM");
    debugLog(
      `TMDB cache set for series ${seriesId} S${seasonNumber}E${episodeNumber} with credits`,
    );

    return result;
  }

  async fetchMediaDetails(contentId: number, contentType: string) {
    const cacheKey = this.cache.tmdbKey(contentType, contentId, "details");

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(`TMDB cache hit for ${contentType} ${contentId} details`);
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get(`${contentType}/${contentId}`, {
      append_to_response: "credits,external_ids",
    });

    // Cache the result with MEDIUM TTL (6 hours for media details)
    await this.cache.set(cacheKey, result, "MEDIUM");
    debugLog(`TMDB cache set for ${contentType} ${contentId} details`);

    return result;
  }

  async fetchMediaCredits(mediaType: string, mediaId: number) {
    return await this.get(`${mediaType}/${mediaId}/credits`);
  }

  async getCollection(collectionId: number) {
    const cacheKey = this.cache.tmdbKey("collection", collectionId, "details");

    // Try cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(`TMDB cache hit for collection ${collectionId}`);
      return cached;
    }

    // Cache miss - fetch from API
    const result = await this.get(`collection/${collectionId}`);

    // Cache the result with MEDIUM TTL (6 hours for media details)
    await this.cache.set(cacheKey, result, "MEDIUM");
    debugLog(`TMDB cache set for collection ${collectionId}`);

    return result;
  }
}
