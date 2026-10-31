import { useIgdbClient, useTmdbClient } from "../utils";
import { buildIgdbImageUrl } from "../utils/api/igdb";
import { loadGameCharacterCatalog } from "../utils/game-characters";
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const mediaType = String(query.media_type ?? "");
  const mediaId = Number(query.media_id);

  if (!mediaType || !mediaId || Number.isNaN(mediaId)) {
    throw createError({
      statusCode: 400,
      message: "media_type and media_id are required",
    });
  }

  if (mediaType === "movie" || mediaType === "tv") {
    const data = await useTmdbClient().fetchMediaCredits(mediaType, mediaId, "fr-FR");
    return { cast: data.cast ?? [] };
  }

  if (mediaType === "video_game") {
    const igdbClient = useIgdbClient();
    const { characters } = await loadGameCharacterCatalog(event, mediaId, () =>
      igdbClient.getGameCharacters(mediaId),
    );
    return {
      cast: characters.map((character) => ({
        id: character.identity_source === "local" ? null : character.igdb_character_id,
        game_character_id: character.game_character_id,
        identity_source: character.identity_source,
        stable_id: character.stable_id,
        name: character.name,
        character: character.name,
        profile_path: character.mug_shot?.image_id
          ? buildIgdbImageUrl(character.mug_shot.image_id, "1080p")
          : null,
        gender: character.gender ?? null,
      })),
    };
  }

  if (mediaType === "audiobook" || mediaType === "podcast") {
    return { cast: [] };
  }

  if (mediaType === "advertisement" || mediaType === "toy") {
    return { cast: [] };
  }

  throw createError({
    statusCode: 400,
    message: `Unsupported media_type: ${mediaType}`,
  });
});
