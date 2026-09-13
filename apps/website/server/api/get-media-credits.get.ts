import { useTmdbClient } from "../utils";
import { setPublicCacheHeaders } from "../utils/cache/http";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const mediaType = query.media_type as string | undefined;
  const mediaId = query.media_id ? Number(query.media_id) : undefined;

  if (!mediaType || !mediaId) {
    throw createError({
      statusCode: 400,
      message: "media_type and media_id are required",
    });
  }

  setPublicCacheHeaders(event, "static");

  try {
    if (mediaType !== "movie" && mediaType !== "tv") {
      throw createError({
        statusCode: 400,
        message: "media_type must be movie or tv",
      });
    }

    return await useTmdbClient().fetchMediaCredits(mediaType, mediaId, "fr-FR");
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw createError({ statusCode: 500, message: errorMsg });
  }
});
