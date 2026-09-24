import { SimpleCache, createCacheNamespace } from "../cache";
import type { CacheFetchOptions } from "./cache-options";
import {
  DEFAULT_LANGUAGE,
  type IgdbGame,
  type IgdbCharacter,
} from "@app/shared-logic";
import { buildCacheKey } from "../cache/constants";
import {
  createMediaResponseError,
  fetchMediaRequest,
  RetryableMediaRequestError,
} from "../retryable-request";

interface IgdbCachedToken {
  accessToken: string;
  expiresAt: number;
}

const igdbTokenNamespace = createCacheNamespace<IgdbCachedToken>();
const igdbGameNamespace = createCacheNamespace<IgdbGame | null>();
const igdbCharactersNamespace = createCacheNamespace<IgdbCharacter[]>();
const igdbTrendingGamesNamespace = createCacheNamespace<IgdbGame[]>();

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

interface IgdbGameLocalization {
  game: number;
  name: string;
  region?: { identifier?: string };
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

    const fetchToken = async (): Promise<IgdbCachedToken> => {
      debugLog("Fetching new Twitch OAuth2 token for IGDB");
      const params = new URLSearchParams();
      params.append("client_id", this.clientId);
      params.append("client_secret", this.clientSecret);
      params.append("grant_type", "client_credentials");

      const response = await fetchMediaRequest(this.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw createMediaResponseError("Twitch OAuth2", response);
      }

      const tokenData: unknown = await response.json();
      const accessToken =
        typeof tokenData === "object" && tokenData !== null
          ? Reflect.get(tokenData, "access_token")
          : undefined;
      const expiresIn =
        typeof tokenData === "object" && tokenData !== null
          ? Reflect.get(tokenData, "expires_in")
          : undefined;

      if (
        typeof accessToken !== "string" ||
        accessToken.trim().length === 0 ||
        typeof expiresIn !== "number" ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
      ) {
        throw new Error("Invalid Twitch OAuth token response");
      }

      return {
        accessToken: accessToken.trim(),
        expiresAt: Date.now() + Math.max(expiresIn - 3600, 3600) * 1000,
      };
    };

    const getCachedToken = () =>
      this.cache.getOrFetch(igdbTokenNamespace, "igdb:auth_token", fetchToken, {
        ttl: 604800,
      });

    let result = await getCachedToken();

    // Older KV entries contain only the token string, so they have no reliable
    // expiry. Discard them, along with expired entries, and fetch a fresh token.
    if (
      typeof result !== "object" ||
      result === null ||
      typeof result.accessToken !== "string" ||
      result.accessToken.trim().length === 0 ||
      typeof result.expiresAt !== "number" ||
      !Number.isFinite(result.expiresAt) ||
      result.expiresAt <= Date.now()
    ) {
      await this.cache.del("igdb:auth_token");
      result = await getCachedToken();
      if (
        typeof result !== "object" ||
        result === null ||
        typeof result.accessToken !== "string" ||
        result.accessToken.trim().length === 0 ||
        typeof result.expiresAt !== "number" ||
        !Number.isFinite(result.expiresAt) ||
        result.expiresAt <= Date.now()
      ) {
        // Bound recovery if KV cannot remove the stale value.
        result = await fetchToken();
      }
    }

    this.token = result.accessToken;
    this.tokenExpiry = new Date(result.expiresAt);
    return result.accessToken;
  }

  async query<T>(endpoint: string, body: string): Promise<T[]> {
    let token = await this.authenticate();

    try {
      let response = await fetchMediaRequest(`${this.baseUrl}/${endpoint}`, {
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
        // A 401 means the credential itself is stale; evict only this token
        // so authenticate() obtains a replacement before retrying the request.
        await this.cache.del("igdb:auth_token");
        token = await this.authenticate();

        response = await fetchMediaRequest(`${this.baseUrl}/${endpoint}`, {
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
        throw createMediaResponseError("IGDB", response);
      }

      return (await response.json()) as T[];
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
      ) {
        throw new RetryableMediaRequestError(`IGDB API timeout: /${endpoint}`, {
          cause: error,
        });
      }
      throw error;
    }
  }

  async getGame(
    id: number,
    options: CacheFetchOptions = {},
  ): Promise<IgdbGame | null> {
    const cacheKey = buildCacheKey({
      provider: "igdb",
      resource: "game",
      id,
      params: { response: "details" },
    });
    return this.cache.getOrFetch(
      igdbGameNamespace,
      cacheKey,
      async () => {
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
        return results[0] ?? null;
      },
      { ttl: 86400, ...options },
    );
  }

  async searchGames(queryText: string): Promise<IgdbGame[]> {
    const escapedQuery = queryText.replace(/"/g, '\\"');
    const results = await this.query<IgdbGame>(
      "games",
      `search "${escapedQuery}";
       fields id, name, summary, rating, rating_count, first_release_date,
              cover.image_id, genres.name, platforms.name;
       where version_parent = null;
       limit 10;`,
    );

    return results;
  }

  async getGameCharacters(
    gameId: number,
    options: CacheFetchOptions = {},
  ): Promise<IgdbCharacter[]> {
    const cacheKey = buildCacheKey({
      provider: "igdb",
      resource: "game-characters",
      id: gameId,
    });
    return this.cache.getOrFetch(
      igdbCharactersNamespace,
      cacheKey,
      () =>
        this.query<IgdbCharacter>(
          "characters",
          `fields id, name, description, species, gender,
              mug_shot.image_id, mug_shot.url,
              games;
       where games = (${gameId});
       limit 50;`,
        ),
      { ttl: 86400, ...options },
    );
  }

  async getTrendingGames(
    limit = 20,
    language = DEFAULT_LANGUAGE,
    options: CacheFetchOptions = {},
  ): Promise<IgdbGame[]> {
    const cacheKey = buildCacheKey({
      provider: "igdb",
      resource: "trending-games",
      id: "popular",
      language,
      params: { limit, version: 2 },
    });
    return this.cache.getOrFetch(
      igdbTrendingGamesNamespace,
      cacheKey,
      async () => {
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

        if (games.length === 0) return games;

        let localizedGames = games;
        try {
          const localizations = await this.query<IgdbGameLocalization>(
            "game_localizations",
            `fields game, name, region.identifier;
         where game = (${topIds.join(",")});
         limit ${Math.max(topIds.length * 10, 100)};`,
          );
          const localizedNames = new Map<number, string>();
          for (const localization of localizations) {
            if (
              localization.region?.identifier === language &&
              !localizedNames.has(localization.game)
            ) {
              localizedNames.set(localization.game, localization.name);
            }
          }
          localizedGames = games.map((game) => ({
            ...game,
            name: localizedNames.get(game.id) ?? game.name,
          }));
        } catch (error) {
          debugLog("Failed to fetch game localizations:", error);
          localizedGames = games;
        }

        return localizedGames;
      },
      { ttl: 3600, ...options },
    );
  }
}
