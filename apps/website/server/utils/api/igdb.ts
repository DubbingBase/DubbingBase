import { SimpleCache } from "../cache";
import type { IgdbGame, IgdbCharacter } from "@app/shared-logic";

export interface IgdbPopularityPrimitive {
  id: number;
  game_id: number;
  popularity_type: number;
  value: number;
}

function debugLog(message: string, data?: any) {
  console.log(`[IGDB] ${message}`, data ? JSON.stringify(data, null, 2) : "");
}

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

export class IgdbClient {
  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;
  private tokenUrl: string;
  private cache: SimpleCache;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(cache: SimpleCache) {
    const config = useRuntimeConfig();
    this.clientId = (config.igdbClientId as string) || "";
    this.clientSecret = (config.igdbClientSecret as string) || "";
    this.baseUrl = "https://api.igdb.com/v4";
    this.tokenUrl = "https://id.twitch.tv/oauth2/token";
    this.cache = cache;
    debugLog("IGDB Client initialized", {
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret,
    });
  }

  private async authenticate(): Promise<string> {
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    const cacheKey = "igdb:auth_token";
    try {
      const cached = await this.cache.get<string>(cacheKey);
      if (cached) {
        debugLog("IGDB auth token cache hit");
        this.token = cached;
        this.tokenExpiry = new Date(Date.now() + 5 * 60 * 60 * 1000);
        return this.token;
      }
    } catch (err) {
      debugLog("Failed to read IGDB token from cache:", err);
    }

    debugLog("Fetching new Twitch OAuth2 token for IGDB");
    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("client_secret", this.clientSecret);
    params.append("grant_type", "client_credentials");

    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Twitch token fetch failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const tokenData: TwitchTokenResponse = await response.json();
    this.token = tokenData.access_token;
    const ttlSeconds = Math.max(tokenData.expires_in - 3600, 3600);
    this.tokenExpiry = new Date(Date.now() + ttlSeconds * 1000);

    this.cache
      .set(cacheKey, this.token, "EXTENDED")
      .catch((err) => debugLog("Failed to cache IGDB auth token:", err));

    return this.token!;
  }

  async query<T>(endpoint: string, body: string): Promise<T[]> {
    let token = await this.authenticate();

    try {
      let response = await fetch(`${this.baseUrl}/${endpoint}`, {
        method: "POST",
        headers: {
          "Client-ID": this.clientId,
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "text/plain",
        },
        body,
        signal: AbortSignal.timeout(8000),
      });

      if (response.status === 401) {
        debugLog(`IGDB 401 on /${endpoint}. Retrying.`);
        this.token = null;
        this.tokenExpiry = null;
        await this.cache.del("igdb:auth_token");
        token = await this.authenticate();

        response = await fetch(`${this.baseUrl}/${endpoint}`, {
          method: "POST",
          headers: {
            "Client-ID": this.clientId,
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "text/plain",
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
      }

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

  async getGame(id: number): Promise<IgdbGame | null> {
    const cacheKey = `igdb:game:${id}:details`;
    const cached = await this.cache.get<IgdbGame>(cacheKey);
    if (cached) return cached;

    const results = await this.query<IgdbGame>(
      "games",
      `fields id, name, slug, summary, rating, rating_count, first_release_date,
       cover.image_id, cover.url,
       artworks.image_id, artworks.url,
       screenshots.image_id, screenshots.url,
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
    }
    return game;
  }

  async searchGames(queryText: string): Promise<IgdbGame[]> {
    const cacheKey = `igdb:search:${queryText.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const cached = await this.cache.get<IgdbGame[]>(cacheKey);
    if (cached) return cached;

    const escapedQuery = queryText.replace(/"/g, '\\"');
    const results = await this.query<IgdbGame>(
      "games",
      `search "${escapedQuery}";
       fields id, name, summary, rating, rating_count, first_release_date,
              cover.image_id, genres.name, platforms.name;
       where version_parent = null;
       limit 10;`,
    );

    await this.cache.set(cacheKey, results, "SHORT");
    return results;
  }

  async getGameCharacters(gameId: number): Promise<IgdbCharacter[]> {
    const cacheKey = `igdb:game:${gameId}:characters`;
    const cached = await this.cache.get<IgdbCharacter[]>(cacheKey);
    if (cached) return cached;

    const results = await this.query<IgdbCharacter>(
      "characters",
      `fields id, name, description, species, gender,
              mug_shot.image_id, mug_shot.url,
              games;
       where games = (${gameId});
       limit 50;`,
    );

    await this.cache.set(cacheKey, results, "MEDIUM");
    return results;
  }

  async getTrendingGames(limit = 20): Promise<IgdbGame[]> {
    const cacheKey = "igdb:trending:games:v2";
    const cached = await this.cache.get<IgdbGame[]>(cacheKey);
    if (cached) return cached;

    const primitives = await this.query<IgdbPopularityPrimitive>(
      "popularity_primitives",
      `fields game_id, value, popularity_type;
       where popularity_type = (1, 2);
       sort value desc;
       limit 100;`,
    );

    const scoreMap = new Map<number, number>();
    for (const p of primitives) {
      const weight = p.popularity_type === 1 ? 0.6 : 0.4;
      const current = scoreMap.get(p.game_id) ?? 0;
      scoreMap.set(p.game_id, current + p.value * weight);
    }

    const topIds = [...scoreMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => id);

    if (topIds.length === 0) return [];

    const games = await this.query<IgdbGame>(
      "games",
      `fields id, name, summary, rating, first_release_date,
              cover.image_id, genres.name, platforms.name;
       where id = (${topIds.join(",")}) & (themes != (42) | themes = null);
       limit ${limit};`,
    );

    await this.cache.set(cacheKey, games, "SHORT");
    return games;
  }
}
