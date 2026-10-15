import { createCacheNamespace, SimpleCache } from "../cache";

export const TVDB_AUTH_TOKEN_NAMESPACE = createCacheNamespace<string>();

const AUTH_TOKEN_TTL = 23 * 60 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function debugLog(message: string, data?: unknown) {
  console.log(`[TVDB] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

export class TVDBClient {
  private apiKey: string;
  private baseUrl: string;
  private cache: SimpleCache;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private tokenNeedsPersistence = false;
  private tokenWritePromise: Promise<void> | null = null;

  constructor(cache: SimpleCache) {
    const config = useRuntimeConfig();
    this.apiKey = config.tvdbApiKey || "";
    this.baseUrl = "https://api4.thetvdb.com/v4";
    this.cache = cache;
    debugLog("TVDB Client initialized", { hasApiKey: !!this.apiKey });
  }

  private async authenticate(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    this.tokenNeedsPersistence = false;
    const token = await this.cache.getOrFetch(
      TVDB_AUTH_TOKEN_NAMESPACE,
      "tvdb:auth_token",
      async () => {
        const token = await this.login();
        this.tokenNeedsPersistence = true;
        return token;
      },
      { cachePolicy: "read-only" },
    );
    this.token = token;
    this.tokenExpiry = new Date(Date.now() + AUTH_TOKEN_TTL * 1000);
    return token;
  }

  private async login(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apikey: this.apiKey }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`TVDB auth failed: ${response.status}`);
    }

    const data: unknown = await response.json();
    if (
      !isRecord(data) ||
      !isRecord(data.data) ||
      typeof data.data.token !== "string" ||
      !data.data.token
    ) {
      throw new Error("TVDB auth response did not contain a token");
    }
    return data.data.token;
  }

  private async refreshRejectedToken(rejectedToken: string): Promise<string> {
    if (
      this.token &&
      this.token !== rejectedToken &&
      this.tokenExpiry &&
      new Date() < this.tokenExpiry
    ) {
      return this.token;
    }

    this.token = null;
    this.tokenExpiry = null;
    this.tokenNeedsPersistence = false;

    const token = await this.cache.getOrFetch(
      TVDB_AUTH_TOKEN_NAMESPACE,
      "tvdb:auth_token",
      () => this.login(),
      { cachePolicy: "none" },
    );
    this.token = token;
    this.tokenExpiry = new Date(Date.now() + AUTH_TOKEN_TTL * 1000);
    this.tokenNeedsPersistence = true;
    return token;
  }

  private async persistAuthenticatedToken(token: string): Promise<void> {
    while (this.tokenWritePromise) await this.tokenWritePromise;
    if (!this.tokenNeedsPersistence || this.token !== token) return;

    let writePromise: Promise<void>;
    writePromise = this.cache
      .set("tvdb:auth_token", token, AUTH_TOKEN_TTL)
      .then(() => {
        if (this.token === token) this.tokenNeedsPersistence = false;
      })
      .finally(() => {
        if (this.tokenWritePromise === writePromise) this.tokenWritePromise = null;
      });
    this.tokenWritePromise = writePromise;
    await writePromise;
  }

  async get(endpoint: string, params?: Record<string, string>, language?: string) {
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
      let activeToken = token;
      let response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 401) {
        if (response.body) await response.body.cancel().catch(() => {});
        activeToken = await this.refreshRejectedToken(activeToken);
        response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${activeToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(8000),
        });
      }

      if (response.status !== 401) await this.persistAuthenticatedToken(activeToken);
      if (!response.ok) {
        throw new Error(`TVDB API error: ${response.status}`);
      }

      return await response.json();
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
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
    const params: Record<string, string> = {};
    if (extended?.meta) params.meta = extended.meta;
    if (extended?.short) params.short = "true";
    return this.get(`/series/${seriesId}`, params, language);
  }

  async getMovieById(
    movieId: number,
    extended?: { meta?: string; short?: boolean },
    language?: string,
  ) {
    const params: Record<string, string> = {};
    if (extended?.meta) params.meta = extended.meta;
    return this.get(`/movies/${movieId}`, params, language);
  }

  async searchSeries(query: string, language?: string) {
    return this.get("/search", { query, type: "series" }, language);
  }
}
