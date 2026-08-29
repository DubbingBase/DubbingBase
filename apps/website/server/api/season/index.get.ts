import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjects } from "../../utils/db/queries";

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
  );

  const query = getQuery(event);
  const id = query.id !== undefined ? Number(query.id) : undefined;
  const seasonNumber =
    query.season_number !== undefined ? Number(query.season_number) : undefined;

  if (
    id === undefined ||
    seasonNumber === undefined ||
    isNaN(id) ||
    isNaN(seasonNumber)
  ) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid id or season_number",
    });
  }

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const cache = useCache(event);
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  const cacheKey = `app:season:${id}:${seasonNumber}:${acceptLanguage || "fr"}`;
  const cached = await cache.get<any>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const apiDataPromise = mediaService
      .getMediaWithVoiceActorsExtended("season", id, seasonNumber)
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
        return { season: result.media, characterProfilePictures };
      })
      .catch((err) => {
        console.error(
          `Failed to fetch TMDB season ${id} S${seasonNumber}:`,
          err,
        );
        return {
          season: null,
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

    if (!apiData.season) {
      throw createError({
        statusCode: 404,
        message: "Season not found",
      });
    }

    const responseData = {
      season: apiData.season,
      dubbingProjects: dbData.dubbingProjects,
      characterProfilePictures: apiData.characterProfilePictures,
      votes: dbData.voteData,
    };

    await cache.set(cacheKey, responseData, "SHORT");
    return responseData;
  } catch (error: any) {
    if (error?.statusCode) throw error;
    console.error("Error fetching season:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to fetch season data",
    });
  }
});
