import { useTmdbClient } from "../utils";
import { setPublicCacheHeaders } from "../utils/cache/http";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const mediaType = query.media_type as string | undefined;
  const mediaId = query.media_id ? Number(query.media_id) : undefined;

  if (
    !mediaType ||
    !Number.isSafeInteger(mediaId) ||
    typeof mediaId !== "number" ||
    mediaId <= 0
  ) {
    throw createError({
      statusCode: 400,
      message: "media_type and media_id are required",
    });
  }

  if (mediaType !== "movie" && mediaType !== "tv") {
    throw createError({
      statusCode: 400,
      message: "media_type must be movie or tv",
    });
  }

  try {
    const credits = await useTmdbClient().fetchMediaCredits(
      mediaType,
      mediaId,
      "fr-FR",
    );
    if (
      typeof credits !== "object" ||
      credits === null ||
      !Array.isArray(credits.cast)
    ) {
      throw createError({
        statusCode: 502,
        message: "Invalid TMDB credits response",
      });
    }
    setPublicCacheHeaders(event, "static");
    return credits;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw createError({ statusCode: 500, message: errorMsg });
  }
});
