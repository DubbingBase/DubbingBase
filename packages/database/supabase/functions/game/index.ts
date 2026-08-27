import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import {
  igdbClient,
  cacheUtils,
  DatabaseClient,
  getParams,
} from "../_shared/index.ts";
import { buildIgdbImageUrl } from "../_shared/igdb.ts";
import type { IgdbGame, IgdbCharacter } from "../_shared/types.ts";

/**
 * Processes an IgdbGame to normalise image URLs and add media_type.
 */
function processIgdbGame(
  game: IgdbGame,
): IgdbGame & { media_type: "video_game" } {
  return {
    ...game,
    media_type: "video_game",
    cover: game.cover
      ? {
          ...game.cover,
          url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
        }
      : undefined,
    artworks: game.artworks?.map((a) => ({
      ...a,
      url: buildIgdbImageUrl(a.image_id, "1080p"),
    })),
    screenshots: game.screenshots?.map((s) => ({
      ...s,
      url: buildIgdbImageUrl(s.image_id, "screenshot_huge"),
    })),
  };
}

/**
 * Processes an IgdbCharacter to normalise the mug shot URL.
 */
function processIgdbCharacter(char: IgdbCharacter) {
  return {
    ...char,
    mug_shot: char.mug_shot
      ? {
          ...char.mug_shot,
          url: buildIgdbImageUrl(char.mug_shot.image_id, "1080p"),
        }
      : undefined,
  };
}

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { id } = await getParams(req);

      if (!id) {
        return Response.json(
          { error: "Missing id parameter" },
          { status: 400 },
        );
      }

      const gameId = parseInt(String(id), 10);
      if (isNaN(gameId)) {
        return Response.json(
          { error: "Invalid id parameter" },
          { status: 400 },
        );
      }

      const dbClient = new DatabaseClient(ctx);

      // Fetch IGDB game data and DB dubbing projects concurrently
      const [apiData, dbData] = await Promise.all([
        // External: IGDB game details + characters
        (async () => {
          try {
            const [game, characters] = await Promise.all([
              igdbClient.getGame(gameId),
              igdbClient.getGameCharacters(gameId),
            ]);
            return {
              game: game ? processIgdbGame(game) : null,
              characters: characters.map(processIgdbCharacter),
            };
          } catch (err) {
            console.error(`Failed to fetch IGDB game ${gameId}:`, err);
            return {
              game: {
                id: gameId,
                name: "Information indisponible (Timeout)",
                summary: "Ce contenu n'a pas pu être chargé.",
                media_type: "video_game" as const,
                cover: undefined,
              },
              characters: [],
            };
          }
        })(),

        // DB: dubbing projects + votes
        dbClient
          .getDubbingProjects(gameId, "video_game")
          .then(async (dubbingProjects) => {
            const workIds = dubbingProjects.flatMap(
              (p: any) => p.works?.map((w: any) => w.id) || [],
            );

            let voteData: Record<
              number,
              { up_count: number; down_count: number; user_vote: string | null }
            > = {};

            if (workIds.length > 0) {
              try {
                const user = ctx.userClaims;
                voteData = user
                  ? await dbClient.getWorkVotes(workIds, user.id)
                  : await dbClient.getWorkVotes(workIds);
              } catch (voteError) {
                console.error("Error fetching vote data:", voteError);
              }
            }

            return { dubbingProjects, voteData };
          }),
      ]);

      const { game, characters } = apiData;
      const { dubbingProjects, voteData } = dbData;

      // Lazy enqueue if not yet processed (mirrors movie.ts pattern)
      const isProcessed = dubbingProjects.length > 0;
      if (!isProcessed) {
        void (async () => {
          try {
            await ctx.supabaseAdmin.rpc("enqueue_media_fetch", {
              p_media_type: "video_game",
              p_tmdb_id: gameId, // re-uses the p_tmdb_id column for igdb_id
              p_season_number: undefined,
              p_episode_number: undefined,
            });
          } catch (err) {
            console.error("Failed to lazily enqueue video_game:", err);
          }
        })();
      }

      return Response.json({
        game,
        characters,
        dubbingProjects,
        votes: voteData,
      });
    } catch (error) {
      console.error("Error in game function:", error);
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
