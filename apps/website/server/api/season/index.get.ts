import { useCache, useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { getDubbingProjectsForMediaEndpoint } from "../../utils/db/queries";
import { parseSeasonQuery, withMediaServiceTimeout } from "../../utils/media-request";
import { withTimeout } from "../../utils/with-timeout";
import type { CharacterProfilePicture } from "../../../src/utils/media-cast";
import { buildCacheKey } from "../../utils/cache/constants";
import { createCacheNamespace } from "../../utils/cache";

type CachedTvdbCharacterData =
  | CharacterProfilePicture[]
  | { characters?: CharacterProfilePicture[] }
  | null;

const tvdbCharacterCacheNamespace = createCacheNamespace<CachedTvdbCharacterData>();

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { id, seasonNumber } = parseSeasonQuery(query);
  const acceptLanguage = getHeader(event, "accept-language") || undefined;
  const cache = useCache(event);
  const tmdbClient = useTmdbClient();
  const mediaService = new MediaService(tmdbClient, acceptLanguage);
  const isMediaPageProjection = query.projection === "media-page";

  try {
    const apiDataPromise = withMediaServiceTimeout(async () => {
      const result = isMediaPageProjection
        ? await mediaService.getMediaWithVoiceActorsExtended(
            "season",
            id,
            seasonNumber,
            undefined,
            { includeCredits: false, projection: "media-page" },
          )
        : await mediaService.getMediaWithVoiceActorsExtended("season", id, seasonNumber);

      if (isMediaPageProjection) {
        return { season: result.media, characterProfilePictures: [] };
      }

      // Fetch character profile pictures from cache for the parent TV show if available
      const language = acceptLanguage ? (acceptLanguage.split(",")[0] || "en").trim() : "default";
      const showCacheKey = buildCacheKey({
        provider: "tvdb",
        resource: "characters-by-tmdb-id",
        id,
        language,
        params: { contentType: "tv" },
      });
      const cachedChars = await cache.getOrFetch<CachedTvdbCharacterData>(
        tvdbCharacterCacheNamespace,
        showCacheKey,
        async () => null,
        { cachePolicy: "read-only" },
      );
      const characterProfilePictures = Array.isArray(cachedChars)
        ? cachedChars
        : (cachedChars?.characters ?? []);
      return { season: result.media, characterProfilePictures };
    }, "TMDB season request");

    const parentSeriePromise = tmdbClient
      .get(`tv/${id}`, undefined, acceptLanguage)
      .then((serie) => ({
        id,
        name: typeof serie.name === "string" ? serie.name : "",
        backdrop_path: typeof serie.backdrop_path === "string" ? serie.backdrop_path : null,
        poster_path: typeof serie.poster_path === "string" ? serie.poster_path : null,
      }))
      .catch((error: unknown) => {
        console.error(`Failed to fetch parent TV show ${id} for season:`, error);
        return null;
      });

    const dbDataPromise = withTimeout(
      getDubbingProjectsForMediaEndpoint(id, "tv", query.projection),
      10_000,
      "Supabase dubbing projects query",
    ).then((dubbingProjects) => ({ dubbingProjects, voteData: {} }));

    const [apiData, dbData, serie] = await Promise.all([
      apiDataPromise,
      dbDataPromise,
      parentSeriePromise,
    ]);

    if (!apiData.season) {
      throw createError({
        statusCode: 404,
        message: "Season not found",
      });
    }

    const responseData = {
      season: apiData.season,
      serie,
      dubbingProjects: dbData.dubbingProjects,
      characterProfilePictures: apiData.characterProfilePictures,
      votes: dbData.voteData,
    };

    return responseData;
  } catch (error: unknown) {
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
      message: error instanceof Error ? error.message : "Failed to fetch season data",
    });
  }
});
