import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { igdbClient, cacheUtils, getParams } from "../_shared/index.ts";
import { buildIgdbImageUrl } from "../_shared/igdb.ts";
import type { IgdbGame } from "../_shared/types.ts";

const CACHE_KEY = "igdb:trending:games:formatted:v2";

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

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (_req, _ctx) => {
    try {
      // Check formatted cache first
      const cached =
        await cacheUtils.get<ReturnType<typeof formatGame>[]>(CACHE_KEY);
      if (cached) {
        console.log("Cache hit for trending games");
        return Response.json(cached);
      }

      console.log("Cache miss for trending games, fetching from IGDB PopScore");

      const games = await igdbClient.getTrendingGames(20);
      const formatted = games.map(formatGame);

      try {
        await cacheUtils.set(CACHE_KEY, formatted, "SHORT"); // 1h TTL
      } catch (cacheErr) {
        console.error("Failed to write trending games to cache:", cacheErr);
      }

      return Response.json(formatted);
    } catch (error) {
      console.error("Error in trending-games function:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
        { status: 500 },
      );
    }
  }),
};
