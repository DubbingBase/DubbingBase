import { readProperty } from "@app/shared-logic";
import { isRetryableMediaRequestStatus } from "../retryable-request";
import { edgeCache, type EdgeCacheInit } from "../cache/edge";

const TMDB_MAX_RETRY_DELAY_MS = 1000;
const HOUR = 60 * 60;

/**
 * Edge lifetime (seconds) for a TMDB endpoint in Cloudflare's own HTTP cache,
 * or 0 to bypass it. This is not KV: it costs no writes and absorbs repeated
 * identical calls (actor pages, voice-actor fan-out) in the same data center.
 * Searches and trending lists stay uncached.
 */
export function tmdbEdgeCacheTtl(endpoint: string): number {
  if (endpoint.startsWith("search/") || endpoint.startsWith("trending/")) return 0;
  if (endpoint.startsWith("person/")) return 6 * HOUR;
  return 24 * HOUR;
}

function retryDelayMs(response: Response | null): number {
  const retryAfter = Number(response?.headers.get("retry-after"));
  const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 300;
  return Math.min(seconds, TMDB_MAX_RETRY_DELAY_MS);
}
type TmdbResponse = Record<string, unknown> & { cast?: unknown[] };

function isTmdbResponse(value: unknown): value is TmdbResponse {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const cast = readProperty(value, "cast");
  return cast === undefined || Array.isArray(cast);
}

export class TMDBClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    const config = useRuntimeConfig();
    this.apiKey = typeof config.tmdbApiKey === "string" ? config.tmdbApiKey : "";
    this.baseUrl = "https://api.themoviedb.org/3";
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

    const init: RequestInit & EdgeCacheInit = {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        ...(language ? { "Accept-Language": language } : {}),
      },
      ...edgeCache(tmdbEdgeCacheTtl(endpoint)),
    };

    try {
      // One short retry on 429/5xx or a timeout: a rate-limited provider
      // usually answers the next call, and the page-level cache only stores
      // complete results.
      let response: Response | null = null;
      let attempts = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          attempts = attempt + 1;
          response = await fetch(url.toString(), { ...init, signal: AbortSignal.timeout(5000) });
        } catch (e: unknown) {
          if (attempt === 1) throw e;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs(null)));
          continue;
        }
        if (response.ok || !isRetryableMediaRequestStatus(response.status) || attempt === 1) break;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs(response)));
      }
      if (!response) throw new Error(`TMDB API error: no response for ${endpoint}`);

      // One line per edge-cacheable call (sampled by Workers observability), to
      // measure the edge hit rate: group by `cache` (HIT, MISS, EXPIRED, ...).
      if (tmdbEdgeCacheTtl(endpoint) > 0) {
        console.info(
          "[TMDB] edge",
          JSON.stringify({
            kind: endpoint.split("/")[0],
            cache: response.headers.get("cf-cache-status") ?? "none",
            status: response.status,
            attempts,
          }),
        );
      }

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`);
      }

      const data: unknown = await response.json();
      if (!isTmdbResponse(data)) {
        throw new Error(`TMDB API returned an invalid response for ${endpoint}`);
      }
      return data;
    } catch (e: unknown) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
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
    options: { includeExternalIds?: boolean } = {},
  ) {
    return this.get(
      `${contentType}/${id}`,
      {
        append_to_response:
          options.includeExternalIds === false ? "credits" : "credits,external_ids",
      },
      language,
    );
  }

  async getMediaDetails(contentType: "movie" | "tv", id: number, language?: string) {
    return this.get(`${contentType}/${id}`, { append_to_response: "external_ids" }, language);
  }

  async getSeasonWithCredits(seriesId: number, seasonNumber: number, language?: string) {
    return this.get(
      `tv/${seriesId}/season/${seasonNumber}`,
      { append_to_response: "credits,external_ids" },
      language,
    );
  }

  async getSeason(seriesId: number, seasonNumber: number, language?: string) {
    return this.get(`tv/${seriesId}/season/${seasonNumber}`, undefined, language);
  }

  async getEpisodeWithCredits(
    seriesId: number,
    seasonNumber: number,
    episodeNumber: number,
    language?: string,
    options: { includeExternalIds?: boolean } = {},
  ) {
    return this.get(
      `tv/${seriesId}/season/${seasonNumber}/episode/${episodeNumber}`,
      {
        append_to_response:
          options.includeExternalIds === false ? "credits" : "credits,external_ids",
      },
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

  async fetchMediaSummary(contentId: number, contentType: string, language?: string) {
    return this.get(`${contentType}/${contentId}`, undefined, language);
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
