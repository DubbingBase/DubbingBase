import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import {
  getDubbingProjectsForMediaEndpoint,
  getSeasonPageDubbingProjects,
} from "../../utils/db/queries";
import { parseSeasonQuery, withMediaServiceTimeout } from "../../utils/media-request";
import { withTimeout } from "../../utils/with-timeout";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const { id, seasonNumber } = parseSeasonQuery(query);
  const acceptLanguage = getHeader(event, "accept-language") || undefined;
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

      return { season: result.media };
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
      Promise.resolve(
        isMediaPageProjection
          ? getSeasonPageDubbingProjects(id, "tv")
          : getDubbingProjectsForMediaEndpoint(id, "tv", query.projection),
      ),
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
