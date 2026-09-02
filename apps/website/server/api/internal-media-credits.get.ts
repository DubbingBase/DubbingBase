import { useIgdbClient } from "../utils";
import { buildIgdbImageUrl } from "../utils/api/igdb";

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

  const config = useRuntimeConfig();

  if (mediaType === "movie" || mediaType === "tv") {
    const endpoint = mediaType === "tv" ? "aggregate_credits" : "credits";
    const response = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${mediaId}/${endpoint}?language=fr-FR`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tmdbApiKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`TMDB credits failed: ${response.status}`);
    }
    const data = (await response.json()) as { cast?: any[] };
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
