import { useCache, useIgdbClient } from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import { getDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
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

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

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
            igdbFailed: false,
            game: game ? processIgdbGame(game) : null,
            characters: characters.map(processIgdbCharacter),
          };
        } catch (err) {
          console.error(`Failed to fetch IGDB game ${gameId}:`, err);
          return {
            igdbFailed: true,
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

      // DB: dubbing projects
      getDubbingProjects(gameId, "video_game"),
    ]);

    const { game, characters, igdbFailed } = apiData;
    const dubbingProjects = dbData;

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
        if (error) {
          if (!error.message?.includes("already in the queue")) {
            console.error("Failed to lazily enqueue video_game:", error);
          }
        } else {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued video game **${game?.name || gameId}** (IGDB: ${gameId}) for dubbing discovery.`,
            {
              ...(game?.cover?.url ? { imageUrl: game.cover.url } : {}),
              url: `/game/${gameId}`,
            },
          );
        }
      })();
    }

    baseData = {
      game,
      characters,
      dubbingProjects,
    };

    // Don't cache the error fallback, so recovery isn't delayed by stale poison
    if (!igdbFailed) {
      await cache.set(cacheKey, baseData, "LONG");
    }
  }

  return baseData;
});
