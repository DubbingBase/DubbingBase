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
  const episodeNumber =
    query.episode_number !== undefined
      ? Number(query.episode_number)
      : undefined;

  if (
    id === undefined ||
    seasonNumber === undefined ||
    episodeNumber === undefined ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(seasonNumber) ||
    String(seasonNumberRaw).trim() === "" ||
    seasonNumber < 0 ||
    !Number.isSafeInteger(episodeNumber) ||
    episodeNumber <= 0
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
        return { episode: result.media, characterProfilePictures };
      })
      .catch((err) => {
        if (err?.statusCode === 504) throw err;
        console.error(
          `Failed to fetch TMDB episode ${id} S${seasonNumber}E${episodeNumber}:`,
          err,
        );
        return {
          episode: null,
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
