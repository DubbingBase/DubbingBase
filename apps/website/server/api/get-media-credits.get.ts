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

  const config = useRuntimeConfig();
  const endpoint = mediaType === "tv" ? "aggregate_credits" : "credits";

  try {
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
      throw new Error(`Failed to fetch from TMDB: status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw createError({ statusCode: 500, message: errorMsg });
  }
});
