import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjects } from "../../utils/db/queries";
import { setPublicCacheHeaders } from "../../utils/cache/http";
import { withTimeout } from "../../utils/with-timeout";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = query.id !== undefined ? Number(query.id) : undefined;
  const seasonNumberRaw = query.season_number;
  const seasonNumber =
    seasonNumberRaw !== undefined ? Number(seasonNumberRaw) : undefined;

  if (
    id === undefined ||
    seasonNumber === undefined ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(seasonNumber) ||
    String(seasonNumberRaw).trim() === "" ||
    seasonNumber < 0
  ) {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid id or season_number",
    });
  }

  setPublicCacheHeaders(event, "detail");

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const cache = useCache(event);
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  try {
    const apiDataPromise = mediaService
      .getMediaWithVoiceActorsExtended("season", id, seasonNumber)
      .then(async (result) => {
        // Fetch character profile pictures from cache for the parent TV show if available
        const showCacheKey = `tvdb:tv:characters_by_tmdb:${id}`;
        const cachedChars = await withTimeout(
          cache.get<any>(showCacheKey),
          8_000,
          "Character cache lookup",
        );
        let characterProfilePictures: any[] = [];
        if (cachedChars) {
          characterProfilePictures = Array.isArray(cachedChars)
            ? cachedChars
            : cachedChars.characters || [];
        }
        return { season: result.media, characterProfilePictures };
      })
      .catch((err) => {
        if (err?.statusCode === 504) throw err;
        console.error(
          `Failed to fetch TMDB season ${id} S${seasonNumber}:`,
          err,
        );
        return {
          season: null,
          characterProfilePictures: [],
        };
      });

    const dbDataPromise = withTimeout(
      getDubbingProjects(id, "tv"),
      10_000,
      "Supabase dubbing projects query",
    ).then((dubbingProjects) => ({ dubbingProjects, voteData: {} }));

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
