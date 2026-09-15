import { SimpleCache } from "../cache";

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

  async get(
    endpoint: string,
    params?: Record<string, string>,
    language?: string,
  ) {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    const preferredLang = (
      (language || "fr-FR").split(",")[0] || "fr-FR"
    ).trim();
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
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = this.cache.tmdbKey(contentType, id, `credits-${langStr}`);

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      debugLog(
        `TMDB cache hit for ${contentType} ${id} with credits (${langStr})`,
      );
      return cached;
    }

    const result = await this.get(
      `${contentType}/${id}`,
      {
        append_to_response: "credits,external_ids",
      },
      language,
    );

    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getSeasonWithCredits(
    seriesId: number,
    seasonNumber: number,
    language?: string,
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = this.cache.tmdbKey(
      "tv",
      seriesId,
      `season:${seasonNumber}:credits-${langStr}`,
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      `tv/${seriesId}/season/${seasonNumber}`,
      {
        append_to_response: "credits,external_ids",
      },
      language,
    );

    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getEpisodeWithCredits(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
    language?: string,
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = this.cache.tmdbKey(
      "tv",
      seriesId,
      `season:${seasonNumber}:episode:${episodeNumber}:credits-${langStr}`,
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      `tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
      { append_to_response: "credits,external_ids" },
      language,
    );

    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async fetchMediaDetails(
    contentId: number,
    contentType: string,
    language?: string,
  ) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = this.cache.tmdbKey(
      contentType,
      contentId,
      `details-${langStr}`,
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      `${contentType}/${contentId}`,
      { append_to_response: "credits,external_ids" },
      language,
    );

    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async fetchMediaCredits(
    mediaType: "movie" | "tv",
    mediaId: number,
    language = "fr-FR",
  ): Promise<{ cast?: unknown[] }> {
    const endpoint = mediaType === "tv" ? "aggregate_credits" : "credits";
    const langStr = (language.split(",")[0] || "fr-FR").trim();
    const cacheKey = this.cache.tmdbKey(
      mediaType,
      mediaId,
      `${endpoint}-${langStr}`,
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      `${mediaType}/${mediaId}/${endpoint}`,
      undefined,
      langStr,
    );
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getPersonWithCredits(personId: number, language?: string) {
    const langStr = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    const cacheKey = this.cache.tmdbKey(
      "person",
      personId,
      `credits-${langStr}`,
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      `person/${personId}`,
      { append_to_response: "tv_credits,movie_credits,external_ids" },
      language,
    );
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getTrending(
    mediaType: "movie" | "tv",
    timeWindow: "day" | "week",
    language = "en-US",
  ) {
    const langStr = (language.split(",")[0] || "en-US").trim();
    const cacheKey = this.cache.tmdbKey(
      "trending",
      mediaType,
      `${timeWindow}-${langStr}`,
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      `trending/${mediaType}/${timeWindow}`,
      undefined,
      language,
    );
    await this.cache.set(cacheKey, result, "SHORT");
    return result;
  }

  async searchMulti(query: string, page = 1, language = "fr-FR") {
    const langStr = (language.split(",")[0] || "fr-FR").trim();
    const cacheKey = this.cache.tmdbKey(
      "search",
      `multi:${query}:${page}`,
      langStr,
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      "search/multi",
      { query, page: String(page) },
      language,
    );
    await this.cache.set(cacheKey, result, "SHORT");
    return result;
  }

  async getCollection(collectionId: number) {
    const cacheKey = this.cache.tmdbKey("collection", collectionId, "details");

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(`collection/${collectionId}`);
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }
}
