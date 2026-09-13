import { useIgdbClient, useTmdbClient } from "../utils";
import { buildIgdbImageUrl } from "../utils/api/igdb";
import { setNoCacheHeaders } from "../utils/cache/http";

export default defineEventHandler(async (event) => {
  setNoCacheHeaders(event);
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
    const data = await useTmdbClient().fetchMediaCredits(
      mediaType,
      mediaId,
      "fr-FR",
    );
    return { cast: data.cast ?? [] };
  }

  if (mediaType === "video_game") {
    const igdbClient = useIgdbClient();
    const characters = await igdbClient.getGameCharacters(mediaId);
    return {
      cast: characters.map((c: any) => ({
        id: c.id,
        name: c.name,
        character: c.name,
        profile_path: c.mug_shot?.image_id
          ? buildIgdbImageUrl(c.mug_shot.image_id, "1080p")
          : null,
        gender: c.gender ?? null,
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
