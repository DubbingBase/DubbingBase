import { SimpleCache } from "../cache";

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

    const cacheKey = "tvdb:auth_token";
    const cached = await this.cache.get<string>(cacheKey);
    if (cached) {
      this.token = cached;
      this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);
      return this.token;
    }

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
    this.token = data.data.token;
    this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000);

    await this.cache.set(cacheKey, this.token, "SHORT");
    return this.token!;
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
  ) {
    const cacheKey = this.cache.tvdbKey(
      "series",
      seriesId,
      extended ? `meta-${extended.meta}` : "basic",
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const params: Record<string, string> = {};
    if (extended?.meta) params.meta = extended.meta;
    if (extended?.short) params.short = "true";

    const result = await this.get(`/series/${seriesId}`, params, language);
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getMovieById(
    movieId: number,
    extended?: { meta?: string; short?: boolean },
    language?: string,
  ) {
    const cacheKey = this.cache.tvdbKey(
      "movie",
      movieId,
      extended ? `meta-${extended.meta}` : "basic",
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const params: Record<string, string> = {};
    if (extended?.meta) params.meta = extended.meta;

    const result = await this.get(`/movies/${movieId}`, params, language);
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getCharacterById(characterId: number) {
    const cacheKey = this.cache.tvdbKey("character", characterId);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(`/characters/${characterId}`);
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getCharactersBySeries(seriesId: number) {
    const cacheKey = this.cache.tvdbKey("series", seriesId, "characters");
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(`/series/${seriesId}/characters`);
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async getCharactersByMovie(movieId: number) {
    const cacheKey = this.cache.tvdbKey("movie", movieId, "characters");
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(`/movies/${movieId}/characters`);
    await this.cache.set(cacheKey, result, "MEDIUM");
    return result;
  }

  async searchSeries(query: string, language?: string) {
    const cacheKey = this.cache.tvdbKey(
      "search",
      query.toLowerCase().replace(/[^a-z0-9]/g, "_"),
    );

    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.get(
      "/search",
      { query, type: "series" },
      language,
    );
    await this.cache.set(cacheKey, result, "SHORT");
    return result;
  }
}
