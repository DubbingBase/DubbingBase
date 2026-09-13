import { useIgdbClient } from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import type { IgdbGame } from "@app/shared-logic";
import {
  setNoCacheHeaders,
  setPublicCacheHeaders,
} from "../../utils/cache/http";

function formatGame(game: IgdbGame) {
  return {
    ...game,
    media_type: "video_game" as const,
    cover: game.cover
      ? {
          ...game.cover,
          url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
        }
      : undefined,
  };
}

export default defineEventHandler(async (event) => {
  setPublicCacheHeaders(event, "discovery");

  const config = useRuntimeConfig();

  if (!config.igdbClientId || !config.igdbClientSecret) {
    return [];
  }

  const igdbClient = useIgdbClient();

  try {
    const games = await igdbClient.getTrendingGames(20);
    const formatted = games.map(formatGame);

    return formatted;
  } catch (err) {
    setNoCacheHeaders(event);
    console.error("[trending/games] IGDB query failed:", err);
    return [];
  }
});
