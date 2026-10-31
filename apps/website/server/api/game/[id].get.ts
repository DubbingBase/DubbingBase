import { useIgdbClient } from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import { getDubbingProjects, getGamePageDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import { withMediaServiceTimeout } from "../../utils/media-request";
import type { IgdbGame, IgdbCharacter } from "@app/shared-logic";

function processIgdbGame(game: IgdbGame): IgdbGame & { media_type: "video_game" } {
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

  const gameId = Number(id);
  if (!Number.isSafeInteger(gameId) || gameId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Game not found" });
  }
  const igdbClient = useIgdbClient();

  const igdbGame = await withMediaServiceTimeout(() => igdbClient.getGame(gameId), "IGDB game");
  if (!igdbGame) {
    throw createError({ statusCode: 404, statusMessage: "Game not found" });
  }
  const game = processIgdbGame(igdbGame);
  const characters = await igdbClient
    .getGameCharacters(gameId)
    .then((results) => results.map(processIgdbCharacter))
    .catch((error: unknown) => {
      console.error(`Failed to fetch IGDB game characters ${gameId}:`, error);
      return [];
    });

  const metadata = { game, characters };

  // Lazy enqueue if not yet processed - Gated by PostHog 'enqueue-on-navigate' (server-side)
  const dubbingProjects =
    getQuery(event).projection === "media-page"
      ? await getGamePageDubbingProjects(gameId)
      : await getDubbingProjects(gameId, "video_game");
  const isProcessed = dubbingProjects.length > 0;
  if (!isProcessed) {
    scheduleBackgroundTask(
      event,
      async () => {
        if (!(await isEnqueueOnNavigateEnabled())) return;
        const supabaseAdmin = useSupabaseAdmin(event);
        const { error } = await supabaseAdmin.rpc("enqueue_media_fetch", {
          p_media_type: "video_game",
          p_tmdb_id: gameId,
          p_season_number: undefined,
          p_episode_number: undefined,
        });
        if (error && !error.message?.includes("already in the")) {
          console.error("Failed to lazily enqueue video_game:", error);
        } else if (!error) {
          await sendDiscordAdminNotification(
            "Media Enqueued (Auto)",
            `Automatically enqueued video game **${game?.name || gameId}** (IGDB: ${gameId}) for dubbing discovery.`,
            {
              queue: "wiki_discovery",
              ...(game?.cover?.url ? { imageUrl: game.cover.url } : {}),
              url: `/game/${gameId}`,
              color: 0x5865f2,
              event,
            },
          );
        }
      },
      "game discovery",
    );
  }

  // Dubbing works are mutable admin data and are read from Supabase on every request.
  return { ...metadata, dubbingProjects };
});
