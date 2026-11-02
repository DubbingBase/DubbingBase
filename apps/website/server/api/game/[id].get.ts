import { useIgdbClient } from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import { getDubbingProjects, getGamePageDubbingProjects } from "../../utils/db/queries";
import { useSupabaseAdmin } from "../../utils/db/client";
import { sendDiscordAdminNotification } from "../../utils/notifications/discord";
import { scheduleBackgroundTask } from "../../utils/background";
import type { IgdbGame } from "@app/shared-logic";
import { loadGameCharacterCatalog, type ResolvedGameCharacter } from "../../utils/game-characters";
import { withMediaServiceTimeout } from "../../utils/media-request";

function processIgdbGame(
  game: IgdbGame,
  pageProjection: boolean,
): IgdbGame & { media_type: "video_game" } {
  const artworks = (pageProjection ? game.artworks?.slice(0, 1) : game.artworks)?.map(
    (artwork) => ({
      ...artwork,
      url: buildIgdbImageUrl(artwork.image_id, "1080p"),
    }),
  );
  const screenshots = (pageProjection ? game.screenshots?.slice(0, 1) : game.screenshots)?.map(
    (screenshot) => ({
      ...screenshot,
      url: buildIgdbImageUrl(screenshot.image_id, "screenshot_huge"),
    }),
  );

  const cover = game.cover
    ? {
        image_id: game.cover.image_id,
        url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
      }
    : undefined;

  if (pageProjection) {
    return {
      id: game.id,
      name: game.name,
      slug: game.slug,
      summary: game.summary,
      rating: game.rating,
      first_release_date: game.first_release_date,
      cover,
      artworks,
      screenshots,
      genres: game.genres?.map(({ id, name }) => ({ id, name })),
      platforms: game.platforms?.map(({ id, name }) => ({ id, name })),
      involved_companies: game.involved_companies?.map((company) => ({
        id: company.id,
        company: { id: company.company.id, name: company.company.name },
        developer: company.developer,
        publisher: company.publisher,
      })),
      media_type: "video_game",
    };
  }

  return {
    ...game,
    media_type: "video_game",
    cover: game.cover
      ? {
          ...game.cover,
          url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
        }
      : undefined,
    artworks,
    screenshots,
  };
}

function processIgdbCharacter(char: ResolvedGameCharacter, pageProjection: boolean) {
  const mugShot = char.mug_shot
    ? {
        ...(pageProjection ? {} : char.mug_shot),
        image_id: char.mug_shot.image_id,
        url: buildIgdbImageUrl(char.mug_shot.image_id, "1080p"),
      }
    : undefined;

  if (!pageProjection) return { ...char, mug_shot: mugShot };

  return {
    id: char.id,
    name: char.name,
    stable_id: char.stable_id,
    game_character_id: char.game_character_id,
    igdb_character_id: char.igdb_character_id,
    identity_source: char.identity_source,
    local_name: char.local_name,
    mug_shot: mugShot,
  };
}

function unavailableGame(gameId: number): IgdbGame & { media_type: "video_game" } {
  return {
    id: gameId,
    name: "Information indisponible (Timeout)",
    summary: "Ce contenu n'a pas pu être chargé.",
    media_type: "video_game",
    cover: undefined,
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
  const pageProjection = getQuery(event).projection === "media-page";

  const [game, characterCatalog] = await Promise.all([
    withMediaServiceTimeout(
      () => (pageProjection ? igdbClient.getGame(gameId, true) : igdbClient.getGame(gameId)),
      "IGDB game",
    )
      .then((igdbGame) => (igdbGame ? processIgdbGame(igdbGame, pageProjection) : null))
      .catch((error: unknown) => {
        console.error(`Failed to fetch IGDB game ${gameId}:`, error);
        return unavailableGame(gameId);
      }),
    loadGameCharacterCatalog(event, gameId, () =>
      igdbClient.getGameCharacters(gameId, pageProjection),
    ),
  ]);
  const resolvedGame =
    game ??
    (characterCatalog.characters.some((character) => character.identity_source === "local")
      ? unavailableGame(gameId)
      : null);
  if (!resolvedGame) throw createError({ statusCode: 404, statusMessage: "Game not found" });

  const metadata = {
    game: resolvedGame,
    characters: characterCatalog.characters.map((character) =>
      processIgdbCharacter(character, pageProjection),
    ),
    character_catalog_status: characterCatalog.providerStatus,
  };

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
