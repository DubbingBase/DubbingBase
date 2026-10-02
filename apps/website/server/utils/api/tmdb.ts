type TmdbResponse = Record<string, unknown> & { cast?: unknown[] };
import { observeProviderRequest } from "../retryable-request";

function isTmdbResponse(value: unknown): value is TmdbResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cast = Reflect.get(value, "cast");
  return cast === undefined || Array.isArray(cast);
}

function debugLog(message: string, data?: any) {
  console.log(`[TMDB] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

export class TMDBClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const config = useRuntimeConfig();
    this.apiKey = (config.tmdbApiKey as string) || "";
    this.baseUrl = "https://api.themoviedb.org/3";
    debugLog("TMDB Client initialized", {
      hasApiKey: !!this.apiKey,
      baseUrl: this.baseUrl,
    });
  }

  async get(
    endpoint: string,
    params?: Record<string, string>,
    language?: string,
  ): Promise<TmdbResponse> {
    const url = new URL(`${this.baseUrl}/${endpoint}`);
    const preferredLang = ((language || "fr-FR").split(",")[0] || "fr-FR").trim();
    url.searchParams.set("language", preferredLang);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    try {
      const response = await observeProviderRequest("tmdb", () =>
        fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
            ...(language ? { "Accept-Language": language } : {}),
          },
          signal: AbortSignal.timeout(5000),
        }),
      );

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const data: unknown = await response.json();
      if (!isTmdbResponse(data)) {
        throw new Error(`TMDB API returned an invalid response for ${endpoint}`);
      }
      return data;
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        console.warn(`[TMDB] Request timed out for ${endpoint}`);
        throw new Error(`TMDB API timeout: ${endpoint}`);
      }
      throw e;
    }
  }

  async getMediaWithCredits(contentType: "movie" | "tv", id: number, language?: string) {
    return this.get(
      `${contentType}/${id}`,
      { append_to_response: "credits,external_ids" },
      language,
    );
  }

  async getSeasonWithCredits(seriesId: number, seasonNumber: number, language?: string) {
    return this.get(
      `tv/${seriesId}/season/${seasonNumber}`,
      { append_to_response: "credits,external_ids" },
      language,
    );
  }

  async getEpisodeWithCredits(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
    language?: string,
  ) {
    return this.get(
      `tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
      { append_to_response: "credits,external_ids" },
      language,
    );
  }

  async fetchMediaDetails(contentId: number, contentType: string, language?: string) {
    return this.get(
      `${contentType}/${contentId}`,
      { append_to_response: "credits,external_ids" },
      language,
    );
  }

  async fetchMediaCredits(
    mediaType: "movie" | "tv",
    mediaId: number,
    language = "fr-FR",
  ): Promise<{ cast?: unknown[] }> {
    const endpoint = mediaType === "tv" ? "aggregate_credits" : "credits";
    const langStr = (language.split(",")[0] || "fr-FR").trim();
    return this.get(`${mediaType}/${mediaId}/${endpoint}`, undefined, langStr);
  }

  async getPersonWithCredits(personId: number, language?: string) {
    return this.get(
      `person/${personId}`,
      { append_to_response: "tv_credits,movie_credits,external_ids" },
      language,
    );
  }

  async getTrending(mediaType: "movie" | "tv", timeWindow: "day" | "week", language = "en-US") {
    return this.get(`trending/${mediaType}/${timeWindow}`, undefined, language);
  }

  async searchMulti(query: string, page = 1, language = "fr-FR") {
    return this.get("search/multi", { query, page: String(page) }, language);
  }

  async getCollection(collectionId: number) {
    return this.get(`collection/${collectionId}`);
  }
}
