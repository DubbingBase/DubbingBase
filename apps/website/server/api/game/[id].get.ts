import { useCache, useIgdbClient } from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import { getDubbingProjects, getWorkVotes } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import type { IgdbGame, IgdbCharacter } from "@app/shared-logic";

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
  };
}

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

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const gameId = parseInt(id, 10);
  if (isNaN(gameId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  const user = event.context.user;
  const cache = useCache();
  const igdbClient = useIgdbClient();

  const cacheKey = `app:game:${gameId}`;
  const cached = await cache.get<any>(cacheKey);

  let baseData = cached;

  if (!baseData) {
    // Fetch IGDB game data + DB dubbing projects concurrently
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
      getDubbingProjects(gameId, "video_game").then(async (dubbingProjects) => {
        const workIds = dubbingProjects.flatMap(
          (p: any) => p.works?.map((w: any) => w.id) || [],
        );

        let voteData: Record<
          number,
          { up_count: number; down_count: number; user_vote: string | null }
        > = {};

        if (workIds.length > 0) {
          try {
            voteData = await getWorkVotes(workIds);
          } catch (voteError) {
            console.error("Error fetching vote data:", voteError);
          }
        }

        return { dubbingProjects, voteData };
      }),
    ]);

    const { game, characters } = apiData;
    const { dubbingProjects, voteData } = dbData;

    // Lazy enqueue if not yet processed
    const isProcessed = dubbingProjects.length > 0;
    if (!isProcessed) {
      const supabaseAdmin = useSupabaseAdmin();
      void (async () => {
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "video_game",
          p_tmdb_id: gameId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error) console.error("Failed to lazily enqueue video_game:", error);
      })();
    }

    baseData = {
      game,
      characters,
      dubbingProjects,
      votes: voteData,
    };

    await cache.set(cacheKey, baseData, "SHORT");
  }

  // If authenticated, fetch personal user votes without cache contamination
  if (user) {
    const workIds = (baseData.dubbingProjects || []).flatMap(
      (p: any) => p.works?.map((w: any) => w.id) || [],
    );
    if (workIds.length > 0) {
      try {
        const userVotes = await getWorkVotes(workIds, user.id);
        return {
          ...baseData,
          votes: userVotes,
        };
      } catch (err) {
        console.error("Error fetching user votes for game:", err);
      }
    }
  }

  return baseData;
});
