import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjects } from "../../utils/db/queries";
import { setPublicCacheHeaders } from "../../utils/cache/http";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = query.id !== undefined ? Number(query.id) : undefined;
  const seasonNumber =
    query.season_number !== undefined ? Number(query.season_number) : undefined;
  const episodeNumber =
    query.episode_number !== undefined
      ? Number(query.episode_number)
      : undefined;

  if (
    id === undefined ||
    seasonNumber === undefined ||
    episodeNumber === undefined ||
    isNaN(id) ||
    isNaN(seasonNumber) ||
    isNaN(episodeNumber)
  ) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid id, season_number or episode_number",
    });
  }

  setPublicCacheHeaders(event, "detail");

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const cache = useCache(event);
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  try {
    const apiDataPromise = mediaService
      .getMediaWithVoiceActorsExtended(
        "episode",
        id,
        seasonNumber,
        episodeNumber,
      )
      .then(async (result) => {
        // Fetch character profile pictures from cache for the parent TV show if available
        const showCacheKey = `tvdb:tv:characters_by_tmdb:${id}`;
        const cachedChars = await cache.get<any>(showCacheKey);
        let characterProfilePictures: any[] = [];
        if (cachedChars) {
          characterProfilePictures = Array.isArray(cachedChars)
            ? cachedChars
            : cachedChars.characters || [];
        }
        return { episode: result.media, characterProfilePictures };
      })
      .catch((err) => {
        console.error(
          `Failed to fetch TMDB episode ${id} S${seasonNumber}E${episodeNumber}:`,
          err,
        );
        return {
          episode: null,
          characterProfilePictures: [],
        };
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

    if (!apiData.episode) {
      throw createError({
        statusCode: 404,
        message: "Episode not found",
      });
    }

    const responseData = {
      episode: apiData.episode,
      dubbingProjects: dbData.dubbingProjects,
      characterProfilePictures: apiData.characterProfilePictures,
      votes: dbData.voteData,
    };

    return responseData;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    console.error("Error fetching episode:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to fetch episode data",
    });
  }
});
