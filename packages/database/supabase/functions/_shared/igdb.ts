import { IIgdbClient } from "./interfaces.ts";
import { SimpleCache } from "./cache-utils.ts";
import type {
  IgdbGame,
  IgdbCharacter,
  IgdbPopularityPrimitive,
} from "./types.ts";

// Debug logging function
function debugLog(message: string, data?: any) {
  console.log(`[IGDB] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

/** Builds the full image URL from an IGDB image hash. */
export function buildIgdbImageUrl(
  hash: string,
  size:
    | "thumb"
    | "cover_small"
    | "cover_big"
    | "screenshot_med"
    | "screenshot_big"
    | "screenshot_huge"
    | "logo_med"
    | "720p"
    | "1080p" = "cover_big",
): string {
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${hash}.jpg`;
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class IgdbClient implements IIgdbClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private tokenUrl: string;
  private cache: SimpleCache;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(cache: SimpleCache) {
    this.clientId = Deno.env.get("IGDB_CLIENT_ID")!;
    this.clientSecret = Deno.env.get("IGDB_CLIENT_SECRET")!;
    this.baseUrl = "https://api.igdb.com/v4";
    this.tokenUrl = "https://id.twitch.tv/oauth2/token";
    this.cache = cache;
    debugLog("IGDB Client initialized", {
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
    });
  }

  /**
   * Obtain a valid Twitch access token, using Redis cache to avoid
   * repeated token requests. The token is re-fetched automatically
   * when the cached value is missing or near expiry.
   */
  private async authenticate(): Promise<string> {
    // 1. Check in-memory token (valid for current invocation)
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    // 2. Check Redis cache
    const cacheKey = "igdb:auth_token";
    try {
      const cached = await this.cache.get<string>(cacheKey);
      if (cached) {
        debugLog("IGDB auth token cache hit");
        this.token = cached;
        this.tokenExpiry = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5h buffer
        return this.token;
      }
    } catch (err) {
      debugLog("Failed to read IGDB token from cache:", err);
    }

    // 3. Fetch a new token from Twitch
    debugLog("Fetching new Twitch OAuth2 token for IGDB");
    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("client_secret", this.clientSecret);
    params.append("grant_type", "client_credentials");

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Twitch token fetch failed: ${response.status} ${response.statusText} - ${errorText} (clientId: ${this.clientId ? "set" : "missing"}, clientSecret: ${this.clientSecret ? "set" : "missing"})`,
      );
    }

    const tokenData: TwitchTokenResponse = await response.json();
    this.token = tokenData.access_token;
    // expires_in is in seconds — cache for (expires_in - 1h) to be safe
    const ttlSeconds = Math.max(tokenData.expires_in - 3600, 3600);
    this.tokenExpiry = new Date(Date.now() + ttlSeconds * 1000);

    debugLog("Twitch token acquired", { expiresIn: tokenData.expires_in });

    // Cache in Redis using the actual expiry (use raw setex via cache internals)
    this.cache
      .set(cacheKey, this.token, "EXTENDED") // 7 days max, but token may expire sooner
      .catch((err) => debugLog("Failed to cache IGDB auth token:", err));

    return this.token!;
  }

  /**
   * Send an Apicalypse POST query to an IGDB endpoint.
   * IGDB API uses POST requests with a plain text body (Apicalypse syntax).
   */
  async query<T>(endpoint: string, body: string): Promise<T[]> {
    const token = await this.authenticate();

    try {
      const response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": this.clientId,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "text/plain",
        },
        body,
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        throw new Error(
          `IGDB API error on /${endpoint}: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T[];
    } catch (e: any) {
      if (e.name === "TimeoutError" || e.name === "AbortError") {
        throw new Error(`IGDB API timeout: /${endpoint}`);
      }
      throw e;
    }
  }

  /** Fetch a single game by IGDB ID, including cover, genres, platforms, companies. */
  async getGame(id: number): Promise<IgdbGame | null> {
    const cacheKey = `igdb:game:${id}:details`;
    const cached = await this.cache.get<IgdbGame>(cacheKey);
    if (cached) {
      debugLog(`Cache hit for game ${id}`);
      return cached;
    }

    const results = await this.query<IgdbGame>(
      "games",
      `fields id, name, summary, rating, rating_count, first_release_date,
       cover.image_id, cover.url,
       genres.name,
       platforms.name, platforms.slug,
       involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
       external_games.uid, external_games.category,
       websites.url, websites.category;
       where id = ${id};`,
    );

    const game = results[0] ?? null;
    if (game) {
      await this.cache.set(cacheKey, game, "MEDIUM");
      debugLog(`Cache set for game ${id}`);
    }
    return game;
  }

  /** Search for games by title using IGDB's text search. */
  async searchGames(queryText: string): Promise<IgdbGame[]> {
    const cacheKey = `igdb:search:${queryText.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const cached = await this.cache.get<IgdbGame[]>(cacheKey);
    if (cached) {
      debugLog(`Cache hit for search "${queryText}"`);
      return cached;
    }

    const escapedQuery = queryText.replace(/"/g, '\\"');
    const results = await this.query<IgdbGame>(
      "games",
      // Exclude DLC / editions to keep results clean (same as IGDB docs example)
      `search "${escapedQuery}";
       fields id, name, summary, rating, rating_count, first_release_date,
              cover.image_id, genres.name, platforms.name;
       where version_parent = null;
       limit 10;`,
    );

    await this.cache.set(cacheKey, results, "SHORT");
    return results;
  }

  /** Fetch all characters associated with a game, including mug shots. */
  async getGameCharacters(gameId: number): Promise<IgdbCharacter[]> {
    const cacheKey = `igdb:game:${gameId}:characters`;
    const cached = await this.cache.get<IgdbCharacter[]>(cacheKey);
    if (cached) {
      debugLog(`Cache hit for characters of game ${gameId}`);
      return cached;
    }

    const results = await this.query<IgdbCharacter>(
      "characters",
      `fields id, name, description, species, gender,
              mug_shot.image_id, mug_shot.url,
              games;
       where games = (${gameId});
       limit 50;`,
    );

    await this.cache.set(cacheKey, results, "MEDIUM");
    debugLog(`Fetched ${results.length} characters for game ${gameId}`);
    return results;
  }

  /**
   * Fetch trending games by combining IGDB PopScore popularity_primitives.
   * Uses type 1 (IGDB Visits) as primary and type 2 (Want to Play) as secondary.
   */
  async getTrendingGames(limit = 20): Promise<IgdbGame[]> {
    const cacheKey = `igdb:trending:games:v2`;
    const cached = await this.cache.get<IgdbGame[]>(cacheKey);
    if (cached) {
      debugLog("Cache hit for trending games");
      return cached;
    }

    // Step 1: Fetch popularity primitives for type 1 (Visits) and 2 (Want to Play)
    const primitives = await this.query<IgdbPopularityPrimitive>(
      "popularity_primitives",
      `fields game_id, value, popularity_type;
       where popularity_type = (1, 2);
       sort value desc;
       limit 100;`,
    );

    // Step 2: Weighted composite — type 1 weight 0.6, type 2 weight 0.4
    const scoreMap = new Map<number, number>();
    for (const p of primitives) {
      const weight = p.popularity_type === 1 ? 0.6 : 0.4;
      const current = scoreMap.get(p.game_id) ?? 0;
      scoreMap.set(p.game_id, current + p.value * weight);
    }

    // Sort by composite score, take top `limit` IDs
    const topIds = [...scoreMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => id);

    if (topIds.length === 0) return [];

    // Step 3: Batch fetch game details
    const games = await this.query<IgdbGame>(
      "games",
      `fields id, name, summary, rating, first_release_date,
              cover.image_id, genres.name, platforms.name;
       where id = (${topIds.join(",")}) & (themes != (42) | themes = null);
       limit ${limit};`,
    );

    await this.cache.set(cacheKey, games, "SHORT"); // 1h TTL for trending
    debugLog(`Fetched ${games.length} trending games`);
    return games;
  }
}
