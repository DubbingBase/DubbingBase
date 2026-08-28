import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { useSupabaseAdmin } from "../../utils/db/client";
import { getDubbingProjects } from "../../utils/db/queries";

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const query = getQuery(event);
  const id = query.id ? Number(query.id) : undefined;
  const seasonNumber =
    query.season_number !== undefined ? Number(query.season_number) : undefined;

  if (!id || seasonNumber === undefined) {
    throw createError({
      statusCode: 400,
      message: "Missing id or season_number",
    });
  }

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  try {
    const apiDataPromise = mediaService
      .getMediaWithVoiceActorsExtended("season", id, seasonNumber)
      .then(async (result) => {
        const characterProfilePictures =
          await mediaService.getCharacterProfilePictures(
            "tv",
            id,
            result.media,
          );
        return { season: result.media, characterProfilePictures };
      });

    const dbDataPromise = getDubbingProjects(id, "tv").then(
      (dubbingProjects) => {
        return { dubbingProjects, voteData: {} };
      },
    );

    const [apiData, dbData] = await Promise.all([
      apiDataPromise,
      dbDataPromise,
    ]);

    return {
      season: apiData.season,
      dubbingProjects: dbData.dubbingProjects,
      characterProfilePictures: apiData.characterProfilePictures,
      votes: dbData.voteData,
    };
  } catch (error) {
    console.error("Error fetching season:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to fetch season data",
    });
  }
});
