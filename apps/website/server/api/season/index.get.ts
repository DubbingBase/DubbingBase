import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjects } from "../../utils/db/queries";
import {
  setErrorCacheHeaders,
  setPublicCacheHeaders,
} from "../../utils/cache/http";
import {
  parseSeasonQuery,
  withMediaServiceTimeout,
} from "../../utils/media-request";
import { withTimeout } from "../../utils/with-timeout";
import type { CharacterProfilePicture } from "../../../src/utils/media-cast";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { id, seasonNumber } = parseSeasonQuery(query);

  setPublicCacheHeaders(event, "detail");

  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const cache = useCache(event);
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);

  try {
    const apiDataPromise = withMediaServiceTimeout(async () => {
      const result = await mediaService.getMediaWithVoiceActorsExtended(
        "season",
        id,
        seasonNumber,
      );
      // Fetch character profile pictures from cache for the parent TV show if available
      const showCacheKey = `tvdb:tv:characters_by_tmdb:${id}`;
      const cachedChars = await cache.get<
        CharacterProfilePicture[] | { characters?: CharacterProfilePicture[] }
      >(showCacheKey);
      const characterProfilePictures = Array.isArray(cachedChars)
        ? cachedChars
        : (cachedChars?.characters ?? []);
      return { season: result.media, characterProfilePictures };
    }, "TMDB season request");

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
  } catch (error: unknown) {
    setErrorCacheHeaders(event, error);
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
    ) {
      throw error;
    }
    console.error("Error fetching season:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "Failed to fetch season data",
    });
  }
});
