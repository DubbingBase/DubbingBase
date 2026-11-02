import { useIgdbClient } from "../../utils";
import type { H3Event } from "h3";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import type { IgdbGame } from "@app/shared-logic";
import { resolveLocaleLanguage } from "@app/shared-logic";
import { setPublicCacheHeaders } from "../../utils/cache/http";
import type { IgdbTrendingGamesResult } from "../../utils/api/igdb";

function formatGame(game: IgdbGame, cardProjection: boolean) {
  if (cardProjection) {
    return {
      id: game.id,
      name: game.name,
      media_type: "video_game" as const,
      cover: game.cover
        ? {
            image_id: game.cover.image_id,
            url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
          }
        : undefined,
    };
  }

  const cover = game.cover
    ? {
        ...game.cover,
        url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
      }
    : undefined;

  return {
    ...game,
    media_type: "video_game" as const,
    cover,
  };
}

function isIgdbGame(value: unknown): value is IgdbGame {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const id = Reflect.get(value, "id");
  const name = Reflect.get(value, "name");
  const cover = Reflect.get(value, "cover");
  return (
    typeof id === "number" &&
    Number.isFinite(id) &&
    typeof name === "string" &&
    (cover === undefined ||
      cover === null ||
      (typeof cover === "object" && typeof Reflect.get(cover, "image_id") === "string"))
  );
}

export async function getTrendingGamesResponse(
  event: H3Event,
  language: string,
  config: { igdbClientId?: string; igdbClientSecret?: string },
  igdbClient: {
    getTrendingGames(limit?: number, language?: string): Promise<IgdbTrendingGamesResult>;
  },
  projection?: string,
) {
  if (!config.igdbClientId || !config.igdbClientSecret) return [];

  try {
    const result = await igdbClient.getTrendingGames(20, language);
    if (
      typeof result !== "object" ||
      result === null ||
      !Array.isArray(result.games) ||
      !result.games.every(isIgdbGame) ||
      typeof result.degraded !== "boolean"
    ) {
      return [];
    }
    const formatted = result.games.map((game) => formatGame(game, projection === "card"));

    if (result.degraded) return formatted;
    setPublicCacheHeaders(event, "discovery");
    return formatted;
  } catch (err) {
    console.error("[trending/games] IGDB query failed:", err);
    return [];
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const rawLanguage = query.lang;
  const language = resolveLocaleLanguage(
    rawLanguage === undefined ? undefined : typeof rawLanguage === "string" ? rawLanguage : "",
  );
  if (language === null) {
    throw createError({ statusCode: 400, message: "Unsupported language" });
  }

  const config = useRuntimeConfig();
  const igdbClient = useIgdbClient();
  const projection = query.projection === "card" ? "card" : undefined;
  return getTrendingGamesResponse(event, language, config, igdbClient, projection);
});
